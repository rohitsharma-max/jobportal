const express = require('express');
const router = express.Router();
const {
  createApplication,
  getApplications,
} = require('../controllers/applicationController');
const { protect, adminOnly } = require('../middleware/auth');
const { uploadResume } = require('../config/cloudinary');

// Mounted at /api/applications
// - POST: any logged-in user; parses an optional "resume" file upload.
// - GET:  admin only.
router
  .route('/')
  .get(protect, adminOnly, getApplications)
  .post(protect, uploadResume.single('resume'), createApplication);

module.exports = router;
