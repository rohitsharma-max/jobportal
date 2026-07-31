// Cloudinary setup + the Multer middleware that uploads resume files straight to
// Cloudinary. Credentials come from .env (see .env.example).
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { RESUME_MAX_BYTES, RESUME_MIME_TYPES } = require('./constants');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// True only when all three keys are present.
const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'job-portal/resumes',
    resource_type: 'auto',
    // Keep a readable, unique-ish public id.
    public_id: (req, file) =>
      `resume-${Date.now()}-${file.originalname.replace(/\.[^.]+$/, '')}`,
  },
});

// Without credentials we still parse the multipart body (so the other fields
// validate normally) but keep the file in memory and reject it with a clear
// message below, instead of failing deep inside the Cloudinary SDK.
const storage = isConfigured ? cloudinaryStorage : multer.memoryStorage();

const uploadResume = multer({
  storage,
  limits: { fileSize: RESUME_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (RESUME_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    // Tagged so the wrapper below answers 400 instead of a generic 500.
    const err = new Error('Resume must be a PDF or Word document');
    err.status = 400;
    err.field = 'resume';
    return cb(err);
  },
});

const badRequest = (res, status, message) =>
  res.status(status).json({
    success: false,
    data: null,
    message,
    errors: { resume: message },
  });

// Wraps multer so upload problems become clean 400s. Previously a rejected file
// type threw a plain Error and the central handler turned it into a 500.
const uploadResumeField = (req, res, next) => {
  uploadResume.single('resume')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? `Resume must be ${Math.round(RESUME_MAX_BYTES / (1024 * 1024))} MB or smaller`
            : err.code === 'LIMIT_UNEXPECTED_FILE'
              ? 'Unexpected file field — attach the resume as "resume"'
              : `Upload error: ${err.message}`;
        return badRequest(res, 400, message);
      }
      return badRequest(res, err.status || 400, err.message);
    }

    if (req.file && !isConfigured) {
      return badRequest(
        res,
        503,
        'Resume file upload is not configured on this server. Please provide a resume link instead.'
      );
    }

    return next();
  });
};

module.exports = { cloudinary, uploadResume, uploadResumeField, isConfigured };
