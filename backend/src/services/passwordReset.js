// The password-reset OTP lifecycle: when a code may be issued, how it is
// attached to the user document, how it is delivered, and how it is cleared.
//
// Sibling of services/emailVerification.js. The two share utils/otp.js (code
// generation, peppered hashing, constant-time compare) and services/otpMailer.js
// (delivery, dev fallback, error taxonomy). What is NOT shared is the state:
// this flow writes passwordResetOtp*, that one writes emailOtp*.
//
// Those field sets are deliberately separate rather than one reused set with a
// "purpose" discriminator. A single set would mean requesting a password reset
// silently destroys a verification code already sitting in the user's inbox
// (and vice versa), and the two flows can legitimately be in flight at once —
// an unverified user who has forgotten their password is exactly that case.
const { generateOtp, hashOtp } = require('../utils/otp');
const escapeHtml = require('../utils/escapeHtml');
const { deliverCode } = require('./otpMailer');
const { OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } = require('../config/constants');

/**
 * All four reset fields are select:false on the model, so every query that
 * needs to reason about a reset code must ask for them explicitly. Exported as
 * one string so a handler cannot half-select the set — omitting `attempts`
 * would read it as undefined and silently disable the attempt ceiling, which is
 * the guard that makes a 6-digit code safe in the first place.
 */
const RESET_OTP_SELECT =
  '+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpRequestedAt +passwordResetOtpAttempts';

/** Milliseconds left before another reset code may be sent. 0 means "go ahead". */
function resetCooldownRemainingMs(user) {
  const requestedAt = user?.passwordResetOtpRequestedAt;
  if (!requestedAt) return 0;
  const elapsed = Date.now() - new Date(requestedAt).getTime();
  return Math.max(0, OTP_RESEND_COOLDOWN_MS - elapsed);
}

/**
 * Puts a fresh reset code on the document and returns the plaintext.
 *
 * Does NOT save — the caller decides, so a failed delivery cannot leave a
 * half-written document behind. Resets the attempt counter: a new code deserves
 * a new budget, otherwise a user who fumbled five times is locked out forever.
 */
function attachResetOtp(user) {
  const otp = generateOtp();
  // Same peppered hash as email verification, and salted with the address for
  // the same reason — a code is only ever valid for the mailbox it was sent to.
  user.passwordResetOtpHash = hashOtp(user.email, otp);
  user.passwordResetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.passwordResetOtpRequestedAt = new Date();
  user.passwordResetOtpAttempts = 0;
  return otp;
}

/** Wipes reset state — on success, or when a code is burned by too many attempts. */
function clearResetOtp(user) {
  user.passwordResetOtpHash = null;
  user.passwordResetOtpExpiresAt = null;
  user.passwordResetOtpRequestedAt = null;
  user.passwordResetOtpAttempts = 0;
}

/**
 * Delivers the reset code.
 *
 * The copy differs from the verification email on purpose: this one has to warn
 * a recipient who did NOT ask for it, since an unrequested reset code is the
 * one signal a user gets that somebody is trying to take their account.
 *
 * @returns {Promise<{devOtp?: string}>}
 */
async function deliverResetOtp({ user, otp }) {
  const name = escapeHtml(user.name || 'there');
  return deliverCode({
    to: user.email,
    otp,
    label: 'password reset code',
    subject: 'Your Job Portal password reset code',
    html: `<p>Hi ${name},</p>
           <p>Use this code to set a new password:</p>
           <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p>
           <p>It expires in ${Math.round(OTP_TTL_MS / 60000)} minutes.</p>
           <p>If you didn't ask to reset your password, ignore this email — your
              current password still works and nothing has changed.<br/>- Job Portal</p>`,
  });
}

module.exports = {
  RESET_OTP_SELECT,
  resetCooldownRemainingMs,
  attachResetOtp,
  clearResetOtp,
  deliverResetOtp,
};
