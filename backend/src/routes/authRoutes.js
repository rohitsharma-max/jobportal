const express = require('express');
const router = express.Router();
const { register, login, refresh, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimit');
const { registerSchema, loginSchema, refreshSchema } = require('../validation/schemas');

// Mounted at /api/auth
// Order matters: rate limit -> validate -> controller.
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
