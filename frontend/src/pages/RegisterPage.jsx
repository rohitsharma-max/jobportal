import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useFormValidation from '../hooks/useFormValidation';
import FormField, { fieldProps } from '../components/FormField';
import {
  nameRule,
  emailRule,
  passwordRule,
  applyServerErrors,
  LIMITS,
} from '../utils/validationRules';

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

  // Rules come from the shared module so they always match the backend schema.
  const validators = useMemo(
    () => ({
      name: nameRule,
      email: emailRule,
      password: passwordRule,
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
      await register(form.name.trim(), form.email.trim(), form.password);
      toast('Account created successfully!', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      // A duplicate email comes back as errors.email and highlights that input.
      const msg = applyServerErrors(err, setFieldError, ['name', 'email', 'password']);
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
            maxLength={LIMITS.name.max}
            placeholder="Rohit Sharma"
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
            maxLength={LIMITS.password.max}
            minLength={LIMITS.password.min}
            placeholder={`Min ${LIMITS.password.min} characters`}
            autoComplete="new-password"
            {...fieldProps('password', errors.password, true)}
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
