const express = require('express');
const router = express.Router();
const { register, verifyEmail, resendOtp, login, refresh, logout, getMe, googleSignIn } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter, refreshLimiter, otpLimiter } = require('../middleware/rateLimit');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  resendOtpSchema,
  googleAuthSchema,
} = require('../validation/schemas');

// Mounted at /api/auth
// Order matters: rate limit -> validate -> controller.
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), refresh);
router.post('/verify-email', otpLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-otp', otpLimiter, validate(resendOtpSchema), resendOtp);
router.post('/google', authLimiter, validate(googleAuthSchema), googleSignIn);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
