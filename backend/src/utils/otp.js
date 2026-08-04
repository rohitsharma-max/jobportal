// Generate, hash, and verify the 6-digit email-verification code.
//
// Deliberately free of database access and of I/O: it computes, nothing more.
// Lifecycle (when to issue, when to expire, how many attempts remain) lives in
// services/emailVerification.js.
const crypto = require('crypto');

// A pepper, not a salt: it is NOT stored beside the hash. Six digits is a space
// small enough to exhaust instantly, so a leaked emailOtpHash is only safe while
// the attacker lacks this value. config/env.js requires it at boot.
const otpSecret = () => {
  const secret = process.env.OTP_SECRET;
  if (!secret) throw new Error('OTP_SECRET is not set');
  return secret;
};

/**
 * A cryptographically random 6-digit code.
 *
 * crypto.randomInt, not Math.random(): Math.random() is not a CSPRNG and its
 * future output is derivable from observed values, which for a login credential
 * is disqualifying. The range is min-inclusive / max-exclusive, so 100000-999999
 * — always exactly six digits, never a leading zero to lose in a Number cast.
 */
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/** sha256 over email + code + pepper. Email is lowercased to match the model. */
function hashOtp(email, otp) {
  return crypto
    .createHash('sha256')
    .update(`${String(email).toLowerCase()}:${otp}:${otpSecret()}`)
    .digest('hex');
}

/**
 * Constant-time comparison. A plain `===` on a hash leaks how many leading bytes
 * matched through timing, which over many attempts narrows the search.
 */
function verifyOtp(email, otp, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;

  const candidate = Buffer.from(hashOtp(email, otp), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  // timingSafeEqual throws on a length mismatch, so check first.
  if (candidate.length !== stored.length) return false;

  return crypto.timingSafeEqual(candidate, stored);
}

module.exports = { generateOtp, hashOtp, verifyOtp };
