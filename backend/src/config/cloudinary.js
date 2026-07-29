// Cloudinary setup + a Multer instance that uploads resume files straight to
// Cloudinary. Credentials come from .env (see .env.example).
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

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

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'job-portal/resumes',
    resource_type: 'auto',
    // Keep a readable, unique-ish public id.
    public_id: (req, file) =>
      `resume-${Date.now()}-${file.originalname.replace(/\.[^.]+$/, '')}`,
  },
});

const uploadResume = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Resume must be a PDF or Word document'));
  },
});

module.exports = { cloudinary, uploadResume, isConfigured };
