import { useState, useEffect } from 'react';
import api from '../api/axios';

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
  requirements: '', // comma-separated string in the UI, converted to array on submit
};

// One form for both Add and Edit. `initial` pre-fills it (Edit mode);
// `onSubmit` receives a clean payload with requirements as an array.
export default function OpportunityForm({ initial, onSubmit, submitting, submitLabel = 'Save' }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    const next = {};
    ['title', 'company', 'domain', 'type', 'description'].forEach((f) => {
      if (!String(form[f]).trim()) next[f] = 'Required';
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      ...form,
      requirements: form.requirements
        ? form.requirements.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };
    onSubmit(payload);
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-row">
        <div className="field">
          <label>Title <span className="req">*</span></label>
          <input name="title" value={form.title} onChange={handleChange} />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </div>
        <div className="field">
          <label>Company <span className="req">*</span></label>
          <input name="company" value={form.company} onChange={handleChange} />
          {errors.company && <span className="field-error">{errors.company}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Domain <span className="req">*</span></label>
          <select name="domain" value={form.domain} onChange={handleChange}>
            <option value="">Select a domain</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {errors.domain && <span className="field-error">{errors.domain}</span>}
        </div>
        <div className="field">
          <label>Type <span className="req">*</span></label>
          <select name="type" value={form.type} onChange={handleChange}>
            <option value="">Select a type</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.type && <span className="field-error">{errors.type}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Location</label>
          <input name="location" value={form.location} onChange={handleChange} />
        </div>
        <div className="field">
          <label>Experience</label>
          <input name="experience" placeholder="e.g. Fresher, 1-2 years" value={form.experience} onChange={handleChange} />
        </div>
      </div>

      <div className="field">
        <label>Description <span className="req">*</span></label>
        <textarea name="description" value={form.description} onChange={handleChange} />
        {errors.description && <span className="field-error">{errors.description}</span>}
      </div>

      <div className="form-row">
        <div className="field">
          <label>Stipend / Salary</label>
          <input name="stipendOrSalary" placeholder="e.g. INR 15,000/month" value={form.stipendOrSalary} onChange={handleChange} />
        </div>
        <div className="field">
          <label>External application link</label>
          <input name="applicationLink" placeholder="https://…" value={form.applicationLink} onChange={handleChange} />
        </div>
      </div>

      <div className="field">
        <label>Requirements (comma-separated)</label>
        <input name="requirements" placeholder="React, Node.js, MongoDB" value={form.requirements} onChange={handleChange} />
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
