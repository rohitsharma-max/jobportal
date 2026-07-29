import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import Loader from '../components/Loader';
import FormField from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useFormValidation from '../hooks/useFormValidation';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^[+]?[0-9\s()-]{7,20}$/;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ApplyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [opp, setOpp] = useState(null);
  const [loadingOpp, setLoadingOpp] = useState(true);

  const [form, setForm] = useState({ name: '', email: '', phone: '', coverNote: '' });
  const [resumeFile, setResumeFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Pre-fill name/email from the logged-in user's profile.
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: user.name, email: user.email }));
  }, [user]);

  useEffect(() => {
    api
      .get(`/opportunities/${id}`)
      .then((res) => setOpp(res.data.data))
      .catch(() => setOpp(null))
      .finally(() => setLoadingOpp(false));
  }, [id]);

  const validators = useMemo(
    () => ({
      name: (v) => {
        const t = v?.trim() || '';
        if (!t) return 'Name is required';
        if (t.length < 2) return 'Name must be at least 2 characters';
        if (t.length > 80) return 'Name must be 80 characters or less';
        return '';
      },
      email: (v) => {
        const t = v?.trim() || '';
        if (!t) return 'Email is required';
        if (!EMAIL_RE.test(t)) return 'Enter a valid email address';
        if (t.length > 254) return 'Email is too long';
        return '';
      },
      phone: (v) => {
        const t = v?.trim() || '';
        if (t && !PHONE_RE.test(t)) return 'Enter a valid phone number';
        return '';
      },
      coverNote: (v) => {
        if (v && v.length > 1000) return 'Cover note must be 1000 characters or less';
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
    if (serverError) setServerError('');
  };

  const handleBlur = (e) => validateField(e.target.name, form[e.target.name], form);

  const handleFileChange = (e) => {
    const file = e.target.files[0] || null;
    setFileError('');
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setFileError('Only PDF and Word documents are allowed');
        setResumeFile(null);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File is too large (${formatFileSize(file.size)}). Max 5 MB.`);
        setResumeFile(null);
        return;
      }
    }
    setResumeFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const valid = validate(form);
    if (fileError) {
      toast('Please fix the file error', 'error');
      return;
    }
    if (!valid) {
      toast('Please fix the errors below', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('opportunityId', id);
      data.append('name', form.name.trim());
      data.append('email', form.email.trim());
      data.append('phone', form.phone.trim());
      data.append('coverNote', form.coverNote);
      if (resumeFile) data.append('resume', resumeFile);

      await api.post('/applications', data);
      toast('Application submitted successfully!', 'success');
      navigate('/confirmation');
    } catch (err) {
      const msg = err.response?.data?.message || 'Submission failed. Please try again.';
      setServerError(msg);
      toast(msg, 'error');
      setSubmitting(false);
    }
  };

  if (loadingOpp) return <Loader label="Loading…" />;

  return (
    <>
      <Link to={`/opportunities/${id}`} className="back-link">
        ← Back to details
      </Link>

      <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Apply</h1>
        {opp && (
          <p className="muted" style={{ marginTop: -8, marginBottom: 20 }}>
            For <strong>{opp.title}</strong> at {opp.company}
          </p>
        )}

        {serverError && <div className="alert alert-error">{serverError}</div>}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <FormField label="Full name" name="name" error={errors.name} required>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              onBlur={handleBlur}
              className={errors.name ? 'field-invalid' : ''}
              autoComplete="name"
            />
          </FormField>

          <FormField label="Email" name="email" error={errors.email} required>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              onBlur={handleBlur}
              className={errors.email ? 'field-invalid' : ''}
              autoComplete="email"
            />
          </FormField>

          <FormField
            label="Phone"
            name="phone"
            error={errors.phone}
            hint="Optional — e.g. +91 98765 43210"
          >
            <input
              id="phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              className={errors.phone ? 'field-invalid' : ''}
              autoComplete="tel"
            />
          </FormField>

          <FormField
            label="Resume (PDF or Word, max 5 MB)"
            name="resume"
            error={fileError}
          >
            <input
              id="resume"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className={fileError ? 'field-invalid' : ''}
            />
            {resumeFile && !fileError && (
              <div className="file-info">
                <span className="file-name">{resumeFile.name}</span>
                <span className="file-size">{formatFileSize(resumeFile.size)}</span>
              </div>
            )}
          </FormField>

          <FormField
            label="Cover note"
            name="coverNote"
            error={errors.coverNote}
            charCount={form.coverNote.length}
            maxLength={1000}
          >
            <textarea
              id="coverNote"
              name="coverNote"
              value={form.coverNote}
              onChange={handleChange}
              onBlur={handleBlur}
              className={errors.coverNote ? 'field-invalid' : ''}
              placeholder="Tell the employer why you're a great fit…"
            />
          </FormField>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        </form>
      </div>
    </>
  );
}
