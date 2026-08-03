const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');

// Sends a 401 with a machine-readable `code` so the frontend can tell an
// expired session (refresh and retry silently) from a bad one (log out).
const deny = (res, code, message) =>
  res.status(401).json({ success: false, data: null, code, message });

const bearerToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

/**
 * Verifies a bearer token and attaches the caller.
 * @returns a `deny(...)` response on failure, or null once req.user is set.
 */
const attachUser = async (req, res, token) => {
  let decoded;
  try {
    // Rejects refresh tokens too — they carry type:'refresh'.
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return deny(res, 'TOKEN_EXPIRED', 'Session expired, please refresh');
    }
    return deny(res, 'TOKEN_INVALID', 'Not authorized, token invalid');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return deny(res, 'USER_GONE', 'Not authorized, user no longer exists');
  }

  req.user = user;
  // The refresh-token family this access token came from. Logout revokes just
  // this one, so ending a session on one device leaves the others alone.
  // Tokens minted before `sid` existed simply carry undefined, and
  // revokeFamily() treats that as a no-op.
  req.sessionId = decoded.sid;
  return null;
};

// Requires a valid access token. Attaches req.user and req.sessionId.
const protect = asyncHandler(async (req, res, next) => {
  const token = bearerToken(req);
  if (!token) {
    return deny(res, 'NO_TOKEN', 'Not authorized, no token provided');
  }

  const denied = await attachUser(req, res, token);
  return denied || next();
});

/**
 * For public routes whose RESPONSE differs for an admin — the opportunity list
 * and detail endpoints, which hide non-`open` listings from everyone else.
 *
 * No token means an anonymous caller, which is allowed: req.user stays
 * undefined and the handler applies the public filter.
 *
 * A token that is present but bad is still rejected, exactly as `protect` would
 * reject it. Waving it through as "anonymous" would be the trap here: an admin
 * whose 1-minute access token had just expired would silently receive the
 * public list instead of a 401, so the frontend would never refresh and retry,
 * and the dashboard would quietly show a partial view of the data.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = bearerToken(req);
  if (!token) return next();

  const denied = await attachUser(req, res, token);
  return denied || next();
});

// Must run after protect. Allows only admins through.
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      data: null,
      code: 'FORBIDDEN',
      message: 'Admin access only',
    });
  }
  return next();
};

module.exports = { protect, optionalAuth, adminOnly };
