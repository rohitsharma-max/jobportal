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

// An opportunity's lifecycle. Only `open` listings are publicly visible or
// accept applications; the rest are admin-only views of the same record.
//
//   draft    — being written, not published yet
//   open     — live and accepting applications
//   closed   — filled or paused; still visible to admin, no new applications
//   archived — what DELETE does instead of destroying the row, so applicants
//              keep their history (see OPPORTUNITY_PUBLIC_STATUS)
const OPPORTUNITY_STATUSES = ['draft', 'open', 'closed', 'archived'];
const OPPORTUNITY_PUBLIC_STATUS = 'open';

// The only statuses an application can hold. Single source of truth for the
// model enum, the validation schemas, and the stats aggregation.
const APPLICATION_STATUSES = ['Pending', 'Approved', 'Rejected'];

// Pagination. Every list endpoint accepts ?page= and ?limit=; the caps stop a
// client from asking for the whole collection in one request, which is what the
// endpoints used to return unconditionally.
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const MAX_ADMIN_PAGE_SIZE = 100;

// Resume upload constraints — mirrored by the frontend file picker.
const RESUME_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Email-verification OTP. A 6-digit code is only 10^6 possibilities, so the
// short TTL, the resend cooldown, and above all OTP_MAX_ATTEMPTS are what make
// it safe — not the code's own entropy.
const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends
const OTP_MAX_ATTEMPTS = 5; // wrong guesses before the code is burned

module.exports = {
  DOMAINS,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_PUBLIC_STATUS,
  APPLICATION_STATUSES,
  RESUME_MAX_BYTES,
  RESUME_MIME_TYPES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_ADMIN_PAGE_SIZE,
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
};
