// One Joi schema per endpoint. This file is the single source of truth for what
// the API accepts; the frontend rules in src/utils/validationRules.js mirror it
// field for field so the two sides can never drift apart silently.
//
// The Mongoose models deliberately carry NO `required` validators — every rule
// lives here, at the request boundary. That keeps one authority for validation
// and avoids a second, slightly-different rulebook running at save time.

const {
  Joi,
  requiredText,
  optionalText,
  email,
  password,
  passwordPresence,
  objectId,
  enumOf,
  url,
  phone,
  list,
} = require('./joiTypes');
const {
  DOMAINS,
  OPPORTUNITY_TYPES,
  APPLICATION_STATUSES,
} = require('../config/constants');

/* ────────────────────────── auth ────────────────────────── */

const registerSchema = {
  body: Joi.object({
    name: requiredText('Name', { min: 2, max: 80 }),
    email: email(),
    password: password(),
  }),
};

const loginSchema = {
  body: Joi.object({
    email: email(),
    password: passwordPresence(),
  }),
};

const refreshSchema = {
  body: Joi.object({
    refreshToken: requiredText('Refresh token', { max: 1000 }),
  }),
};

/* ─────────────────────── opportunities ─────────────────────── */

// Shared by create (POST) and replace (PUT) — both send the full record.
const opportunityBody = Joi.object({
  title: requiredText('Title', { min: 3, max: 120 }),
  company: requiredText('Company', { min: 2, max: 100 }),
  domain: enumOf('Domain', DOMAINS),
  type: enumOf('Type', OPPORTUNITY_TYPES),
  description: requiredText('Description', { min: 20, max: 3000 }),
  location: optionalText('Location', { max: 120 }),
  experience: optionalText('Experience', { max: 80 }),
  stipendOrSalary: optionalText('Stipend / Salary', { max: 100 }),
  applicationLink: url('External application link', { max: 500 }),
  requirements: list('Requirements', { maxItems: 12, maxLength: 80 }),
});

const opportunityIdParams = Joi.object({
  id: objectId('Opportunity ID'),
});

const opportunityIdSchema = { params: opportunityIdParams };
const createOpportunitySchema = { body: opportunityBody };
const updateOpportunitySchema = { params: opportunityIdParams, body: opportunityBody };

const listOpportunitiesSchema = {
  query: Joi.object({
    // Capped because the value is fed into a RegExp (escaped first) — a long
    // pattern is both a pointless query and needless load on Mongo.
    search: optionalText('Search term', { max: 100 }),
    domain: enumOf('Domain', DOMAINS, { required: false }),
  }),
};

/* ──────────────────────── applications ──────────────────────── */

const createApplicationSchema = {
  body: Joi.object({
    opportunityId: objectId('Opportunity ID'),
    name: requiredText('Name', { min: 2, max: 80 }),
    email: email(),
    phone: phone('Phone', { required: true }),
    coverNote: optionalText('Cover note', { max: 1000 }),
    resumeLink: url('Resume link', { max: 500 }),
  }),
  // A resume is mandatory, but it can arrive either as an uploaded file
  // (multer has already put it on req.file) or as an external link.
  refine: (req, valid) => {
    if (req.file) {
      valid.body.resumeLink = req.file.path;
      return null;
    }
    if (!valid.body.resumeLink) {
      return { resume: 'Upload a resume file or provide a resume link' };
    }
    return null;
  },
};

const listApplicationsSchema = {
  query: Joi.object({
    opportunityId: objectId('Opportunity ID', { required: false }),
    status: enumOf('Status', APPLICATION_STATUSES, { required: false }),
    domain: enumOf('Domain', DOMAINS, { required: false }),
    company: optionalText('Company search', { max: 100 }),
  }),
};

const updateApplicationStatusSchema = {
  params: Joi.object({ id: objectId('Application ID') }),
  body: Joi.object({ status: enumOf('Status', APPLICATION_STATUSES) }),
};

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  createOpportunitySchema,
  updateOpportunitySchema,
  opportunityIdSchema,
  listOpportunitiesSchema,
  createApplicationSchema,
  listApplicationsSchema,
  updateApplicationStatusSchema,
};
