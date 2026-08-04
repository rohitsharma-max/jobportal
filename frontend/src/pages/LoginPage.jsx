import { useState, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useFormValidation from '../hooks/useFormValidation';
import FormField, { fieldProps } from '../components/FormField';
import GoogleSignInButton from '../components/GoogleSignInButton';
import {
  emailRule,
  passwordPresenceRule,
  applyServerErrors,
  LIMITS,
} from '../utils/validationRules';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  // '/' is the public landing page now, not the list — the post-login
  // fallback (when nothing sent the user here with a specific `from`) needs
  // to be the list itself.
  const from = location.state?.from || '/opportunities';

  const [form, setForm] = useState({ email: '', password: '' });
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Rules come from the shared module so they always match the backend schema.
  const validators = useMemo(
    () => ({
      email: emailRule,
      password: passwordPresenceRule,
    }),
    [],
  );

  const { errors, validate, validateField, clearFieldError, setFieldError } =
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
      // The account exists and the password was right — it just isn't verified.
      if (err?.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        toast('Please verify your email to continue', 'info');
        // Deliberately no `codeJustSent` here: whatever code was originally
        // mailed at registration may have expired minutes or days ago, so the
        // verify page's resend cooldown should start at 0, not 60. Do not add
        // it "for consistency" with RegisterPage's redirect — that would
        // reintroduce the exact bug this comment is guarding against.
        navigate('/verify-email', {
          replace: true,
          state: { email: err.response.data.data?.email || form.email.trim().toLowerCase() },
        });
        return;
      }
      // Field-level rejections land on the matching input; anything else in the banner.
      const msg = applyServerErrors(err, setFieldError, ['email', 'password']);
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
            maxLength={LIMITS.email.max}
            placeholder="you@example.com"
            autoComplete="email"
            {...fieldProps('email', errors.email, true)}
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
            placeholder="••••••••"
            autoComplete="current-password"
            {...fieldProps('password', errors.password, true)}
          />
        </FormField>

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <GoogleSignInButton onSignedIn={(user) => navigate(user.role === 'admin' ? '/admin' : from, { replace: true })} />
      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        No account? <Link to="/register" className="back-link" style={{ margin: 0 }}>Register</Link>
      </p>
    </div>
  );
}
