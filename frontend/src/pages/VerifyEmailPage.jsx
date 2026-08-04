import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useFormValidation from '../hooks/useFormValidation';
import FormField, { fieldProps } from '../components/FormField';
import { otpRule, applyServerErrors } from '../utils/validationRules';

export default function VerifyEmailPage() {
  const { verifyEmail, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  // Router state is the normal path; ?email= keeps a page reload from dead-ending.
  const email = location.state?.email || searchParams.get('email') || '';

  const [otp, setOtp] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Only assume a code was JUST sent (60s cooldown) when the sender says so
  // explicitly via `codeJustSent` — true from RegisterPage's redirect. Neither
  // "router state has an email" nor "email exists at all" is the right signal:
  // LoginPage's EMAIL_NOT_VERIFIED redirect also carries an email, but that
  // code (if any) may have been mailed minutes or days ago, and a bare
  // ?email= reload is the same story. Guessing 60 in those cases would block
  // a resend the server would already allow. Start at 0 instead — the server
  // is still the authority, so an over-eager 0 just gets corrected by the
  // 429's retryAfter below if the user is wrong; an over-cautious 60 has no
  // such correction.
  const [cooldown, setCooldown] = useState(location.state?.codeJustSent ? 60 : 0);
  const [devOtp, setDevOtp] = useState(location.state?.devOtp || '');

  const validators = useMemo(() => ({ otp: otpRule }), []);
  const { errors, validate, clearFieldError, setFieldError } = useFormValidation(validators);

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
      <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Verify your email</h1>
        <div className="alert alert-error">
          We don&apos;t know which address to verify. Please register again.
        </div>
        <Link to="/register" className="btn btn-primary btn-block">Back to register</Link>
      </div>
    );
  }

  const handleChange = (e) => {
    // Digits only, capped at six: a paste of "123 456" should still work.
    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
    clearFieldError('otp');
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate({ otp })) return;

    setSubmitting(true);
    try {
      await verifyEmail(email, otp);
      toast('Email verified — welcome!', 'success');
      // verifyEmail() just opened the session — go straight to the list
      // instead of '/', which would only land on the public landing page
      // and immediately redirect a now-logged-in user right back out here.
      navigate('/opportunities', { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'ALREADY_VERIFIED') {
        toast('This email is already verified. Please log in.', 'info');
        navigate('/login', { replace: true });
        return;
      }
      const msg = applyServerErrors(err, setFieldError, ['otp']);
      setServerError(msg);
      toast(msg, 'error');
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setServerError('');
    try {
      const data = await resendOtp(email);
      if (data?.devOtp) setDevOtp(data.devOtp);
      toast('A new code is on its way', 'success');
      setOtp('');
      setCooldown(60);
    } catch (err) {
      // The server tells us exactly how long is left; prefer it over guessing.
      const retryAfter = err?.response?.data?.data?.retryAfter;
      if (retryAfter) setCooldown(retryAfter);
      const msg = err?.response?.data?.message || 'Could not resend the code.';
      setServerError(msg);
      toast(msg, 'error');
    }
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h1 style={{ fontSize: '1.5rem' }}>Verify your email</h1>
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
        <FormField label="Verification code" name="otp" error={errors.otp} required>
          <input
            id="otp"
            name="otp"
            value={otp}
            onChange={handleChange}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: '1.25rem' }}
            {...fieldProps('otp', errors.otp, true)}
          />
        </FormField>

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Verifying…' : 'Verify email'}
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
    </div>
  );
}
