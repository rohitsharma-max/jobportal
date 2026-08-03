// Session lifecycle: issuing, rotating, and revoking refresh tokens.
//
// utils/tokens.js only signs and verifies JWTs. It cannot answer "is this token
// still allowed?", because a JWT is valid until it expires no matter what has
// happened since. That question needs state, and this is where it lives.
//
// Every login starts a FAMILY, identified by a uuid that both tokens carry as
// `sid`. Refreshing rotates within the family: the presented token is revoked
// and a successor issued. Because exactly one token per family is live at a
// time, a second use of an already-rotated token is proof that someone holds a
// copy they shouldn't — so it kills the entire family rather than serving it.
//
// That is the property the old code claimed but did not have: a leaked refresh
// token was previously usable for its full 7-day TTL, in parallel with the
// legitimate user's own tokens, with nothing to notice or stop it.

const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const {
  accessTtl,
  signAccessToken,
  signRefreshToken,
  expiresAtOf,
} = require('../utils/tokens');

// Only the hash is ever stored, so a dump of the collection yields nothing that
// can be presented to /auth/refresh.
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * A refresh attempt that must end the session rather than serve it.
 * `code` is the machine-readable code the frontend switches on.
 */
class SessionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}

/** Signs a token pair for an existing family and records the refresh token. */
async function issueForFamily(user, familyId) {
  const refreshToken = signRefreshToken(user, familyId);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: expiresAtOf(refreshToken),
  });

  return {
    accessToken: signAccessToken(user, familyId),
    refreshToken,
    accessTokenExpiresIn: accessTtl(),
  };
}

/** Login / register: a brand new family, i.e. a new device or browser. */
function startSession(user) {
  return issueForFamily(user, crypto.randomUUID());
}

/**
 * Rotate the presented refresh token for a fresh pair.
 *
 * @throws {SessionError} REFRESH_INVALID — no such token was ever issued (or it
 *         has already been pruned by the TTL index)
 * @throws {SessionError} REFRESH_REVOKED — the token was already rotated out or
 *         its family was killed. Reuse: the family is revoked before throwing.
 */
async function rotateSession(user, presentedToken) {
  const tokenHash = hashToken(presentedToken);

  // Claim the row and revoke it in ONE atomic operation. Two refreshes racing
  // with the same token would otherwise both read it as live and both mint a
  // successor, leaving two live tokens in the family and no reuse to detect.
  // Exactly one caller can win this update.
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: false }
  );

  if (!claimed) {
    // Either the token is unknown, or it was already revoked. Only the second
    // case is an attack signal, so find out which.
    const known = await RefreshToken.findOne({ tokenHash });
    if (known) {
      await revokeFamily(known.familyId);
      throw new SessionError(
        'REFRESH_REVOKED',
        'Your session was ended for security reasons. Please log in again.'
      );
    }
    throw new SessionError(
      'REFRESH_INVALID',
      'Invalid refresh token. Please log in again.'
    );
  }

  // Mint the successor only after the predecessor is safely claimed. If this
  // throws, the user is logged out — the safe direction to fail, since the
  // alternative order can leave a revoked-then-reissued token live.
  const tokens = await issueForFamily(user, claimed.familyId);

  // Diagnostic only: lets a compromised family be traced in order later.
  await RefreshToken.updateOne(
    { _id: claimed._id },
    { $set: { replacedBy: hashToken(tokens.refreshToken) } }
  );

  return tokens;
}

/** Ends one session — the device that called logout, and nothing else. */
async function revokeFamily(familyId) {
  if (!familyId) return;
  await RefreshToken.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

/**
 * Ends every session on the account. Not used by ordinary logout — that would
 * sign the user out of their other devices too. This is the hook for a password
 * change or an explicit "log out everywhere".
 */
async function revokeAllForUser(userId) {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

module.exports = {
  SessionError,
  hashToken,
  startSession,
  rotateSession,
  revokeFamily,
  revokeAllForUser,
};
