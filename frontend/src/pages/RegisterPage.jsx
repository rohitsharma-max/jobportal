import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useFormValidation from '../hooks/useFormValidation';
import FormField from '../components/FormField';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/* ── Password strength helper ── */
function getStrength(pw) {
  if (!pw) return { level: 0, label: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { level: 1, label: 'Weak' };
  if (score <= 3) return { level: 2, label: 'Medium' };
  return { level: 3, label: 'Strong' };
}
const strengthCls = ['', 'weak', 'medium', 'strong'];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      password: (v) => {
        if (!v) return 'Password is required';
        if (v.length < 6) return 'Password must be at least 6 characters';
        if (v.length > 72) return 'Password must be 72 characters or less';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate(form)) {
      toast('Please fix the errors below', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      toast('Account created successfully!', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      setServerError(msg);
      toast(msg, 'error');
      setSubmitting(false);
    }
  };

  const strength = getStrength(form.password);

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h1 style={{ fontSize: '1.5rem' }}>Create account</h1>
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
            placeholder="Rohit Sharma"
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
            placeholder="you@example.com"
            autoComplete="email"
          />
        </FormField>

        <FormField label="Password" name="password" error={errors.password} required>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.password ? 'field-invalid' : ''}
            placeholder="Min 6 characters"
            autoComplete="new-password"
          />
          {/* Password strength indicator */}
          {form.password && (
            <>
              <div className="password-strength">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className={`str-bar${strength.level >= n ? ` active-${strengthCls[strength.level]}` : ''}`}
                  />
                ))}
              </div>
              <span className={`str-label str-${strengthCls[strength.level]}`}>
                {strength.label}
              </span>
            </>
          )}
        </FormField>

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating…' : 'Register'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        Already have an account? <Link to="/login" className="back-link" style={{ margin: 0 }}>Log in</Link>
      </p>
    </div>
  );
}
