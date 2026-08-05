/**
 * Password strength scoring for the meter under a new-password field.
 *
 * Lived as a local function inside RegisterPage until the password-reset page
 * needed the same meter. Shared rather than copied so the two screens can never
 * disagree about what "Strong" means — a user who saw "Strong" at registration
 * and "Medium" for the same password on the reset page would reasonably
 * conclude one of the two was broken.
 *
 * Advisory only. The actual policy lives in validationRules.passwordRule and is
 * re-enforced by the backend; a "Weak" password is still accepted if it clears
 * the length minimum. This exists to encourage, not to gate.
 */
export function getStrength(pw) {
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

/**
 * Maps a level to the CSS suffix used by `.str-bar.active-*` and `.str-label
 * .str-*` in index.css. Index 0 is '' because level 0 renders no meter at all.
 */
export const strengthCls = ['', 'weak', 'medium', 'strong'];
