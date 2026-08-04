// The OTP lifecycle on a user document: when a code may be issued, how it is
// attached, how it is delivered, and how it is cleared.
//
// utils/otp.js does the arithmetic; this module owns the policy and the mail.
const { generateOtp, hashOtp } = require('../utils/otp');
const sendEmail = require('../utils/sendEmail');
const escapeHtml = require('../utils/escapeHtml');
const { OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } = require('../config/constants');

/** Thrown when a code cannot be delivered and the request must not pretend it was. */
class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email delivery is not configured on this server');
    this.name = 'EmailNotConfiguredError';
    this.code = 'EMAIL_NOT_CONFIGURED';
  }
}

/**
 * Thrown when mail IS configured but the actual send rejected — wrong
 * credentials, provider outage, throttling. Deliberately a different class
 * from EmailNotConfiguredError: "never set up" and "set up but down" are
 * different operational problems, and callers need to tell them apart in the
 * server log even though both end up as the same generic 503 to the client.
 * The constructor takes no argument on purpose — see deliverOtp, which logs
 * the real cause itself and must not let it travel any further than that.
 */
class EmailDeliveryError extends Error {
  constructor() {
    super('Verification email could not be sent');
    this.name = 'EmailDeliveryError';
    this.code = 'EMAIL_SEND_FAILED';
  }
}

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
 * sendEmail() no-ops when EMAIL_USER/EMAIL_PASS are unset. That was harmless
 * while mail was decorative, but a skipped OTP means the account can never be
 * used — so in production this refuses the request instead. Outside production
 * the code is logged and returned so the flow is usable without a mailbox.
 *
 * @returns {Promise<{devOtp?: string}>}
 */
async function deliverOtp({ user, otp }) {
  if (!sendEmail.isEmailConfigured) {
    if (process.env.NODE_ENV === 'production') throw new EmailNotConfiguredError();
    if (process.env.NODE_ENV !== 'test') {
      console.log(`🔐 (email not configured) verification code for ${user.email}: ${otp}`);
    }
    return { devOtp: otp };
  }

  const name = escapeHtml(user.name || 'there');
  try {
    await sendEmail({
      to: user.email,
      subject: 'Your Job Portal verification code',
      html: `<p>Hi ${name},</p>
           <p>Your verification code is:</p>
           <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p>
           <p>It expires in ${Math.round(OTP_TTL_MS / 60000)} minutes.</p>
           <p>If you didn't request this, you can ignore this email.<br/>- Job Portal</p>`,
    });
  } catch (err) {
    // The rejection here is a real SMTP error — "Invalid login: 535-5.7.8...",
    // provider timeouts, etc. That text can reveal account/server details and
    // is useless to the end user, so it stops HERE: logged for whoever runs
    // this server, and replaced with a detail-free error for the controller to
    // turn into a generic 503. Silenced under test the same way sendEmail.js
    // silences its own skip notice, so a deliberately-forced failure in the
    // test suite doesn't bury real test output.
    if (process.env.NODE_ENV !== 'test') {
      console.error(`Failed to send verification code to ${user.email}:`, err.message);
    }
    throw new EmailDeliveryError();
  }
  return {};
}

module.exports = {
  EmailNotConfiguredError,
  EmailDeliveryError,
  cooldownRemainingMs,
  attachOtp,
  clearOtp,
  deliverOtp,
};
