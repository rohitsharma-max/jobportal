const express = require('express');
const router = express.Router();
const {
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
} = require('../controllers/opportunityController');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createOpportunitySchema,
  updateOpportunitySchema,
  opportunityIdSchema,
  listOpportunitiesSchema,
} = require('../validation/schemas');

// Mounted at /api/opportunities
// Reads are public; writes require an admin. Every route validates its input,
// including the public list route (its ?search= feeds a RegExp).
router
  .route('/')
  .get(validate(listOpportunitiesSchema), getOpportunities)
  .post(protect, adminOnly, validate(createOpportunitySchema), createOpportunity);

router
  .route('/:id')
  .get(validate(opportunityIdSchema), getOpportunityById)
  .put(protect, adminOnly, validate(updateOpportunitySchema), updateOpportunity)
  .delete(protect, adminOnly, validate(opportunityIdSchema), deleteOpportunity);

module.exports = router;
