const Application = require('../models/Application');
const Opportunity = require('../models/Opportunity');
const asyncHandler = require('../utils/asyncHandler');
const sendEmail = require('../utils/sendEmail');

const VALID_STATUSES = ['Pending', 'Approved', 'Rejected'];

const populateApplication = (query) =>
  query
    .populate('opportunityId', 'title company domain type location')
    .populate('userId', 'name email')
    .populate('reviewedBy', 'name email');

// POST /api/applications  (logged-in user) - submit an application.
// Accepts multipart/form-data: text fields + an optional "resume" file.
const createApplication = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.body.opportunityId);
  if (!opportunity) {
    res.status(404);
    throw new Error('Opportunity not found');
  }

  // Resume: prefer an uploaded file (Cloudinary URL in req.file.path),
  // otherwise fall back to a pasted link.
  const resumeLink = req.file ? req.file.path : req.body.resumeLink || '';

  const application = await Application.create({
    opportunityId: req.body.opportunityId,
    userId: req.user._id,
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    coverNote: req.body.coverNote,
    resumeLink,
  });

  // Fire a confirmation email (non-blocking: never fail the request on email error).
  try {
    await sendEmail({
      to: application.email,
      subject: `Application received - ${opportunity.title}`,
      html: `<p>Hi ${application.name},</p>
             <p>We've received your application for <strong>${opportunity.title}</strong> at ${opportunity.company}.</p>
             <p>Good luck!<br/>- Job Portal</p>`,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }

  res.status(201).json({
    success: true,
    data: application,
    message: 'Application submitted',
  });
});

// GET /api/applications  (admin) - list all, optional filters.
const getApplications = asyncHandler(async (req, res) => {
  const { opportunityId, status, domain, company } = req.query;
  const query = {};

  if (opportunityId) query.opportunityId = opportunityId;
  if (status) query.status = status;

  if (domain || company) {
    const opportunityQuery = {};
    if (domain) opportunityQuery.domain = domain;
    if (company) opportunityQuery.company = new RegExp(company, 'i');

    const opportunities = await Opportunity.find(opportunityQuery).select('_id');
    query.opportunityId = { $in: opportunities.map((opportunity) => opportunity._id) };
  }

  const applications = await populateApplication(Application.find(query)).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: applications,
    message: 'Applications fetched',
  });
});

// GET /api/applications/me  (logged-in user) - list current user's applications.
const getMyApplications = asyncHandler(async (req, res) => {
  const applications = await populateApplication(
    Application.find({ userId: req.user._id })
  ).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: applications,
    message: 'Your applications fetched',
  });
});

// PATCH /api/applications/:id/status  (admin) - approve/reject an application.
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    res.status(400);
    throw new Error('Status must be Pending, Approved, or Rejected');
  }

  const application = await populateApplication(
    Application.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewedAt: status === 'Pending' ? null : new Date(),
        reviewedBy: status === 'Pending' ? null : req.user._id,
      },
      { new: true, runValidators: true }
    )
  );

  if (!application) {
    res.status(404);
    throw new Error('Application not found');
  }

  res.status(200).json({
    success: true,
    data: application,
    message: 'Application status updated',
  });
});

// GET /api/applications/stats  (admin) - dashboard counts by status/domain/company.
const getApplicationStats = asyncHandler(async (req, res) => {
  const [statusCounts, domainCounts, companyCounts, recentApplications] = await Promise.all([
    Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
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

  const byStatus = VALID_STATUSES.reduce((acc, status) => {
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
