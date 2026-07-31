const Opportunity = require('../models/Opportunity');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');

// Every handler reads req.valid (set by validate()) — never req.body/req.query —
// so only whitelisted, sanitized fields can reach the database.

// POST /api/opportunities  (admin) — create
const createOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.create(req.valid.body);
  res.status(201).json({
    success: true,
    data: opportunity,
    message: 'Opportunity created',
  });
});

// GET /api/opportunities  — list all, with optional ?search= and ?domain=
const getOpportunities = asyncHandler(async (req, res) => {
  const { search, domain } = req.valid.query;
  const query = {};

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

  const opportunities = await Opportunity.find(query).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: opportunities,
    message: 'Opportunities fetched',
  });
});

// GET /api/opportunities/:id  — single
const getOpportunityById = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.valid.params.id);
  if (!opportunity) {
    return res.status(404).json({
      success: false,
      data: null,
      message: 'Opportunity not found',
    });
  }
  return res.status(200).json({
    success: true,
    data: opportunity,
    message: 'Opportunity fetched',
  });
});

// PUT /api/opportunities/:id  (admin) — update
const updateOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findByIdAndUpdate(
    req.valid.params.id,
    req.valid.body,
    { new: true, runValidators: true }
  );
  if (!opportunity) {
    return res.status(404).json({
      success: false,
      data: null,
      message: 'Opportunity not found',
    });
  }
  return res.status(200).json({
    success: true,
    data: opportunity,
    message: 'Opportunity updated',
  });
});

// DELETE /api/opportunities/:id  (admin) — delete
const deleteOpportunity = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;
  const opportunity = await Opportunity.findByIdAndDelete(id);
  if (!opportunity) {
    return res.status(404).json({
      success: false,
      data: null,
      message: 'Opportunity not found',
    });
  }
  return res.status(200).json({
    success: true,
    data: { _id: id },
    message: 'Opportunity deleted',
  });
});

module.exports = {
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
};
