const express = require('express');
const router = express.Router();
const {
  register,
  verifyEmail,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  getMe,
  googleSignIn,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  authLimiter,
  refreshLimiter,
  otpLimiter,
  passwordResetLimiter,
} = require('../middleware/rateLimit');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleAuthSchema,
} = require('../validation/schemas');

// Mounted at /api/auth
// Order matters: rate limit -> validate -> controller.
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), refresh);
router.post('/verify-email', otpLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-otp', otpLimiter, validate(resendOtpSchema), resendOtp);
// passwordResetLimiter, NOT authLimiter: authLimiter skips successful requests
// and this endpoint always answers 200 by design, so authLimiter would count
// nothing at all and leave it wide open. See middleware/rateLimit.js.
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);
// otpLimiter here is correct — it counts every request, and this endpoint
// answers 400 on a wrong code, which is what needs bounding.
router.post('/reset-password', otpLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/google', authLimiter, validate(googleAuthSchema), googleSignIn);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
