const Application = require('../models/Application');
const Opportunity = require('../models/Opportunity');
const asyncHandler = require('../utils/asyncHandler');
const sendEmail = require('../utils/sendEmail');

// POST /api/applications  (logged-in user) — submit an application.
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
    userId: req.user._id, // set from the authenticated user
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
      subject: `Application received — ${opportunity.title}`,
      html: `<p>Hi ${application.name},</p>
             <p>We've received your application for <strong>${opportunity.title}</strong> at ${opportunity.company}.</p>
             <p>Good luck!<br/>— Job Portal</p>`,
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

// GET /api/applications  (admin) — list all, optional ?opportunityId=
const getApplications = asyncHandler(async (req, res) => {
  const { opportunityId } = req.query;
  const query = {};
  if (opportunityId) query.opportunityId = opportunityId;

  const applications = await Application.find(query)
    .populate('opportunityId', 'title company')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: applications,
    message: 'Applications fetched',
  });
});

module.exports = { createApplication, getApplications };
