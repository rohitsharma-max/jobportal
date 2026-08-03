const Application = require('../models/Application');
const Opportunity = require('../models/Opportunity');
const asyncHandler = require('../utils/asyncHandler');
const sendEmail = require('../utils/sendEmail');
const escapeRegex = require('../utils/escapeRegex');
const escapeHtml = require('../utils/escapeHtml');
const { paginate } = require('../utils/paginate');
const {
  APPLICATION_STATUSES,
  OPPORTUNITY_PUBLIC_STATUS,
} = require('../config/constants');

const populateApplication = (query) =>
  query
    .populate('opportunityId', 'title company domain type location status')
    .populate('userId', 'name email')
    .populate('reviewedBy', 'name email');

// Populate is a direct _id lookup, so it is unaffected by the `open`-only filter
// on the listing endpoints — an archived opportunity still resolves here, which
// is what keeps an applicant's history readable after a role is taken down.
const withPopulate = (query) => populateApplication(query);

// Every value below is escaped: `name` is typed by the applicant, and mail
// clients render HTML. Unescaped, a name containing markup becomes live markup
// in the delivered message.
const getStatusEmail = (application, status) => {
  const opportunity = application.opportunityId;
  const title = escapeHtml(opportunity?.title || 'your application');
  const company = escapeHtml(opportunity?.company || 'the company');
  const name = escapeHtml(application.name);

  if (status === 'Approved') {
    return {
      subject: `Application approved - ${opportunity?.title || 'your application'}`,
      html: `<p>Hi ${name},</p>
             <p>Congratulations! Your application for <strong>${title}</strong> at ${company} has been approved.</p>
             <p>The hiring team will contact you for the next steps.</p>
             <p>Good luck!<br/>- Job Portal</p>`,
    };
  }

  if (status === 'Rejected') {
    return {
      subject: `Application update - ${opportunity?.title || 'your application'}`,
      html: `<p>Hi ${name},</p>
             <p>Thank you for applying for <strong>${title}</strong> at ${company}.</p>
             <p>After review, your application was not selected for this opportunity.</p>
             <p>Please keep exploring more roles on Job Portal.<br/>- Job Portal</p>`,
    };
  }

  return null;
};

// POST /api/applications  (logged-in user) - submit an application.
// Accepts multipart/form-data: text fields + a "resume" file. Input has already
// been validated by validate(createApplicationSchema); a resume file OR a
// resumeLink is guaranteed to be present, and resumeLink already holds the
// uploaded file's URL when a file was sent.
const createApplication = asyncHandler(async (req, res) => {
  const payload = req.valid.body;

  const opportunity = await Opportunity.findById(payload.opportunityId);
  if (!opportunity) {
    return res.status(404).json({
      success: false,
      data: null,
      message: 'Opportunity not found',
    });
  }

  // Existence alone is not enough: a draft, closed, or archived role must not
  // take new applications. Previously any id that resolved was accepted, so a
  // stale tab could submit to a role that had already been taken down.
  if (opportunity.status !== OPPORTUNITY_PUBLIC_STATUS) {
    return res.status(409).json({
      success: false,
      data: null,
      code: 'OPPORTUNITY_CLOSED',
      message: 'This opportunity is no longer accepting applications',
    });
  }

  let application;
  try {
    application = await Application.create({
      ...payload,
      // Always the authenticated user — never taken from the request body.
      userId: req.user._id,
    });
  } catch (err) {
    // Unique index on (userId, opportunityId).
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        code: 'ALREADY_APPLIED',
        message: 'You have already applied to this opportunity',
      });
    }
    throw err;
  }

  // Fire a confirmation email (non-blocking: never fail the request on email error).
  try {
    await sendEmail({
      to: application.email,
      subject: `Application received - ${opportunity.title}`,
      html: `<p>Hi ${escapeHtml(application.name)},</p>
             <p>We've received your application for <strong>${escapeHtml(opportunity.title)}</strong> at ${escapeHtml(opportunity.company)}.</p>
             <p>Good luck!<br/>- Job Portal</p>`,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }

  return res.status(201).json({
    success: true,
    data: application,
    message: 'Application submitted',
  });
});

