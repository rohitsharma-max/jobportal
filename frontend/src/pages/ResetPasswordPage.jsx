import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useFormValidation from '../hooks/useFormValidation';
import FormField, { fieldProps } from '../components/FormField';
import { getStrength, strengthCls } from '../utils/passwordStrength';
import {
  otpRule,
  passwordRule,
  applyServerErrors,
  LIMITS,
} from '../utils/validationRules';

export default function ResetPasswordPage() {
  const { resetPassword, forgotPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  // Router state is the normal path; ?email= keeps a page reload from dead-ending.
  const email = location.state?.email || searchParams.get('email') || '';

  const [form, setForm] = useState({ otp: '', password: '' });
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Same reasoning as VerifyEmailPage: only assume a 60s cooldown when the
  // sender said a code was JUST mailed. A bare ?email= reload starts at 0 —
  // the server is the authority, and an over-eager 0 just gets corrected,
  // whereas an over-cautious 60 blocks a resend the server would have allowed.
  const [cooldown, setCooldown] = useState(location.state?.codeJustSent ? 60 : 0);
  const [devOtp, setDevOtp] = useState(location.state?.devOtp || '');

  const validators = useMemo(
    () => ({ otp: otpRule, password: passwordRule }),
    [],
  );
  const { errors, validate, validateField, clearFieldError, setFieldError } =
    useFormValidation(validators);

  // One self-cancelling timeout per tick rather than a long-lived interval: the
  // effect depends on `cooldown` itself, so there is no stale-closure risk and no
  // timer left running after unmount or after the countdown reaches zero.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Arriving with no email at all means the flow was entered sideways.
  if (!email) {
    return (
      <div className="card auth-card">
        <h1>Set a new password</h1>
        <div className="alert alert-error">
          We don&apos;t know which account to reset. Please start again.
        </div>
        <Link to="/forgot-password" className="btn btn-primary btn-block">
          Back to reset
        </Link>
      </div>
    );
  }

  const handleOtpChange = (e) => {
    // Digits only, capped at six: a paste of "123 456" should still work.
    setForm((prev) => ({ ...prev, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }));
    clearFieldError('otp');
    if (serverError) setServerError('');
  };

  const handlePasswordChange = (e) => {
    setForm((prev) => ({ ...prev, password: e.target.value }));
    clearFieldError('password');
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate(form)) {
      toast('Please fix the errors below', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // resetPassword() sets the password AND opens the session, so go straight
      // to the list — '/' would only bounce a now-logged-in user back out here.
      await resetPassword(email, form.otp, form.password);
      toast('Password updated — you are signed in', 'success');
      navigate('/opportunities', { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      // An expired or burned code is not a typo — there is nothing useful to
      // fix in the field, so clear it and point the user at a fresh code
      // instead of leaving a dead value sitting in the input.
      if (code === 'OTP_EXPIRED' || code === 'OTP_ATTEMPTS_EXCEEDED') {
        setForm((prev) => ({ ...prev, otp: '' }));
        setCooldown(0);
      }
      const msg = applyServerErrors(err, setFieldError, ['otp', 'password']);
      setServerError(msg);
      toast(msg, 'error');
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setServerError('');
    try {
      const data = await forgotPassword(email);
      if (data?.devOtp) setDevOtp(data.devOtp);
      toast('If that account exists, a new code is on its way', 'info');
      setForm((prev) => ({ ...prev, otp: '' }));
      setCooldown(60);
    } catch (err) {
      // Unlike the verify-email resend there is no retryAfter to read: this
      // endpoint answers a uniform 200 even while the cooldown is active, on
      // purpose, so a 429 here is the IP rate limiter rather than the
      // per-account cooldown. Just surface it.
      const msg = err?.response?.data?.message || 'Could not send a new code.';
      setServerError(msg);
      toast(msg, 'error');
    }
  };

  const strength = getStrength(form.password);

  return (
    <div className="card auth-card">
      <h1>Set a new password</h1>
      <p className="muted">
        We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
      </p>

      {devOtp && (
        <div className="alert alert-info">
          Development mode — email is not configured on the server. Your code is{' '}
          <strong>{devOtp}</strong>.
        </div>
      )}
      {serverError && <div className="alert alert-error">{serverError}</div>}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormField label="Reset code" name="otp" error={errors.otp} required>
          <input
            id="otp"
            name="otp"
            value={form.otp}
            onChange={handleOtpChange}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={LIMITS.otp.length}
            style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: '1.25rem' }}
            {...fieldProps('otp', errors.otp, true)}
          />
        </FormField>

        <FormField label="New password" name="password" error={errors.password} required>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handlePasswordChange}
            onBlur={(e) => validateField('password', e.target.value, form)}
            maxLength={LIMITS.password.max}
            minLength={LIMITS.password.min}
            placeholder={`Min ${LIMITS.password.min} characters`}
            autoComplete="new-password"
            {...fieldProps('password', errors.password, true)}
          />
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
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        Didn&apos;t get it?{' '}
        <button
          type="button"
          className="btn-link"
          onClick={handleResend}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </p>
      <p className="muted" style={{ marginTop: 8, textAlign: 'center' }}>
        <Link to="/login" className="back-link" style={{ margin: 0 }}>
          Back to login
        </Link>
      </p>
    </div>
  );
}
