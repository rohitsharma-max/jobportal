import { useState, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useFormValidation from '../hooks/useFormValidation';
import FormField from '../components/FormField';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = location.state?.from || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validators = useMemo(
    () => ({
      email: (v) => {
        if (!v?.trim()) return 'Email is required';
        if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address';
        return '';
      },
      password: (v) => {
        if (!v) return 'Password is required';
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
      const user = await login(form.email.trim(), form.password);
      toast('Logged in successfully!', 'success');
      navigate(user.role === 'admin' ? '/admin' : from, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      setServerError(msg);
      toast(msg, 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h1 style={{ fontSize: '1.5rem' }}>Log in</h1>
      {serverError && <div className="alert alert-error">{serverError}</div>}
      <form className="form" onSubmit={handleSubmit} noValidate>
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
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </FormField>

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        No account? <Link to="/register" className="back-link" style={{ margin: 0 }}>Register</Link>
      </p>
    </div>
  );
}
