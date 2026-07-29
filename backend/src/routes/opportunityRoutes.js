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

// Mounted at /api/opportunities
// Reads are public; writes require an admin.
router
  .route('/')
  .get(getOpportunities)
  .post(protect, adminOnly, createOpportunity);

router
  .route('/:id')
  .get(getOpportunityById)
  .put(protect, adminOnly, updateOpportunity)
  .delete(protect, adminOnly, deleteOpportunity);

module.exports = router;
