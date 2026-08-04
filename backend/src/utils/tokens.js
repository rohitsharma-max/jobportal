// Two-token scheme.
//
//   access token  — short-lived (1 minute), sent as `Authorization: Bearer …`
//                   on every request. This is the token the task requires to
//                   expire after 1 minute.
//   refresh token — long-lived, used ONLY against POST /api/auth/refresh to
//                   mint a new access token. Without it a 1-minute access token
//                   would log the user out mid-form every minute.
//
// The two are signed with different secrets and carry a `type` claim, and the
// verify helpers below enforce that claim. That means a refresh token can never
// be replayed as an access token to reach a protected route, and vice versa.
//
// Both also carry `sid` — the session (family) id from services/sessions.js.
// It is what lets logout end ONE device's session instead of every session on
// the account, and what ties an access token back to the refresh-token chain
// that produced it.
//
// This module is deliberately free of database access: it signs and verifies,
// nothing more. Recording and revoking sessions lives in services/sessions.js.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// The `:refresh` derivation is deliberate — it is what keeps the access and
// refresh secrets DIFFERENT when only JWT_SECRET is configured, which is the
// common case. The bug it used to carry was running even when JWT_SECRET was
// undefined, yielding the guessable literal "undefined:refresh". Hence the guard
// rather than the removal. config/env.js catches this at boot; these throws are
// the backstop for anything that reaches here anyway (a test, a script).
const accessSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('No access token secret: set JWT_ACCESS_SECRET or JWT_SECRET');
  }
  return secret;
};

const refreshSecret = () => {
  if (process.env.JWT_REFRESH_SECRET) return process.env.JWT_REFRESH_SECRET;
  if (process.env.JWT_SECRET) return `${process.env.JWT_SECRET}:refresh`;
  throw new Error('No refresh token secret: set JWT_REFRESH_SECRET or JWT_SECRET');
};

const accessTtl = () => process.env.JWT_ACCESS_EXPIRES_IN || '1m';
const refreshTtl = () => process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function signAccessToken(user, sid) {
  return jwt.sign({ id: String(user._id), sid, type: 'access' }, accessSecret(), {
    expiresIn: accessTtl(),
  });
}

function signRefreshToken(user, sid) {
  return jwt.sign(
    {
      id: String(user._id),
      sid,
      type: 'refresh',
      tokenVersion: user.tokenVersion || 0,
      // Unique per token, and load-bearing rather than decorative.
      //
      // `iat` has one-second granularity, so without a jti two refresh tokens
      // minted for the same session inside the same second are byte-for-byte
      // identical. Rotation would then return the caller's own token back to
      // them, and the sha256 of it would collide with the row already stored —
      // so the rotation would fail on a duplicate-key error instead.
      jti: crypto.randomUUID(),
    },
    refreshSecret(),
    { expiresIn: refreshTtl() }
  );
}

/**
 * The token's own expiry as a Date, read back off the signed payload.
 *
 * Taken from the JWT rather than recomputed from JWT_REFRESH_EXPIRES_IN so the
 * stored row and the token can never disagree — whatever format that env var is
 * written in, `exp` is the single authority.
 */
function expiresAtOf(token) {
  const { exp } = jwt.decode(token);
  return new Date(exp * 1000);
}

function verifyTyped(token, secret, expectedType) {
  const decoded = jwt.verify(token, secret);
  if (decoded.type !== expectedType) {
    // Surface as a normal JWT failure so callers handle it in one branch.
    const err = new Error(`Expected a ${expectedType} token`);
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}

const verifyAccessToken = (token) => verifyTyped(token, accessSecret(), 'access');
const verifyRefreshToken = (token) => verifyTyped(token, refreshSecret(), 'refresh');

module.exports = {
  accessTtl,
  refreshTtl,
  signAccessToken,
  signRefreshToken,
  expiresAtOf,
  verifyAccessToken,
  verifyRefreshToken,
};
