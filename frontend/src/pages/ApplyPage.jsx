import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import Loader from '../components/Loader';
import FormField, { fieldProps } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useFormValidation from '../hooks/useFormValidation';
import {
  nameRule,
  emailRule,
  phoneRule,
  urlRule,
  optional,
  validateResumeFile,
  formatFileSize,
  applyServerErrors,
  LIMITS,
} from '../utils/validationRules';

const RESUME_REQUIRED_MESSAGE = 'Upload a resume file or provide a resume link';

export default function ApplyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [opp, setOpp] = useState(null);
  const [loadingOpp, setLoadingOpp] = useState(true);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    coverNote: '',
    resumeLink: '',
  });
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

  // Rules come from the shared module so they always match the backend schema.
  const validators = useMemo(
    () => ({
      name: nameRule,
      email: emailRule,
      phone: phoneRule({ isRequired: true }),
      coverNote: optional('Cover note', LIMITS.coverNote),
      resumeLink: urlRule('Resume link'),
    }),
    [],
  );

  const { errors, validate, validateField, clearFieldError, setFieldError } =
    useFormValidation(validators);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name);
    // Typing a link satisfies the "file or link" requirement.
    if (name === 'resumeLink' && fileError === RESUME_REQUIRED_MESSAGE) setFileError('');
    if (serverError) setServerError('');
  };

  const handleBlur = (e) => validateField(e.target.name, form[e.target.name], form);

  const handleFileChange = (e) => {
    const file = e.target.files[0] || null;
    // Same MIME/size rules multer enforces, checked before the upload starts.
    const error = validateResumeFile(file);
    setFileError(error);
    setResumeFile(error ? null : file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const valid = validate(form);

    // A resume is mandatory, and it may arrive as either a file or a link.
    const hasResume = Boolean(resumeFile) || Boolean(form.resumeLink.trim());
    if (!hasResume) {
      setFileError(RESUME_REQUIRED_MESSAGE);
      toast(RESUME_REQUIRED_MESSAGE, 'error');
      return;
    }
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
      // An uploaded file wins; the backend overwrites resumeLink with its URL.
      if (resumeFile) data.append('resume', resumeFile);
      else data.append('resumeLink', form.resumeLink.trim());

      await api.post('/applications', data);
      toast('Application submitted successfully!', 'success');
      navigate('/confirmation');
    } catch (err) {
      // 409 = the unique (userId, opportunityId) index rejected a repeat apply.
      if (err.response?.status === 409) {
        const msg = err.response.data?.message || 'You have already applied to this opportunity';
        setServerError(msg);
        toast(msg, 'error');
        setSubmitting(false);
        return;
      }
      const msg = applyServerErrors(err, setFieldError, [
        'name',
        'email',
        'phone',
        'coverNote',
        'resumeLink',
      ]);
      // The backend reports the file-or-link rule under "resume".
      if (err.response?.data?.errors?.resume) {
        setFileError(err.response.data.errors.resume);
      }
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
              maxLength={LIMITS.name.max}
              autoComplete="name"
              {...fieldProps('name', errors.name, true)}
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
              maxLength={LIMITS.email.max}
              autoComplete="email"
              {...fieldProps('email', errors.email, true)}
            />
          </FormField>

          <FormField
            label="Phone"
            name="phone"
            error={errors.phone}
            required
            hint="e.g. +91 98765 43210"
          >
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={LIMITS.phone.max}
              autoComplete="tel"
              {...fieldProps('phone', errors.phone, true, true)}
            />
          </FormField>

          <FormField
            label={`Resume (PDF or Word, max ${formatFileSize(LIMITS.resumeMaxBytes)})`}
            name="resume"
            error={fileError}
            required
            hint="Upload a file, or paste a link to your resume below."
          >
            <input
              id="resume"
              name="resume"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              {...fieldProps('resume', fileError, false, true)}
            />
            {resumeFile && !fileError && (
              <div className="file-info">
                <span className="file-name">{resumeFile.name}</span>
                <span className="file-size">{formatFileSize(resumeFile.size)}</span>
              </div>
            )}
          </FormField>

          <FormField
            label="…or a resume link"
            name="resumeLink"
            error={errors.resumeLink}
            hint={
              resumeFile
                ? 'Ignored — the uploaded file will be used instead.'
                : 'e.g. a Google Drive or portfolio URL (https://…)'
            }
          >
            <input
              id="resumeLink"
              name="resumeLink"
              type="url"
              value={form.resumeLink}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={LIMITS.url.max}
              disabled={Boolean(resumeFile)}
              placeholder="https://…"
              {...fieldProps('resumeLink', errors.resumeLink, false, true)}
            />
          </FormField>

          <FormField
            label="Cover note"
            name="coverNote"
            error={errors.coverNote}
            charCount={form.coverNote.length}
            maxLength={LIMITS.coverNote.max}
          >
            <textarea
              id="coverNote"
              name="coverNote"
              value={form.coverNote}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={LIMITS.coverNote.max}
              placeholder="Tell the employer why you're a great fit…"
              {...fieldProps('coverNote', errors.coverNote)}
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
