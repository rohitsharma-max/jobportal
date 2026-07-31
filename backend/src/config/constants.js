// Shared constants used across models, controllers, and validation.

// Fixed domain list. Using a fixed set (not free text) keeps filtering consistent
// and prevents casing bugs like "web development" vs "Web Development".
const DOMAINS = [
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Machine Learning',
  'UI/UX Design',
  'DevOps',
  'Cybersecurity',
  'Marketing',
  'Finance',
  'Human Resources',
  'Content Writing',
];

const OPPORTUNITY_TYPES = ['Internship', 'Job'];

// The only statuses an application can hold. Single source of truth for the
// model enum, the validation schemas, and the stats aggregation.
const APPLICATION_STATUSES = ['Pending', 'Approved', 'Rejected'];

// Resume upload constraints — mirrored by the frontend file picker.
const RESUME_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

module.exports = {
  DOMAINS,
  OPPORTUNITY_TYPES,
  APPLICATION_STATUSES,
  RESUME_MAX_BYTES,
  RESUME_MIME_TYPES,
};
