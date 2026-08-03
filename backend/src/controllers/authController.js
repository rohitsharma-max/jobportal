const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { verifyRefreshToken } = require('../utils/tokens');
const {
  SessionError,
  startSession,
  rotateSession,
  revokeFamily,
} = require('../services/sessions');

// Shape a user object for the client (never leak the password or tokenVersion).
const publicUser = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role });

const unauthorized = (res, code, message) =>
  res.status(401).json({ success: false, data: null, code, message });

// POST /api/auth/register — create a normal user account and log them in.
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.valid.body;

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(409).json({
      success: false,
      data: null,
      code: 'EMAIL_TAKEN',
      message: 'An account with this email already exists',
      errors: { email: 'An account with this email already exists' },
    });
  }

  // role is hardcoded — it is never read from the request body, so a client
  // cannot register itself as an admin.
  const user = await User.create({ name, email, password, role: 'user' });

  return res.status(201).json({
    success: true,
    data: { user: publicUser(user), ...(await startSession(user)) },
    message: 'Registered successfully',
  });
});

// POST /api/auth/login — verify credentials, then open a new session.
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.valid.body;

  // password has select:false, so ask for it explicitly.
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    // Deliberately identical for unknown email and wrong password so the
    // response cannot be used to enumerate registered addresses.
    return unauthorized(res, 'BAD_CREDENTIALS', 'Invalid email or password');
  }

  return res.status(200).json({
    success: true,
    data: { user: publicUser(user), ...(await startSession(user)) },
    message: 'Logged in successfully',
  });
});

// POST /api/auth/refresh — exchange a valid refresh token for a fresh pair.
//
// The presented token is rotated out and genuinely revoked (see
// services/sessions.js), so it cannot be used a second time. Presenting an
// already-rotated token means a copy is in circulation, and kills the session.
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.valid.body;

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return unauthorized(
      res,
      expired ? 'REFRESH_EXPIRED' : 'REFRESH_INVALID',
      expired
        ? 'Your session has expired. Please log in again.'
        : 'Invalid refresh token. Please log in again.'
    );
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return unauthorized(
      res,
      'USER_GONE',
      'Account no longer exists. Please log in again.'
    );
  }

  // Global kill-switch, retained for password changes and "log out everywhere".
  // Ordinary logout no longer touches it — it revokes only its own session.
  if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
    return unauthorized(
      res,
      'REFRESH_REVOKED',
      'Your session was ended. Please log in again.'
    );
  }

  let tokens;
  try {
    tokens = await rotateSession(user, refreshToken);
  } catch (err) {
    // Unknown or already-rotated token — both end the session, with the code
    // telling the frontend which happened.
    if (err instanceof SessionError) {
      return unauthorized(res, err.code, err.message);
    }
    throw err;
  }

  return res.status(200).json({
    success: true,
    data: { user: publicUser(user), ...tokens },
    message: 'Token refreshed',
  });
});

// POST /api/auth/logout — end THIS session only.
//
// Previously this incremented tokenVersion, which signed the account out
// everywhere: logging out on a phone also killed the laptop. `protect` reads the
// access token's `sid`, so only the calling device's refresh-token family is
// revoked. The current access token still dies on its own within a minute.
const logout = asyncHandler(async (req, res) => {
  await revokeFamily(req.sessionId);

  return res.status(200).json({
    success: true,
    data: null,
    message: 'Logged out successfully',
  });
});

// GET /api/auth/me — current logged-in user (protect middleware sets req.user).
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: publicUser(req.user),
    message: 'Current user',
  });
});

module.exports = { register, login, refresh, logout, getMe };
