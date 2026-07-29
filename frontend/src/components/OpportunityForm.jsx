import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import FormField from './FormField';
import useFormValidation from '../hooks/useFormValidation';

const TYPES = ['Internship', 'Job'];
const URL_RE = /^https?:\/\/.+/i;

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
export default function OpportunityForm({ initial, onSubmit, submitting, submitLabel = 'Save' }) {
  const [form, setForm] = useState(EMPTY);
  const [domains, setDomains] = useState([]);

  useEffect(() => {
    api
      .get('/domains')
      .then((res) => setDomains(res.data.data))
      .catch(() => setDomains([]));
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

  const validators = useMemo(
    () => ({
      title: (v) => {
        const t = v?.trim() || '';
        if (!t) return 'Title is required';
        if (t.length < 3) return 'Title must be at least 3 characters';
        if (t.length > 120) return 'Title must be 120 characters or less';
        return '';
      },
      company: (v) => {
        const t = v?.trim() || '';
        if (!t) return 'Company is required';
        if (t.length < 2) return 'Company must be at least 2 characters';
        if (t.length > 100) return 'Company must be 100 characters or less';
        return '';
      },
      domain: (v) => {
        if (!v?.trim()) return 'Domain is required';
        return '';
      },
      type: (v) => {
        if (!v?.trim()) return 'Type is required';
        return '';
      },
      description: (v) => {
        const t = v?.trim() || '';
        if (!t) return 'Description is required';
        if (t.length < 20) return `Description needs at least 20 characters (${t.length}/20)`;
        if (t.length > 3000) return 'Description must be 3000 characters or less';
        return '';
      },
      location: (v) => {
        if (v && v.trim().length > 120) return 'Location must be 120 characters or less';
        return '';
      },
      experience: (v) => {
        if (v && v.trim().length > 80) return 'Experience must be 80 characters or less';
        return '';
      },
      stipendOrSalary: (v) => {
        if (v && v.trim().length > 100) return 'Must be 100 characters or less';
        return '';
      },
      applicationLink: (v) => {
        const t = v?.trim() || '';
        if (t && !URL_RE.test(t)) return 'Must be a valid URL (https://…)';
        if (t.length > 500) return 'URL is too long';
        return '';
      },
      requirements: (v) => {
        if (!v) return '';
        const items = v.split(',').map((s) => s.trim()).filter(Boolean);
        if (items.length > 12) return 'Max 12 requirements allowed';
        const tooLong = items.find((s) => s.length > 80);
        if (tooLong) return 'Each requirement must be 80 characters or less';
        return '';
      },
    }),
    [],
  );

  const { errors, validate, validateField, clearFieldError } =
    useFormValidation(validators);

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
      requirements: form.requirements
        ? form.requirements.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };
    onSubmit(payload);
  };

  const reqCount = form.requirements
    ? form.requirements.split(',').map((s) => s.trim()).filter(Boolean).length
    : 0;

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-row">
        <FormField label="Title" name="title" error={errors.title} required charCount={form.title.trim().length} maxLength={120}>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.title ? 'field-invalid' : ''}
            placeholder="e.g. Frontend Developer Intern"
          />
        </FormField>
        <FormField label="Company" name="company" error={errors.company} required charCount={form.company.trim().length} maxLength={100}>
          <input
            id="company"
            name="company"
            value={form.company}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.company ? 'field-invalid' : ''}
            placeholder="e.g. Google"
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
            className={errors.domain ? 'field-invalid' : ''}
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
            className={errors.type ? 'field-invalid' : ''}
          >
            <option value="">Select a type</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="form-row">
        <FormField label="Location" name="location" error={errors.location} charCount={form.location.trim().length} maxLength={120}>
          <input
            id="location"
            name="location"
            value={form.location}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.location ? 'field-invalid' : ''}
            placeholder="e.g. Remote, Bangalore"
          />
        </FormField>
        <FormField label="Experience" name="experience" error={errors.experience} charCount={form.experience.trim().length} maxLength={80}>
          <input
            id="experience"
            name="experience"
            value={form.experience}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.experience ? 'field-invalid' : ''}
            placeholder="e.g. Fresher, 1-2 years"
          />
        </FormField>
      </div>

      <FormField label="Description" name="description" error={errors.description} required charCount={form.description.trim().length} maxLength={3000}>
        <textarea
          id="description"
          name="description"
          value={form.description}
          onChange={handleChange}
          onBlur={handleBlur}
          className={errors.description ? 'field-invalid' : ''}
          placeholder="Describe the role, responsibilities, and expectations…"
        />
      </FormField>

      <div className="form-row">
        <FormField label="Stipend / Salary" name="stipendOrSalary" error={errors.stipendOrSalary} charCount={form.stipendOrSalary.trim().length} maxLength={100}>
          <input
            id="stipendOrSalary"
            name="stipendOrSalary"
            value={form.stipendOrSalary}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.stipendOrSalary ? 'field-invalid' : ''}
            placeholder="e.g. INR 15,000/month"
          />
        </FormField>
        <FormField label="External application link" name="applicationLink" error={errors.applicationLink}>
          <input
            id="applicationLink"
            name="applicationLink"
            value={form.applicationLink}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.applicationLink ? 'field-invalid' : ''}
            placeholder="https://…"
          />
        </FormField>
      </div>

      <FormField
        label="Requirements (comma-separated)"
        name="requirements"
        error={errors.requirements}
        hint={`${reqCount}/12 items`}
      >
        <input
          id="requirements"
          name="requirements"
          value={form.requirements}
          onChange={handleChange}
          onBlur={handleBlur}
          className={errors.requirements ? 'field-invalid' : ''}
          placeholder="React, Node.js, MongoDB"
        />
      </FormField>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
