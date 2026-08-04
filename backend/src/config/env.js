// Startup validation for required configuration.
//
// config/db.js already refuses to connect without MONGO_URI, but the JWT and OTP
// secrets had no such guard — and utils/tokens.js used to derive the refresh
// secret as `${process.env.JWT_SECRET}:refresh`, which with JWT_SECRET unset
// produced the literal, publicly guessable string "undefined:refresh" instead of
// failing. Signing refresh tokens with a known key lets anyone mint a session for
// any user id, so this must fail at boot rather than silently succeed.
//
// Reports every problem at once: one restart per missing variable is a miserable
// way to configure a deployment.

// Variables that are dead but still commonly present in older .env files. Warned
// about, never fatal, so a stale value cannot silently appear to do something.
const DEAD_VARS = {
  JWT_EXPIRES_IN:
    'JWT_EXPIRES_IN is not read by any code. The live names are JWT_ACCESS_EXPIRES_IN and JWT_REFRESH_EXPIRES_IN.',
};

function assertRequiredEnv(env = process.env) {
  const missing = [];

  if (!env.MONGO_URI) missing.push('MONGO_URI');
  if (!env.JWT_ACCESS_SECRET && !env.JWT_SECRET) {
    missing.push('JWT_ACCESS_SECRET (or JWT_SECRET)');
  }
  if (!env.JWT_REFRESH_SECRET && !env.JWT_SECRET) {
    missing.push('JWT_REFRESH_SECRET (or JWT_SECRET)');
  }
  if (!env.OTP_SECRET) missing.push('OTP_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy backend/.env.example to backend/.env and fill them in.'
    );
  }

  const warnings = Object.entries(DEAD_VARS)
    .filter(([key]) => env[key])
    .map(([, message]) => message);

  return { warnings };
}

module.exports = { assertRequiredEnv };
