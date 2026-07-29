const Opportunity = require('../models/Opportunity');
const asyncHandler = require('../utils/asyncHandler');
const { fail, requireObjectId, validateOpportunity } = require('../utils/validation');
const { DOMAINS } = require('../config/constants');

// POST /api/opportunities  (admin) — create
const createOpportunity = asyncHandler(async (req, res) => {
  const payload = validateOpportunity(res, req.body);
  const opportunity = await Opportunity.create(payload);
  res.status(201).json({
    success: true,
    data: opportunity,
    message: 'Opportunity created',
  });
});

// GET /api/opportunities  — list all, with optional ?search= and ?domain=
const getOpportunities = asyncHandler(async (req, res) => {
  const { search, domain } = req.query;
  const query = {};

  // domain -> exact match
  if (domain) {
    query.domain = domain;
  }

  // search -> case-insensitive match on title OR company
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
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
  requireObjectId(res, req.params.id, 'Opportunity ID');
  const opportunity = await Opportunity.findById(req.params.id);
  if (!opportunity) {
    res.status(404);
    throw new Error('Opportunity not found');
  }
  res.status(200).json({
    success: true,
    data: opportunity,
    message: 'Opportunity fetched',
  });
});

// PUT /api/opportunities/:id  (admin) — update
const updateOpportunity = asyncHandler(async (req, res) => {
  requireObjectId(res, req.params.id, 'Opportunity ID');
  const payload = validateOpportunity(res, req.body);
  const opportunity = await Opportunity.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  if (!opportunity) {
    res.status(404);
    throw new Error('Opportunity not found');
  }
  res.status(200).json({
    success: true,
    data: opportunity,
    message: 'Opportunity updated',
  });
});

// DELETE /api/opportunities/:id  (admin) — delete
const deleteOpportunity = asyncHandler(async (req, res) => {
  requireObjectId(res, req.params.id, 'Opportunity ID');
  const opportunity = await Opportunity.findByIdAndDelete(req.params.id);
  if (!opportunity) {
    res.status(404);
    throw new Error('Opportunity not found');
  }
  res.status(200).json({
    success: true,
    data: { _id: req.params.id },
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

