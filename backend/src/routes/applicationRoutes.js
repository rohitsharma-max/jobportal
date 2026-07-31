const express = require('express');
const router = express.Router();
const {
  createApplication,
  getApplications,
  getApplicationStats,
  getMyApplications,
  updateApplicationStatus,
} = require('../controllers/applicationController');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadResumeField } = require('../config/cloudinary');
const {
  createApplicationSchema,
  listApplicationsSchema,
  updateApplicationStatusSchema,
} = require('../validation/schemas');

// Mounted at /api/applications
//
// POST order is deliberate: uploadResumeField must run before validate() because
// multer is what populates req.body from the multipart payload and req.file from
// the attachment — the schema's refine() needs both.
router
  .route('/')
  .get(protect, adminOnly, validate(listApplicationsSchema), getApplications)
  .post(protect, uploadResumeField, validate(createApplicationSchema), createApplication);

router.get('/me', protect, getMyApplications);
router.get('/stats', protect, adminOnly, getApplicationStats);
router.patch(
  '/:id/status',
  protect,
  adminOnly,
  validate(updateApplicationStatusSchema),
  updateApplicationStatus
);

module.exports = router;
