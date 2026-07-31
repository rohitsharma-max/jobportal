const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { issueTokens, verifyRefreshToken } = require('../utils/tokens');

// Shape a user object for the client (never leak the password or tokenVersion).
const publicUser = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role });

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
    data: { user: publicUser(user), ...issueTokens(user) },
    message: 'Registered successfully',
  });
});

// POST /api/auth/login — verify credentials, return an access + refresh token.
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.valid.body;

  // password has select:false, so ask for it explicitly.
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    // Deliberately identical for unknown email and wrong password so the
    // response cannot be used to enumerate registered addresses.
    return res.status(401).json({
      success: false,
      data: null,
      code: 'BAD_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  return res.status(200).json({
    success: true,
    data: { user: publicUser(user), ...issueTokens(user) },
    message: 'Logged in successfully',
  });
});

// POST /api/auth/refresh — exchange a valid refresh token for a fresh 1-minute
// access token. Both tokens are rotated so a leaked refresh token has a
// bounded useful life.
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.valid.body;

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      data: null,
      code: expired ? 'REFRESH_EXPIRED' : 'REFRESH_INVALID',
      message: expired
        ? 'Your session has expired. Please log in again.'
        : 'Invalid refresh token. Please log in again.',
    });
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return res.status(401).json({
      success: false,
      data: null,
      code: 'USER_GONE',
      message: 'Account no longer exists. Please log in again.',
    });
  }

  // Logout increments tokenVersion, which retires every token minted before it.
  if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
    return res.status(401).json({
      success: false,
      data: null,
      code: 'REFRESH_REVOKED',
      message: 'Your session was ended. Please log in again.',
    });
  }

  return res.status(200).json({
    success: true,
    data: { user: publicUser(user), ...issueTokens(user) },
    message: 'Token refreshed',
  });
});

// POST /api/auth/logout — invalidate every outstanding refresh token for this
// user. The current access token still dies on its own within a minute.
const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });

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
