const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const generateToken = require('../utils/generateToken');
const { validateLogin, validateRegister } = require('../utils/validation');

// Shape a user object for the client (never leak the password).
const publicUser = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role });

// POST /api/auth/register — create a normal user account and log them in.
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = validateRegister(res, req.body);

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(400);
    throw new Error('An account with this email already exists');
  }

  const user = await User.create({ name, email, password, role: 'user' });
  res.status(201).json({
    success: true,
    data: { user: publicUser(user), token: generateToken(user._id) },
    message: 'Registered successfully',
  });
});

// POST /api/auth/login — verify credentials, return a token.
const login = asyncHandler(async (req, res) => {
  const { email, password } = validateLogin(res, req.body);

  // password has select:false, so ask for it explicitly.
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  res.status(200).json({
    success: true,
    data: { user: publicUser(user), token: generateToken(user._id) },
    message: 'Logged in successfully',
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

module.exports = { register, login, getMe };

