// Small Joi building blocks with human-readable messages.
//
// Joi's default text reads like `"name" length must be at least 2 characters
// long`. These helpers produce the exact same wording the frontend shows
// (frontend/src/utils/validationRules.js), so a user never sees two different
// phrasings of the same rule.

const Joi = require('joi');

// Kept identical to the frontend regexes on purpose.
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^[+]?[0-9\s()-]{7,20}$/;
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// `string.base` fires when the value isn't a string at all — which is what a
// NoSQL injection attempt looks like, e.g. { "email": { "$gt": "" } }. Reporting
// it as "required" keeps the response from confirming anything to an attacker.
const baseMessages = (label) => ({
  'any.required': `${label} is required`,
  'string.base': `${label} is required`,
  'string.empty': `${label} is required`,
  'string.min': `${label} must be at least {#limit} characters`,
  'string.max': `${label} must be {#limit} characters or less`,
  'any.only': `Select a valid ${label.toLowerCase()}`,
});

/**
 * Required free text.
 * @param {string} label  name shown in messages
 */
const requiredText = (label, { min = 1, max = 255 } = {}) =>
  Joi.string()
    .trim()
    .min(min)
    .max(max)
    .required()
    .label(label)
    .messages(baseMessages(label));

/** Optional free text — absent or '' both normalise to ''. */
const optionalText = (label, { max = 255 } = {}) =>
  Joi.string()
    .trim()
    .max(max)
    .allow('')
    .default('')
    .label(label)
    .messages(baseMessages(label));

const email = (label = 'Email') =>
  Joi.string()
    .trim()
    .lowercase()
    .max(254)
    .pattern(EMAIL_RE)
    // Joi's own check catches malformed cases the regex lets through (`a@@b.c`).
    // Both must pass, so the server is never laxer than the client.
    .email({ tlds: { allow: false } })
    .required()
    .label(label)
    .messages({
      ...baseMessages(label),
      'string.pattern.base': 'Enter a valid email address',
      'string.email': 'Enter a valid email address',
      'string.max': 'Email is too long',
    });

/** Registration password: full length policy. */
const password = (label = 'Password', { min = 6, max = 72 } = {}) =>
  requiredText(label, { min, max });

/**
 * Login password: presence only. Echoing the length policy on every login
 * attempt tells an attacker about the policy and helps a legitimate user none.
 */
const passwordPresence = (label = 'Password') => requiredText(label, { max: 200 });

/**
 * A 6-digit one-time code. Shared by email verification and password reset so
 * the two endpoints cannot drift into accepting different shapes — the digits
 * come from the same generator (utils/otp.js) in both cases.
 *
 * The label is a parameter because the reset flow calls it a "reset code" in
 * its UI, and a message naming the wrong thing is worse than a generic one.
 */
const otpCode = (label = 'Verification code') =>
  Joi.string()
    .trim()
    .pattern(/^\d{6}$/)
    .required()
    .label(label)
    .messages({
      'any.required': `${label} is required`,
      'string.base': `${label} is required`,
      'string.empty': `${label} is required`,
      'string.pattern.base': `${label} must be 6 digits`,
    });

const objectId = (label, { required = true } = {}) => {
  const base = Joi.string()
    .trim()
    .pattern(OBJECT_ID_RE)
    .label(label)
    .messages({
      ...baseMessages(label),
      'string.pattern.base': `${label} is not a valid ID`,
    });
  // Optional filters must accept '' — a form that always submits its fields
  // sends `?opportunityId=` when the user picked nothing, and that means
  // "no filter", not "invalid id".
  return required ? base.required() : base.allow('');
};

const enumOf = (label, values, { required = true } = {}) => {
  const base = Joi.string()
    .trim()
    .valid(...values)
    .label(label)
    .messages({
      ...baseMessages(label),
      'any.only': `${label} must be one of: ${values.join(', ')}`,
    });
  // Same here: `?domain=` is an unset dropdown, not an invalid domain. Without
  // allow(''), Joi rejects it because '' isn't in the values list — which broke
  // the home page, since it always sends both query params.
  //
  // `.empty('')` on the required path makes an empty value report "Domain is
  // required" instead of the full allow-list. Joi checks valid() before its
  // string rules, so without this an empty select would produce the wrong
  // message — and a different one from the frontend's.
  return required ? base.empty('').required() : base.allow('');
};

const url = (label, { max = 500, required = false } = {}) => {
  const base = Joi.string()
    .trim()
    .max(max)
    // scheme allow-list is what rejects `javascript:alert(1)`.
    .uri({ scheme: ['http', 'https'] })
    .label(label)
    .messages({
      ...baseMessages(label),
      'string.uri': `${label} must be a valid URL starting with http:// or https://`,
      'string.uriCustomScheme': `${label} must be a valid URL starting with http:// or https://`,
    });
  return required ? base.required() : base.allow('').default('');
};

const phone = (label = 'Phone', { required = false } = {}) => {
  const base = Joi.string()
    .trim()
    .max(20)
    .pattern(PHONE_RE)
    .label(label)
    .messages({
      ...baseMessages(label),
      'string.pattern.base': 'Enter a valid phone number',
      'string.max': 'Enter a valid phone number',
    });
  return required ? base.required() : base.allow('').default('');
};

/**
 * A list that may arrive as a real array (JSON client) or as a comma-separated
 * string (the HTML form). Always yields a clean array of trimmed, non-empty
 * strings so the model never has to care which shape was sent.
 */
const list = (label, { maxItems = 12, maxLength = 80 } = {}) =>
  Joi.any()
    .custom((value, helpers) => {
      if (value === undefined || value === null || value === '') return [];

      const source = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(',')
          : null;
      if (!source) return helpers.error('list.base');

      const items = source
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);

      if (items.length > maxItems) return helpers.error('list.maxItems');
      if (items.some((item) => item.length > maxLength)) {
        return helpers.error('list.maxLength');
      }
      return items;
    })
    .default([])
    .label(label)
    .messages({
      'list.base': `${label} must be a list`,
      'list.maxItems': `${label} can contain at most ${maxItems} items`,
      'list.maxLength': `Each ${label.toLowerCase()} entry must be ${maxLength} characters or less`,
    });

/**
 * `?page=` and `?limit=` for a list endpoint.
 *
 * Both are optional with defaults, so a client that sends neither still gets a
 * bounded first page instead of the whole collection. `max` on the limit is the
 * part that matters: without it, `?limit=100000` re-opens exactly the problem
 * pagination was added to close.
 */
const pageQuery = ({ defaultLimit, maxLimit }) => ({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .empty('')
    .label('Page')
    .messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be 1 or higher',
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(maxLimit)
    .default(defaultLimit)
    .empty('')
    .label('Limit')
    .messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be 1 or higher',
      'number.max': `Limit must be ${maxLimit} or less`,
    }),
});

module.exports = {
  Joi,
  EMAIL_RE,
  PHONE_RE,
  OBJECT_ID_RE,
  requiredText,
  optionalText,
  email,
  password,
  passwordPresence,
  otpCode,
  objectId,
  enumOf,
  url,
  phone,
  list,
  pageQuery,
};
