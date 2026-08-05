// Brute-force protection for the credential endpoints. Without this, a 1-minute
// access token buys nothing: an attacker can just hammer /auth/login.
const rateLimit = require('express-rate-limit');

const json = (message) => (req, res) =>
  res.status(429).json({ success: false, data: null, code: 'RATE_LIMITED', message });

// The test suite drives login and refresh dozens of times from one address, and
// counters that persist across cases would make unrelated assertions fail
// depending on execution order. Limits stay fully active everywhere else.
const skipInTests = () => process.env.NODE_ENV === 'test';

// Login / register: 10 attempts per IP per 15 minutes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed attempts count, so a legitimate user logging in repeatedly on a
  // shared IP isn't locked out.
  skipSuccessfulRequests: true,
  skip: skipInTests,
  handler: json('Too many attempts. Please try again in 15 minutes.'),
});

// Refresh is called far more often (once per minute per active tab), so it gets
// a much higher ceiling while still capping abuse.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: json('Too many refresh attempts. Please log in again.'),
});

// OTP verify/resend. The real guards are the per-account attempt counter and the
// resend cooldown; this is the outer bound on hammering from one address.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: json('Too many verification attempts. Please try again later.'),
});

// Forgot-password. This gets its own limiter rather than reusing authLimiter,
// and the reason is not cosmetic: authLimiter sets skipSuccessfulRequests, and
// /auth/forgot-password answers 200 for EVERY request by design (that
// uniformity is what stops it being an account-enumeration oracle). Under
// authLimiter, nothing would ever be counted and the endpoint would be
// completely unlimited — free bulk address probing and a mail-bomb relay.
//
// So: no skipSuccessfulRequests, and a low ceiling. Five is generous for a
// human who mistyped their address and stingy for a script. The per-account
// resend cooldown limits mail volume to one address; this limits how many
// different addresses one source can probe.
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: json('Too many password reset requests. Please try again in 15 minutes.'),
});

module.exports = { authLimiter, refreshLimiter, otpLimiter, passwordResetLimiter };
