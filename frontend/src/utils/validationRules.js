/**
 * Client-side mirror of backend/src/validation/schemas.js.
 *
 * The backend is authoritative — it re-validates everything. These rules exist
 * so the user gets instant feedback instead of a round trip. Every limit here
 * MUST match the backend value; if you change one, change both.
 *
 * Each rule is (value, allValues) => errorMessage | ''  — the shape
 * useFormValidation expects.
 */

export const EMAIL_RE = /^\S+@\S+\.\S+$/;
export const PHONE_RE = /^[+]?[0-9\s()-]{7,20}$/;
export const URL_RE = /^https?:\/\/.+/i;

// Kept in one place so inputs can share maxLength/char-count with the validator.
export const LIMITS = {
  name: { min: 2, max: 80 },
  email: { max: 254 },
  password: { min: 6, max: 72 },
  title: { min: 3, max: 120 },
  company: { min: 2, max: 100 },
  description: { min: 20, max: 3000 },
  location: { max: 120 },
  experience: { max: 80 },
  stipendOrSalary: { max: 100 },
  url: { max: 500 },
  coverNote: { max: 1000 },
  phone: { max: 20 },
  requirements: { maxItems: 12, maxLength: 80 },
  search: { max: 100 },
  resumeMaxBytes: 5 * 1024 * 1024,
  otp: { length: 6 },
};

export const RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/* ── generic builders ── */

// Required free text with a length window.
export const required = (label, { min = 0, max = 255 } = {}) => (value) => {
  const t = text(value);
  if (!t) return `${label} is required`;
  if (min && t.length < min) return `${label} must be at least ${min} characters`;
  if (t.length > max) return `${label} must be ${max} characters or less`;
  return '';
};

// Optional free text with an upper bound only.
export const optional = (label, { max = 255 } = {}) => (value) => {
  const t = text(value);
  if (t.length > max) return `${label} must be ${max} characters or less`;
  return '';
};

// Must be one of `values` — used for selects so a tampered <option> is caught.
export const oneOf = (label, values, { isRequired = true } = {}) => (value) => {
  const t = text(value);
  if (!t) return isRequired ? `${label} is required` : '';
  if (values.length > 0 && !values.includes(t)) return `Select a valid ${label.toLowerCase()}`;
  return '';
};

/* ── concrete field rules ── */

export const nameRule = required('Name', LIMITS.name);

export const emailRule = (value) => {
  const t = text(value);
  if (!t) return 'Email is required';
  if (!EMAIL_RE.test(t)) return 'Enter a valid email address';
  if (t.length > LIMITS.email.max) return 'Email is too long';
  return '';
};

// Registration: full policy. Not trimmed for length purposes because the
// backend trims too, so a spaces-only password correctly reads as missing.
export const passwordRule = (value) => {
  const t = text(value);
  if (!t) return 'Password is required';
  if (t.length < LIMITS.password.min)
    return `Password must be at least ${LIMITS.password.min} characters`;
  if (t.length > LIMITS.password.max)
    return `Password must be ${LIMITS.password.max} characters or less`;
  return '';
};

// Login: presence only — echoing the length policy per attempt is pointless
// and mirrors the backend, which also only checks presence here.
export const passwordPresenceRule = (value) => (text(value) ? '' : 'Password is required');

// Mirrors the backend's verifyEmailSchema: exactly six digits.
export const otpRule = (value) => {
  const t = text(value);
  if (!t) return 'Verification code is required';
  if (!/^\d{6}$/.test(t)) return 'Verification code must be 6 digits';
  return '';
};

// Factory (like urlRule) so the caller states whether phone is mandatory.
export const phoneRule = ({ isRequired = false } = {}) => (value) => {
  const t = text(value);
  if (!t) return isRequired ? 'Phone is required' : '';
  if (!PHONE_RE.test(t)) return 'Enter a valid phone number';
  return '';
};

export const urlRule = (label, { isRequired = false } = {}) => (value) => {
  const t = text(value);
  if (!t) return isRequired ? `${label} is required` : '';
  if (t.length > LIMITS.url.max) return `${label} must be ${LIMITS.url.max} characters or less`;
  if (!URL_RE.test(t)) return `${label} must be a valid URL starting with http:// or https://`;
  return '';
};

// Comma-separated input -> validated against the array limits the backend uses.
export const requirementsRule = (value) => {
  const items = splitRequirements(value);
  if (items.length > LIMITS.requirements.maxItems)
    return `Max ${LIMITS.requirements.maxItems} requirements allowed`;
  if (items.some((item) => item.length > LIMITS.requirements.maxLength))
    return `Each requirement must be ${LIMITS.requirements.maxLength} characters or less`;
  return '';
};

export const splitRequirements = (value) =>
  typeof value === 'string'
    ? value.split(',').map((s) => s.trim()).filter(Boolean)
    : Array.isArray(value)
      ? value.map((s) => String(s).trim()).filter(Boolean)
      : [];

/* ── resume file ── */

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Mirrors multer's fileFilter + limits so the user learns about a bad file
// before uploading megabytes of it.
export function validateResumeFile(file) {
  if (!file) return '';
  if (!RESUME_MIME_TYPES.includes(file.type))
    return 'Only PDF and Word documents are allowed';
  if (file.size > LIMITS.resumeMaxBytes)
    return `File is too large (${formatFileSize(file.size)}). Max ${formatFileSize(LIMITS.resumeMaxBytes)}.`;
  return '';
}

/* ── server error plumbing ── */

/**
 * Maps a failed API response onto form fields.
 * The backend answers { message, errors: { field: msg } }, so field-level
 * rejections land on the right input instead of only in a banner.
 *
 * @returns the banner message for anything not tied to a known field.
 */
export function applyServerErrors(err, setFieldError, knownFields = []) {
  const data = err?.response?.data;
  const fallback = data?.message || 'Something went wrong. Please try again.';
  const fieldErrors = data?.errors;

  if (!fieldErrors || typeof fieldErrors !== 'object') return fallback;

  const unmatched = [];
  for (const [field, message] of Object.entries(fieldErrors)) {
    if (knownFields.length === 0 || knownFields.includes(field)) {
      setFieldError(field, message);
    } else {
      unmatched.push(message);
    }
  }
  return unmatched.length > 0 ? unmatched.join(' ') : fallback;
}
