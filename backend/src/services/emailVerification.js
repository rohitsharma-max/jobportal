// The OTP lifecycle on a user document: when a code may be issued, how it is
// attached, how it is delivered, and how it is cleared.
//
// utils/otp.js does the arithmetic; this module owns the policy and the mail.
const { generateOtp, hashOtp } = require('../utils/otp');
const escapeHtml = require('../utils/escapeHtml');
const { OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } = require('../config/constants');
// The two error classes and the "is mail usable / how do we fail" logic used to
// live in this file. They moved to otpMailer.js when password reset arrived as a
// second OTP flow, so both flows share one copy of that reasoning instead of
// two. Re-exported below, unchanged, so existing importers of this module (the
// auth controller catches both classes by identity) keep working — do not break
// that re-export without updating every `err instanceof` site.
const {
  EmailNotConfiguredError,
  EmailDeliveryError,
  deliverCode,
} = require('./otpMailer');

/** Milliseconds left before another code may be sent. 0 means "go ahead". */
function cooldownRemainingMs(requestedAt) {
  if (!requestedAt) return 0;
  const elapsed = Date.now() - new Date(requestedAt).getTime();
  return Math.max(0, OTP_RESEND_COOLDOWN_MS - elapsed);
}

/**
 * Puts a fresh code on the document and returns the plaintext.
 *
 * Does NOT save — the caller decides, so a failed delivery cannot leave a
 * half-written document behind. Resets the attempt counter: a new code deserves
 * a new budget, otherwise a user who fumbled five times is locked out forever.
 */
function attachOtp(user) {
  const otp = generateOtp();
  user.emailOtpHash = hashOtp(user.email, otp);
  user.emailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.emailOtpRequestedAt = new Date();
  user.emailOtpAttempts = 0;
  return otp;
}

/** Wipes OTP state — on success, or when a code is burned by too many attempts. */
function clearOtp(user) {
  user.emailOtpHash = null;
  user.emailOtpExpiresAt = null;
  user.emailOtpRequestedAt = null;
  user.emailOtpAttempts = 0;
}

/**
 * Delivers the code.
 *
 * Only builds the message now — deciding whether mail is usable, logging the
 * code when it isn't, and converting an SMTP rejection into a detail-free
 * EmailDeliveryError all happen in otpMailer.deliverCode(). Behaviour is
 * unchanged from when that logic lived here.
 *
 * @returns {Promise<{devOtp?: string}>}
 */
async function deliverOtp({ user, otp }) {
  const name = escapeHtml(user.name || 'there');
  return deliverCode({
    to: user.email,
    otp,
    label: 'verification code',
    subject: 'Your Job Portal verification code',
    html: `<p>Hi ${name},</p>
           <p>Your verification code is:</p>
           <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p>
           <p>It expires in ${Math.round(OTP_TTL_MS / 60000)} minutes.</p>
           <p>If you didn't request this, you can ignore this email.<br/>- Job Portal</p>`,
  });
}

module.exports = {
  EmailNotConfiguredError,
  EmailDeliveryError,
  cooldownRemainingMs,
  attachOtp,
  clearOtp,
  deliverOtp,
};
