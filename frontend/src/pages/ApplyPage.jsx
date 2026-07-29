import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function ApplyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [opp, setOpp] = useState(null);
  const [loadingOpp, setLoadingOpp] = useState(true);

  const [form, setForm] = useState({ name: '', email: '', phone: '', coverNote: '' });
  const [resumeFile, setResumeFile] = useState(null);
  const [errors, setErrors] = useState({});
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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!EMAIL_RE.test(form.email)) next.email = 'Enter a valid email';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Multipart form data so we can include the resume file.
      const data = new FormData();
      data.append('opportunityId', id);
      data.append('name', form.name);
      data.append('email', form.email);
      data.append('phone', form.phone);
      data.append('coverNote', form.coverNote);
      if (resumeFile) data.append('resume', resumeFile);

      await api.post('/applications', data);
      navigate('/confirmation');
    } catch (err) {
      setServerError(err.response?.data?.message || 'Submission failed. Please try again.');
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
          <div className="field">
            <label>Full name <span className="req">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="field">
            <label>Email <span className="req">*</span></label>
            <input name="email" type="email" value={form.email} onChange={handleChange} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="field">
            <label>Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} />
          </div>

          <div className="field">
            <label>Resume (PDF or Word, max 5 MB)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResumeFile(e.target.files[0] || null)}
            />
          </div>

          <div className="field">
            <label>Cover note</label>
            <textarea name="coverNote" value={form.coverNote} onChange={handleChange} />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        </form>
      </div>
    </>
  );
}
