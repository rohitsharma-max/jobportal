const express = require('express');
const router = express.Router();
const {
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  updateOpportunity,
  updateOpportunityStatus,
  deleteOpportunity,
} = require('../controllers/opportunityController');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createOpportunitySchema,
  updateOpportunitySchema,
  updateOpportunityStatusSchema,
  opportunityIdSchema,
  listOpportunitiesSchema,
} = require('../validation/schemas');

// Mounted at /api/opportunities
//
// Reads are public; writes require an admin. Every route validates its input,
// including the public list route (its ?search= feeds a RegExp).
//
// The two read routes use optionalAuth rather than no auth at all: they stay
// open to anonymous callers, but an admin who identifies themselves also sees
// draft, closed, and archived listings, which the public must not.
router
  .route('/')
  .get(optionalAuth, validate(listOpportunitiesSchema), getOpportunities)
  .post(protect, adminOnly, validate(createOpportunitySchema), createOpportunity);

router
  .route('/:id')
  .get(optionalAuth, validate(opportunityIdSchema), getOpportunityById)
  .put(protect, adminOnly, validate(updateOpportunitySchema), updateOpportunity)
  // DELETE archives rather than destroying — see the controller for why.
  .delete(protect, adminOnly, validate(opportunityIdSchema), deleteOpportunity);

router.patch(
  '/:id/status',
  protect,
  adminOnly,
  validate(updateOpportunityStatusSchema),
  updateOpportunityStatus
);

module.exports = router;
