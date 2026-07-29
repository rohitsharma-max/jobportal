const mongoose = require('mongoose');
const { DOMAINS, OPPORTUNITY_TYPES } = require('../config/constants');

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^[+]?[0-9\s()-]{7,20}$/;
const URL_RE = /^https?:\/\/.+/i;

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

const fail = (res, message) => {
  res.status(400);
  throw new Error(message);
};

const requireObjectId = (res, value, label = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    fail(res, `${label} is invalid`);
  }
};

const requireText = (res, value, label, min = 1, max = 120) => {
  const text = clean(value);
  if (text.length < min) fail(res, `${label} is required`);
  if (text.length > max) fail(res, `${label} must be ${max} characters or less`);
  return text;
};

const optionalText = (res, value, label, max = 300) => {
  const text = clean(value);
  if (text.length > max) fail(res, `${label} must be ${max} characters or less`);
  return text;
};

const requireEmail = (res, value) => {
  const email = clean(value).toLowerCase();
  if (!email) fail(res, 'Email is required');
  if (email.length > 254 || !EMAIL_RE.test(email)) fail(res, 'Enter a valid email');
  return email;
};

const optionalPhone = (res, value) => {
  const phone = clean(value);
  if (phone && !PHONE_RE.test(phone)) fail(res, 'Enter a valid phone number');
  return phone;
};

const optionalUrl = (res, value, label) => {
  const url = clean(value);
  if (url && (url.length > 500 || !URL_RE.test(url))) {
    fail(res, `${label} must be a valid http(s) URL`);
  }
  return url;
};

const validateRegister = (res, body) => {
  const name = requireText(res, body.name, 'Name', 2, 80);
  const email = requireEmail(res, body.email);
  const password = clean(body.password);
  if (password.length < 6) fail(res, 'Password must be at least 6 characters');
  if (password.length > 72) fail(res, 'Password must be 72 characters or less');
  return { name, email, password };
};

const validateLogin = (res, body) => {
  const email = requireEmail(res, body.email);
  const password = clean(body.password);
  if (!password) fail(res, 'Password is required');
  return { email, password };
};

const normalizeRequirements = (res, value) => {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  if (list.length > 12) fail(res, 'Requirements can contain at most 12 items');
  return list
    .map((item) => optionalText(res, item, 'Requirement', 80))
    .filter(Boolean);
};

const validateOpportunity = (res, body) => {
  const domain = requireText(res, body.domain, 'Domain', 1, 80);
  const type = requireText(res, body.type, 'Type', 1, 40);
  if (!DOMAINS.includes(domain)) fail(res, 'Select a valid domain');
  if (!OPPORTUNITY_TYPES.includes(type)) fail(res, 'Select a valid opportunity type');

  return {
    title: requireText(res, body.title, 'Title', 3, 120),
    company: requireText(res, body.company, 'Company', 2, 100),
    domain,
    type,
    location: optionalText(res, body.location, 'Location', 120),
    experience: optionalText(res, body.experience, 'Experience', 80),
    description: requireText(res, body.description, 'Description', 20, 3000),
    stipendOrSalary: optionalText(res, body.stipendOrSalary, 'Stipend / Salary', 100),
    applicationLink: optionalUrl(res, body.applicationLink, 'External application link'),
    requirements: normalizeRequirements(res, body.requirements),
  };
};

const validateApplication = (res, body, file) => {
  requireObjectId(res, body.opportunityId, 'Opportunity ID');
  const resumeLink = file ? file.path : optionalUrl(res, body.resumeLink, 'Resume link');

  return {
    opportunityId: body.opportunityId,
    name: requireText(res, body.name, 'Name', 2, 80),
    email: requireEmail(res, body.email),
    phone: optionalPhone(res, body.phone),
    coverNote: optionalText(res, body.coverNote, 'Cover note', 1000),
    resumeLink,
  };
};

const validateApplicationFilters = (res, query) => {
  const filters = {};
  if (query.opportunityId) {
    requireObjectId(res, query.opportunityId, 'Opportunity ID');
    filters.opportunityId = query.opportunityId;
  }
  if (query.status) {
    if (!['Pending', 'Approved', 'Rejected'].includes(query.status)) fail(res, 'Select a valid status');
    filters.status = query.status;
  }
  if (query.domain) {
    if (!DOMAINS.includes(query.domain)) fail(res, 'Select a valid domain');
    filters.domain = query.domain;
  }
  if (query.company) filters.company = requireText(res, query.company, 'Company search', 1, 100);
  return filters;
};

module.exports = {
  clean,
  fail,
  requireObjectId,
  requireText,
  validateApplication,
  validateApplicationFilters,
  validateLogin,
  validateOpportunity,
  validateRegister,
};
