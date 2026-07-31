const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');

// Sends a 401 with a machine-readable `code` so the frontend can tell an
// expired session (refresh and retry silently) from a bad one (log out).
const deny = (res, code, message) =>
  res.status(401).json({ success: false, data: null, code, message });

// Verifies the access token from the Authorization header and attaches req.user.
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return deny(res, 'NO_TOKEN', 'Not authorized, no token provided');
  }

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
  return next();
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

module.exports = { protect, adminOnly };
