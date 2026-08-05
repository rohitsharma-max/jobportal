// Delivery mechanics shared by every emailed one-time code, independent of what
// the code is FOR.
//
// Extracted from services/emailVerification.js when password reset became a
// second OTP flow. Only the delivery half moved: deciding whether mail is
// usable at all, what to do when it isn't, and how to fail without leaking SMTP
// internals. The per-flow parts — which fields on the user document hold the
// code, and what the email says — deliberately stayed with each flow, because
// those are the parts that genuinely differ.
//
// The point of hoisting this rather than copying it: both flows handle
// credentials, and two hand-maintained copies of "when may we skip sending a
// login code" is exactly the kind of duplication that drifts silently.
const sendEmail = require('../utils/sendEmail');

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
 * The constructor takes no argument on purpose — see deliverCode, which logs
 * the real cause itself and must not let it travel any further than that.
 */
class EmailDeliveryError extends Error {
  constructor() {
    super('The email could not be sent');
    this.name = 'EmailDeliveryError';
    this.code = 'EMAIL_SEND_FAILED';
  }
}

/**
 * True when this server could actually send mail right now.
 *
 * Exposed so a handler can check BEFORE it starts branching on whether an
 * account exists. /auth/forgot-password needs that: its whole design is to
 * answer identically for real and unknown addresses, and a 503 raised only on
 * the branch that found a user would reintroduce exactly the account-existence
 * signal the uniform 200 exists to remove.
 */
const isEmailUsable = () =>
  sendEmail.isEmailConfigured || process.env.NODE_ENV !== 'production';

/**
 * Sends a one-time code, or decides it cannot be sent.
 *
 * sendEmail() no-ops when EMAIL_USER/EMAIL_PASS are unset. That was harmless
 * while mail was decorative, but a skipped code means the account can never be
 * used — so in production this refuses the request instead. Outside production
 * the code is logged and returned so the flow is usable without a mailbox.
 *
 * @param {object}  args
 * @param {string}  args.to       recipient address
 * @param {string}  args.otp      the plaintext code (only ever returned in dev)
 * @param {string}  args.subject  email subject
 * @param {string}  args.html     email body, already escaped by the caller
 * @param {string}  args.label    what this code is, for log lines only
 * @returns {Promise<{devOtp?: string}>}
 */
async function deliverCode({ to, otp, subject, html, label }) {
  if (!sendEmail.isEmailConfigured) {
    if (process.env.NODE_ENV === 'production') throw new EmailNotConfiguredError();
    if (process.env.NODE_ENV !== 'test') {
      console.log(`🔐 (email not configured) ${label} for ${to}: ${otp}`);
    }
    return { devOtp: otp };
  }

  try {
    await sendEmail({ to, subject, html });
  } catch (err) {
    // The rejection here is a real SMTP error — "Invalid login: 535-5.7.8...",
    // provider timeouts, etc. That text can reveal account/server details and
    // is useless to the end user, so it stops HERE: logged for whoever runs
    // this server, and replaced with a detail-free error for the controller to
    // turn into a generic 503. Silenced under test the same way sendEmail.js
    // silences its own skip notice, so a deliberately-forced failure in the
    // test suite doesn't bury real test output.
    if (process.env.NODE_ENV !== 'test') {
      console.error(`Failed to send ${label} to ${to}:`, err);
    }
    throw new EmailDeliveryError();
  }
  return {};
}

module.exports = {
  EmailNotConfiguredError,
  EmailDeliveryError,
  isEmailUsable,
  deliverCode,
};
