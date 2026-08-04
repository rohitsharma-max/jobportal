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
const { protect, adminOnly } = require('../middleware/auth');
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
// Writes require an admin. Every route validates its input, including the
// list route (its ?search= feeds a RegExp).
//
// Job data sits behind login: both the list and the single-opportunity route
// require a logged-in caller (protect). The list used to run on optionalAuth
// so it could serve anonymous callers, but that made the detail route's
// protect gate pointless — a plain curl to the list already returned every
// open listing in full. isAdmin(req) in the controller still works exactly as
// before under protect: req.user is always set there, so a normal user sees
// only `open` listings (same as an admin who narrows with ?status=open) and
// an admin still sees everything, optionally filtered by ?status=.
router
  .route('/')
  .get(protect, validate(listOpportunitiesSchema), getOpportunities)
  .post(protect, adminOnly, validate(createOpportunitySchema), createOpportunity);

router
  .route('/:id')
  .get(protect, validate(opportunityIdSchema), getOpportunityById)
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
