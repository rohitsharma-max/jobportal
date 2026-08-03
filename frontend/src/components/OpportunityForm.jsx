import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import FormField, { fieldProps } from './FormField';
import useFormValidation from '../hooks/useFormValidation';
import {
  required,
  optional,
  oneOf,
  urlRule,
  requirementsRule,
  splitRequirements,
  LIMITS,
} from '../utils/validationRules';

const TYPES = ['Internship', 'Job'];

const EMPTY = {
  title: '',
  company: '',
  domain: '',
  type: '',
  location: '',
  experience: '',
  description: '',
  stipendOrSalary: '',
  applicationLink: '',
  requirements: '',
};

// One form for both Add and Edit. `initial` pre-fills it (Edit mode);
// `onSubmit` receives a clean payload with requirements as an array.
// `serverErrors` maps a field name to a backend message so a rejection from the
// API highlights the offending input instead of only showing a banner.
export default function OpportunityForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = 'Save',
  serverErrors,
}) {
  const [form, setForm] = useState(EMPTY);
  const [domains, setDomains] = useState([]);
  const [domainsError, setDomainsError] = useState('');

  useEffect(() => {
    api
      .get('/domains')
      .then((res) => {
        setDomains(res.data.data);
        setDomainsError('');
      })
      .catch(() => {
        setDomains([]);
        // Previously this failed silently and left an unusable empty dropdown.
        setDomainsError('Could not load the domain list. Reload the page to try again.');
      });
  }, []);

  // When editing, load the existing values (requirements array -> comma string).
  useEffect(() => {
    if (initial) {
      setForm({
        ...EMPTY,
        ...initial,
        requirements: Array.isArray(initial.requirements)
          ? initial.requirements.join(', ')
          : initial.requirements || '',
      });
    }
  }, [initial]);

  // Rules come from the shared module so they always match the backend schema.
  // domain/type are checked against the allowed values, not just non-empty, so a
  // tampered <option> is rejected here rather than only by the API.
  const validators = useMemo(
    () => ({
      title: required('Title', LIMITS.title),
      company: required('Company', LIMITS.company),
      domain: oneOf('Domain', domains),
      type: oneOf('Type', TYPES),
      description: required('Description', LIMITS.description),
      location: optional('Location', LIMITS.location),
      experience: optional('Experience', LIMITS.experience),
      stipendOrSalary: optional('Stipend / Salary', LIMITS.stipendOrSalary),
      applicationLink: urlRule('External application link'),
      requirements: requirementsRule,
    }),
    [domains],
  );

  const { errors, validate, validateField, clearFieldError, setFieldError } =
    useFormValidation(validators);

  // Surface backend field errors on the matching inputs.
  useEffect(() => {
    if (!serverErrors) return;
    for (const [field, message] of Object.entries(serverErrors)) {
      setFieldError(field, message);
    }
  }, [serverErrors, setFieldError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };

  const handleBlur = (e) => validateField(e.target.name, form[e.target.name], form);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate(form)) return;
    const payload = {
      ...form,
      requirements: splitRequirements(form.requirements),
    };
    onSubmit(payload);
  };

  const reqCount = splitRequirements(form.requirements).length;
  // Nothing can be created without a valid domain, so block submit until the
  // list is available rather than letting the API reject it.
  const blocked = submitting || Boolean(domainsError);

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {domainsError && <div className="alert alert-error">{domainsError}</div>}

      <div className="form-row">
        <FormField label="Title" name="title" error={errors.title} required charCount={form.title.trim().length} maxLength={LIMITS.title.max}>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={LIMITS.title.max}
            placeholder="e.g. Frontend Developer Intern"
            {...fieldProps('title', errors.title, true)}
          />
        </FormField>
        <FormField label="Company" name="company" error={errors.company} required charCount={form.company.trim().length} maxLength={LIMITS.company.max}>
          <input
            id="company"
            name="company"
            value={form.company}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={LIMITS.company.max}
            placeholder="e.g. Google"
            {...fieldProps('company', errors.company, true)}
          />
        </FormField>
      </div>

      <div className="form-row">
        <FormField label="Domain" name="domain" error={errors.domain} required>
          <select
            id="domain"
            name="domain"
            value={form.domain}
            onChange={handleChange}
            onBlur={handleBlur}
            {...fieldProps('domain', errors.domain, true)}
          >
            <option value="">Select a domain</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Type" name="type" error={errors.type} required>
          <select
            id="type"
            name="type"
            value={form.type}
            onChange={handleChange}
            onBlur={handleBlur}
            {...fieldProps('type', errors.type, true)}
          >
            <option value="">Select a type</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="form-row">
        <FormField label="Location" name="location" error={errors.location} charCount={form.location.trim().length} maxLength={LIMITS.location.max}>
          <input
            id="location"
            name="location"
            value={form.location}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={LIMITS.location.max}
            placeholder="e.g. Remote, Bangalore"
            {...fieldProps('location', errors.location)}
          />
        </FormField>
        <FormField label="Experience" name="experience" error={errors.experience} charCount={form.experience.trim().length} maxLength={LIMITS.experience.max}>
          <input
            id="experience"
            name="experience"
            value={form.experience}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={LIMITS.experience.max}
            placeholder="e.g. Fresher, 1-2 years"
            {...fieldProps('experience', errors.experience)}
          />
        </FormField>
      </div>

      <FormField label="Description" name="description" error={errors.description} required charCount={form.description.trim().length} maxLength={LIMITS.description.max}>
        <textarea
          id="description"
          name="description"
          value={form.description}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={LIMITS.description.max}
          placeholder="Describe the role, responsibilities, and expectations…"
          {...fieldProps('description', errors.description, true)}
        />
      </FormField>

      <div className="form-row">
        <FormField label="Stipend / Salary" name="stipendOrSalary" error={errors.stipendOrSalary} charCount={form.stipendOrSalary.trim().length} maxLength={LIMITS.stipendOrSalary.max}>
          <input
            id="stipendOrSalary"
            name="stipendOrSalary"
            value={form.stipendOrSalary}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={LIMITS.stipendOrSalary.max}
            placeholder="e.g. INR 15,000/month"
            {...fieldProps('stipendOrSalary', errors.stipendOrSalary)}
          />
        </FormField>
        <FormField label="External application link" name="applicationLink" error={errors.applicationLink}>
          <input
            id="applicationLink"
            name="applicationLink"
            type="url"
            value={form.applicationLink}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={LIMITS.url.max}
            placeholder="https://…"
            {...fieldProps('applicationLink', errors.applicationLink)}
          />
        </FormField>
      </div>

      <FormField
        label="Requirements (comma-separated)"
        name="requirements"
        error={errors.requirements}
        hint={`${reqCount}/${LIMITS.requirements.maxItems} items`}
      >
        <input
          id="requirements"
          name="requirements"
          value={form.requirements}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="React, Node.js, MongoDB"
          {...fieldProps('requirements', errors.requirements, false, true)}
        />
      </FormField>

      <button type="submit" className="btn btn-primary" disabled={blocked}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
