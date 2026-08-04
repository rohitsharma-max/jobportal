/**
 * Decides whether a failed refresh means the session is genuinely over.
 *
 * This used to be unconditional: the refresh handler cleared the tokens and
 * emitted a logout for EVERY error. Because the access token lives one minute,
 * that path runs constantly, so a dropped wifi packet, a request timeout, a
 * cold-starting server, or a 429 from the refresh rate limiter all ejected the
 * user and looked exactly like "unauthorized after signing in".
 *
 * Only the server explicitly rejecting the REFRESH TOKEN is unrecoverable.
 * Anything else is worth keeping the tokens for: the next request retries.
 *
 * Kept in its own module, free of axios and of browser globals, so it can be
 * unit tested directly.
 */

// The codes backend/src/controllers/authController.js returns from
// POST /api/auth/refresh when the token itself cannot be honoured.
export const DEAD_REFRESH_CODES = new Set([
  'REFRESH_EXPIRED', // past its 7-day TTL
  'REFRESH_INVALID', // never issued, or already pruned
  'REFRESH_REVOKED', // rotated out, reused, or the family was killed
  'USER_GONE', // the account no longer exists
]);

export function isRefreshTokenDead(error) {
  const response = error?.response;
  // No response at all: network error, timeout, or a cancelled request. The
  // token is very probably still fine — we simply never got an answer.
  if (!response) return false;
  // 429 and 5xx say something about the server, not about the token.
  if (response.status !== 401) return false;

  return DEAD_REFRESH_CODES.has(response.data?.code);
}
