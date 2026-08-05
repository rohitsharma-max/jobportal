import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useFormValidation from '../hooks/useFormValidation';
import FormField, { fieldProps } from '../components/FormField';
import { emailRule, applyServerErrors, LIMITS } from '../utils/validationRules';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validators = useMemo(() => ({ email: emailRule }), []);
  const { errors, validate, validateField, clearFieldError, setFieldError } =
    useFormValidation(validators);

  const handleChange = (e) => {
    setEmail(e.target.value);
    clearFieldError('email');
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const form = { email };
    if (!validate(form)) {
      toast('Please fix the errors below', 'error');
      return;
    }

    setSubmitting(true);
    const trimmed = email.trim().toLowerCase();
    try {
      const data = await forgotPassword(trimmed);
      // The server says the same thing whether or not that address has an
      // account, so this page must not claim a code was definitely sent — the
      // toast deliberately mirrors the server's hedged wording rather than
      // "check your inbox", which would be a lie for an unknown address.
      toast('If that account exists, a reset code is on its way', 'info');
      navigate('/reset-password', {
        replace: true,
        // codeJustSent seeds the resend countdown on the next page, matching how
        // RegisterPage hands off to VerifyEmailPage. It is safe to set
        // unconditionally here: unlike the register flow there is no branch
        // where this endpoint declines to send without also erroring, and the
        // countdown is the same length regardless of whether the address exists
        // (which is exactly what stops the timer from leaking that fact).
        state: { email: trimmed, devOtp: data?.devOtp, codeJustSent: true },
      });
    } catch (err) {
      // Reaching here means an operational failure (rate limit, mail server
      // down, network) — never "no such account", which is a 200.
      const msg = applyServerErrors(err, setFieldError, ['email']);
      setServerError(msg);
      toast(msg, 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="card auth-card">
      <h1>Reset your password</h1>
      <p className="muted">
        Enter the email address on your account and we&apos;ll send you a 6-digit code.
      </p>
      {serverError && <div className="alert alert-error">{serverError}</div>}
      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormField label="Email" name="email" error={errors.email} required>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={handleChange}
            onBlur={(e) => validateField('email', e.target.value, { email })}
            maxLength={LIMITS.email.max}
            placeholder="you@example.com"
            autoComplete="email"
            {...fieldProps('email', errors.email, true)}
          />
        </FormField>

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset code'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        Remembered it?{' '}
        <Link to="/login" className="back-link" style={{ margin: 0 }}>
          Back to login
        </Link>
      </p>
    </div>
  );
}
