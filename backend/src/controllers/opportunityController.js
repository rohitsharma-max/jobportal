const Opportunity = require('../models/Opportunity');
const Application = require('../models/Application');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { paginate } = require('../utils/paginate');
const { OPPORTUNITY_PUBLIC_STATUS } = require('../config/constants');

// Every handler reads req.valid (set by validate()) — never req.body/req.query —
// so only whitelisted, sanitized fields can reach the database.

const isAdmin = (req) => req.user?.role === 'admin';

const notFound = (res) =>
  res.status(404).json({
    success: false,
    data: null,
    message: 'Opportunity not found',
  });

// POST /api/opportunities  (admin) — create
const createOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.create(req.valid.body);
  res.status(201).json({
    success: true,
    data: opportunity,
    message: 'Opportunity created',
  });
});

// GET /api/opportunities  — paginated list, with optional ?search= and ?domain=
//
// Public callers see `open` listings only. An admin sees every status and may
// narrow with ?status=. The route is public, so the status filter is decided
// here from the authenticated role rather than taken from the query for
// everyone — otherwise ?status=draft would expose unpublished postings.
const getOpportunities = asyncHandler(async (req, res) => {
  const { search, domain, status, page, limit } = req.valid.query;
  const query = {};

  if (isAdmin(req)) {
    if (status) query.status = status;
  } else {
    query.status = OPPORTUNITY_PUBLIC_STATUS;
  }

  // domain -> exact match, already checked against the DOMAINS enum
  if (domain) {
    query.domain = domain;
  }

  // search -> case-insensitive match on title OR company.
  // escapeRegex is essential here: the raw term would otherwise be compiled as
  // a pattern, allowing regex injection and ReDoS (e.g. "(a+)+$").
  if (search) {
    const safe = escapeRegex(search);
    query.$or = [
      { title: { $regex: safe, $options: 'i' } },
      { company: { $regex: safe, $options: 'i' } },
    ];
  }

  const { items, meta } = await paginate(Opportunity, query, { page, limit });

  res.status(200).json({
    success: true,
    data: items,
    meta,
    message: 'Opportunities fetched',
  });
});

// GET /api/opportunities/:id  — single
//
// A non-open listing is a 404 to the public but readable by an admin, so drafts
// and archived roles stay reachable from the dashboard.
const getOpportunityById = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.valid.params.id);
  if (!opportunity) return notFound(res);

  if (!isAdmin(req) && opportunity.status !== OPPORTUNITY_PUBLIC_STATUS) {
    return notFound(res);
  }

  return res.status(200).json({
    success: true,
    data: opportunity,
    message: 'Opportunity fetched',
  });
});

// PUT /api/opportunities/:id  (admin) — update
//
// `status` is deliberately absent from opportunityBody, so a full-record PUT
// cannot silently reopen a closed role. Lifecycle moves go through PATCH below.
const updateOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findByIdAndUpdate(
    req.valid.params.id,
    req.valid.body,
    { new: true, runValidators: true }
  );
  if (!opportunity) return notFound(res);

  return res.status(200).json({
    success: true,
    data: opportunity,
    message: 'Opportunity updated',
  });
});

// PATCH /api/opportunities/:id/status  (admin) — move through the lifecycle
// (draft / open / closed / archived) without destroying the record. This is what
// lets an admin take a filled role off the board and put it back later.
const updateOpportunityStatus = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findByIdAndUpdate(
    req.valid.params.id,
    { status: req.valid.body.status },
    { new: true }
  );
  if (!opportunity) return notFound(res);

  return res.status(200).json({
    success: true,
    data: opportunity,
    message: `Opportunity marked ${opportunity.status}`,
  });
});

// DELETE /api/opportunities/:id  (admin) — archive, not destroy.
//
// A hard delete used to leave every Application for this role pointing at a
// document that no longer existed: both dashboards fell back to rendering
// "Deleted opportunity", and an applicant who had been approved lost the record
// of it. Archiving hides the listing from the public and from new applications
// while keeping that history intact.
//
// `applicationCount` comes back so the admin UI can say what was preserved.
const deleteOpportunity = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;

  const opportunity = await Opportunity.findByIdAndUpdate(
    id,
    { status: 'archived' },
    { new: true }
  );
  if (!opportunity) return notFound(res);

  const applicationCount = await Application.countDocuments({ opportunityId: id });

  return res.status(200).json({
    success: true,
    data: { _id: id, status: opportunity.status, applicationCount },
    message: applicationCount
      ? `Opportunity archived. ${applicationCount} application(s) kept for history.`
      : 'Opportunity archived',
  });
});

module.exports = {
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  updateOpportunity,
  updateOpportunityStatus,
  deleteOpportunity,
};