// GET /api/applications  (admin) - paginated list, optional filters.
const getApplications = asyncHandler(async (req, res) => {
  const { opportunityId, status, domain, company, page, limit } = req.valid.query;
  const query = {};

  if (opportunityId) query.opportunityId = opportunityId;
  // Older documents predate the status default, so treat missing as Pending.
  if (status === 'Pending') query.status = { $in: ['Pending', null] };
  else if (status) query.status = status;

  if (domain || company) {
    const opportunityQuery = {};
    if (domain) opportunityQuery.domain = domain;
    // Escaped: the raw value would otherwise be compiled as a regex pattern.
    if (company) opportunityQuery.company = new RegExp(escapeRegex(company), 'i');

    const opportunities = await Opportunity.find(opportunityQuery).select('_id');
    const ids = opportunities.map((opportunity) => opportunity._id);
    // Respect an explicit opportunityId filter alongside domain/company.
    query.opportunityId = opportunityId
      ? { $in: ids.filter((id) => String(id) === opportunityId) }
      : { $in: ids };
  }

  const { items, meta } = await paginate(Application, query, {
    page,
    limit,
    decorate: withPopulate,
  });

  res.status(200).json({
    success: true,
    data: items,
    meta,
    message: 'Applications fetched',
  });
});

/**
 * Counts by status across a user's ENTIRE history, not just one page.
 *
 * The dashboard's summary cards used to be derived client-side from the full
 * array. Now that the endpoint is paginated that array is one page, so counting
 * it there would report "3 applications" to someone who has thirty. The totals
 * have to come from the database.
 */
async function statusSummaryFor(userId) {
  const counts = await Application.aggregate([
    { $match: { userId } },
    { $group: { _id: { $ifNull: ['$status', 'Pending'] }, count: { $sum: 1 } } },
  ]);

  const byStatus = APPLICATION_STATUSES.reduce((acc, status) => {
    acc[status] = counts.find((item) => item._id === status)?.count || 0;
    return acc;
  }, {});

  return {
    total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    byStatus,
  };
}

// GET /api/applications/me  (logged-in user) - the caller's own applications.
const getMyApplications = asyncHandler(async (req, res) => {
  const { page, limit } = req.valid.query;

  const [{ items, meta }, summary] = await Promise.all([
    paginate(
      Application,
      { userId: req.user._id },
      { page, limit, decorate: withPopulate }
    ),
    statusSummaryFor(req.user._id),
  ]);

  res.status(200).json({
    success: true,
    data: items,
    meta,
    summary,
    message: 'Your applications fetched',
  });
});

// PATCH /api/applications/:id/status  (admin) - approve/reject an application.
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;
  const { status } = req.valid.body;

  const existingApplication = await Application.findById(id);
  if (!existingApplication) {
    return res.status(404).json({
      success: false,
      data: null,
      message: 'Application not found',
    });
  }

  const previousStatus = existingApplication.status || 'Pending';
  existingApplication.status = status;
  existingApplication.reviewedAt = status === 'Pending' ? null : new Date();
  existingApplication.reviewedBy = status === 'Pending' ? null : req.user._id;
  // Plain save() is safe: the model carries no field validators, so a record
  // written before the current rules existed can still be approved or rejected.
  await existingApplication.save();

  const application = await populateApplication(Application.findById(existingApplication._id));

  if (previousStatus !== status) {
    const email = getStatusEmail(application, status);
    if (email) {
      try {
        await sendEmail({
          to: application.email,
          subject: email.subject,
          html: email.html,
        });
      } catch (err) {
        console.error('Status email send failed:', err.message);
      }
    }
  }

  return res.status(200).json({
    success: true,
    data: application,
    message: 'Application status updated',
  });
});

// GET /api/applications/stats  (admin) - dashboard counts by status/domain/company.
const getApplicationStats = asyncHandler(async (req, res) => {
  const [statusCounts, domainCounts, companyCounts, recentApplications] = await Promise.all([
    Application.aggregate([{ $group: { _id: { $ifNull: ['$status', 'Pending'] }, count: { $sum: 1 } } }]),
    Application.aggregate([
      {
        $lookup: {
          from: 'opportunities',
          localField: 'opportunityId',
          foreignField: '_id',
          as: 'opportunity',
        },
      },
      { $unwind: '$opportunity' },
      { $group: { _id: '$opportunity.domain', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    Application.aggregate([
      {
        $lookup: {
          from: 'opportunities',
          localField: 'opportunityId',
          foreignField: '_id',
          as: 'opportunity',
        },
      },
      { $unwind: '$opportunity' },
      { $group: { _id: '$opportunity.company', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 8 },
    ]),
    populateApplication(Application.find().sort({ createdAt: -1 }).limit(5)),
  ]);

  const byStatus = APPLICATION_STATUSES.reduce((acc, status) => {
    acc[status] = statusCounts.find((item) => item._id === status)?.count || 0;
    return acc;
  }, {});

  res.status(200).json({
    success: true,
    data: {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      byStatus,
      byDomain: domainCounts.map((item) => ({ domain: item._id, count: item.count })),
      byCompany: companyCounts.map((item) => ({ company: item._id, count: item.count })),
      recentApplications,
    },
    message: 'Application stats fetched',
  });
});

module.exports = {
  createApplication,
  getApplications,
  getMyApplications,
  updateApplicationStatus,
  getApplicationStats,
};
