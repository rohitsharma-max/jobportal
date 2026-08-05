const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { verifyRefreshToken } = require('../utils/tokens');
const {
  SessionError,
  startSession,
  rotateSession,
  revokeFamily,
  revokeAllForUser,
} = require('../services/sessions');
const { isEmailUsable } = require('../services/otpMailer');
const {
  RESET_OTP_SELECT,
  resetCooldownRemainingMs,
  attachResetOtp,
  clearResetOtp,
  deliverResetOtp,
} = require('../services/passwordReset');
const {
  EmailNotConfiguredError,
  EmailDeliveryError,
  cooldownRemainingMs,
  attachOtp,
  clearOtp,
  deliverOtp,
} = require('../services/emailVerification');
const { verifyOtp } = require('../utils/otp');
const { OTP_MAX_ATTEMPTS } = require('../config/constants');
// Imported as the module object, deliberately NOT destructured: tests replace
// verifyGoogleIdToken with mock.method(googleAuth, 'verifyGoogleIdToken', ...),
// which swaps the property on this exports object. A destructured local binding
// would have captured the original function at require time and bypassed the
// stub entirely, so every test would attempt a real network call to Google.
const googleAuth = require('../services/googleAuth');

// Shape a user object for the client (never leak the password or tokenVersion).
const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  emailVerified: u.emailVerified,
  authProvider: u.authProvider,
  avatarUrl: u.avatarUrl || null,
});

const unauthorized = (res, code, message) =>
  res.status(401).json({ success: false, data: null, code, message });

const otpCooldown = (res, remainingMs) =>
  res.status(429).json({
    success: false,
    data: { retryAfter: Math.ceil(remainingMs / 1000) },
    code: 'OTP_COOLDOWN',
    message: `Please wait ${Math.ceil(remainingMs / 1000)}s before requesting another code`,
  });

// Sibling of otpCooldown, not a reuse of it: otpCooldown means "wait, then you
// may ask for a new code" and carries a retryAfter counting down to that. This
// is a different situation — a code is already live for this address (its
// 10-minute TTL, not the 60s resend cooldown) — so there is nothing to count
// down to and no retryAfter to give. See the register handler for why this
// path must refuse rather than resend.
const otpAlreadySent = (res, email) =>
  res.status(409).json({
    success: false,
    data: { email },
    code: 'OTP_ALREADY_SENT',
    message: 'A verification code was already sent to this address. Enter it, or wait for it to expire before registering again.',
  });

// Misconfigured mail and mail that's merely down are different operational
// problems (one is "fix your .env", the other is "the provider is having an
// outage") and get different codes for the server log — but the client-facing
// shape must be the same 503 either way, and in particular must never carry
// the real SMTP error text (see deliverOtp). One function shapes that body so
// the two call sites below can't drift into leaking different things.
const mailUnavailable = (res, code, message) =>
  res.status(503).json({ success: false, data: null, code, message });

const emailNotConfigured = (res) =>
  mailUnavailable(
    res,
    'EMAIL_NOT_CONFIGURED',
    'Email delivery is not configured on this server, so no verification code could be sent. Please contact the administrator.'
  );

const emailSendFailed = (res) =>
  mailUnavailable(
    res,
    'EMAIL_SEND_FAILED',
    'We could not send the verification email right now. Please try again shortly.'
  );

// POST /api/auth/register — create an UNVERIFIED account and mail a code.
//
// Deliberately issues no session: the account is unusable until the address is
// proven, so handing out tokens here would defeat the verification entirely.
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.valid.body;

  const existing = await User.findOne({ email }).select(
    '+emailOtpRequestedAt +emailOtpExpiresAt'
  );

  if (existing?.emailVerified) {
    return res.status(409).json({
      success: false,
      data: null,
      code: 'EMAIL_TAKEN',
      message: 'An account with this email already exists',
      errors: { email: 'An account with this email already exists' },
    });
  }

  let user;
  if (existing) {
    // A signup that was abandoned before verification. Let it be retried rather
    // than permanently blocked by a half-created account — but honour the
    // cooldown first, or this endpoint becomes a way to mail-bomb an address.
    // Nothing is written when the cooldown is active.
    const remaining = cooldownRemainingMs(existing.emailOtpRequestedAt);
    if (remaining > 0) return otpCooldown(res, remaining);

    // Attack B: anyone can re-register a live pending signup, since a
    // registered-but-unverified address is otherwise indistinguishable from a
    // free one. Overwriting name/password here would swap credentials
    // underneath a code already sitting in the real registrant's inbox —
    // whoever enters it then activates a stranger's account, not their own.
    // The 60s cooldown above is not enough to stop this: it only guards
    // re-SENDING, and the code itself stays valid for the full OTP_TTL_MS (10
    // minutes) after that. Refuse outright until the code has actually
    // expired; that is the legitimate "I abandoned signup, start over" path.
    if (existing.emailOtpExpiresAt && existing.emailOtpExpiresAt > new Date()) {
      return otpAlreadySent(res, existing.email);
    }

    existing.name = name;
    existing.password = password; // the pre('save') hook re-hashes it
    user = existing;
  } else {
    // role is hardcoded — never read from the request body, so a client cannot
    // register itself as an admin.
    user = new User({ name, email, password, role: 'user', emailVerified: false });
  }

  const otp = attachOtp(user);

  let delivery;
  try {
    delivery = await deliverOtp({ user, otp });
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) return emailNotConfigured(res);
    // deliverOtp already logged the real cause (bad credentials, SMTP outage,
    // throttling...) and deliberately threw this detail-free error instead of
    // letting the original bubble to asyncHandler's generic 500 handler — that
    // would have put raw SMTP text straight into the response body.
    if (err instanceof EmailDeliveryError) return emailSendFailed(res);
    throw err;
  }

  // Saved only after the code is genuinely on its way.
  await user.save();

  return res.status(201).json({
    success: true,
    data: { email: user.email, requiresVerification: true, ...delivery },
    message: 'We sent a 6-digit verification code to your email',
  });
});

// POST /api/auth/verify-email — prove ownership of the address, then log in.
const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.valid.body;

  const user = await User.findOne({ email }).select(
    '+emailOtpHash +emailOtpExpiresAt +emailOtpRequestedAt +emailOtpAttempts'
  );

  // Same response as a wrong code, so this endpoint doesn't ALSO become a way
  // to tell addresses apart by comparing 400s. That is a partial measure, not
  // a guarantee: this same handler answers 409 ALREADY_VERIFIED for a
  // known-verified email a few lines down, and register answers 409
  // EMAIL_TAKEN — both already reveal account existence on their own paths.
  // Matching shapes here just avoids adding a third way to ask.
  const invalid = () =>
    res.status(400).json({
      success: false,
      data: null,
      code: 'OTP_INVALID',
      message: 'That code is not valid. Please check it and try again.',
    });

  if (!user) return invalid();

  if (user.emailVerified) {
    return res.status(409).json({
      success: false,
      data: null,
      code: 'ALREADY_VERIFIED',
      message: 'This email is already verified. Please log in.',
    });
  }

  if (!user.emailOtpHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt < new Date()) {
    return res.status(400).json({
      success: false,
      data: null,
      code: 'OTP_EXPIRED',
      message: 'That code has expired. Request a new one.',
    });
  }

  // Six digits is a million guesses — cheap to exhaust without this. Burn the
  // code rather than merely refusing, so the attacker has to trigger a new email
  // (and therefore the cooldown) to keep going.
  if ((user.emailOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    clearOtp(user);
    await user.save();
    return res.status(429).json({
      success: false,
      data: null,
      code: 'OTP_ATTEMPTS_EXCEEDED',
      message: 'Too many incorrect attempts. Please request a new code.',
    });
  }

  if (!verifyOtp(user.email, otp, user.emailOtpHash)) {
    user.emailOtpAttempts = (user.emailOtpAttempts || 0) + 1;
    await user.save();
    return invalid();
  }

  user.emailVerified = true;
  clearOtp(user);
  await user.save();

  return res.status(200).json({
    success: true,
    data: { user: publicUser(user), ...(await startSession(user)) },
    message: 'Email verified successfully',
  });
});

// POST /api/auth/resend-otp — issue a replacement code.
const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.valid.body;

  // One message for every 200 on this endpoint, real account or not: two
  // strings that are merely SIMILAR would still let a script tell accounts
  // apart by reading `message`, so there is exactly one wording, defined
  // once, and both call sites below funnel through it instead of writing
  // their own literal. That keeps these 200s uniform, but — same caveat as
  // verifyEmail's `invalid()` closure — it is not a full enumeration
  // defense: this endpoint still answers 409 ALREADY_VERIFIED for a
  // known-verified address a few lines down, which already reveals that the
  // account exists.
  const RESEND_MESSAGE = 'If that account needs verification, a new code is on its way';
  const resendOk = (data) =>
    res.status(200).json({ success: true, data, message: RESEND_MESSAGE });

  const user = await User.findOne({ email }).select(
    '+emailOtpHash +emailOtpExpiresAt +emailOtpRequestedAt +emailOtpAttempts'
  );
  // Identical response for an address we've never seen — no devOtp, same
  // message, same status as the real path below, so THIS branch doesn't hand
  // back a distinguishing 404 or a differently-worded 200. It only covers the
  // unknown-vs-unverified-pending case, though: the ALREADY_VERIFIED branch
  // above still answers differently for a known-verified address, so account
  // existence is not actually hidden end-to-end by this endpoint.
  if (!user) return resendOk({ email });

  if (user.emailVerified) {
    return res.status(409).json({
      success: false,
      data: null,
      code: 'ALREADY_VERIFIED',
      message: 'This email is already verified. Please log in.',
    });
  }

  const remaining = cooldownRemainingMs(user.emailOtpRequestedAt);
  if (remaining > 0) return otpCooldown(res, remaining);

  // Resets emailOtpAttempts to 0 — a new code deserves a fresh budget, otherwise
  // a user who fumbled the old one five times can never recover.
  const otp = attachOtp(user);

  let delivery;
  try {
    delivery = await deliverOtp({ user, otp });
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) return emailNotConfigured(res);
    // deliverOtp already logged the real cause (bad credentials, SMTP outage,
    // throttling...) and deliberately threw this detail-free error instead of
    // letting the original bubble to asyncHandler's generic 500 handler — that
    // would have put raw SMTP text straight into the response body.
    if (err instanceof EmailDeliveryError) return emailSendFailed(res);
    throw err;
  }

  // Saved only after the code is genuinely on its way — same rule as register.
  await user.save();

  // Same call, same message, as the unknown-email branch above — devOtp is
  // the only thing that can differ, and only outside production.
  return resendOk({ email: user.email, ...delivery });
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

  // AFTER the password check, deliberately. Running it first would answer 403
  // for any unverified address regardless of the password, confirming the
  // account exists via a status this endpoint would otherwise never give an
  // unknown address — worth avoiding here, even though it is not a
  // system-wide guarantee: register's EMAIL_TAKEN and verify-email/resend-otp's
  // ALREADY_VERIFIED already reveal account existence on their own paths. This
  // ordering narrows what THIS endpoint leaks; it does not close the topic.
  //
  // A Google-only account has no password, so matchPassword() already returned
  // false above and it never reaches here: it gets the same generic 401 as any
  // wrong password. Saying "this account uses Google" would be friendlier but
  // would add yet another way to confirm the address is registered.
  if (!user.emailVerified) {
    return res.status(403).json({
      success: false,
      data: { email: user.email, requiresVerification: true },
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email before logging in',
    });
  }

  return res.status(200).json({
    success: true,
    data: { user: publicUser(user), ...(await startSession(user)) },
    message: 'Logged in successfully',
  });
});

// POST /api/auth/forgot-password — mail a reset code.
//
// Answers 200 with ONE fixed message for every request: unknown address, real
// address, address currently inside its resend cooldown. That uniformity is the
// entire security property of this endpoint, and it is stricter than
// resend-otp's behaviour on purpose — resend-otp answers 429 OTP_COOLDOWN and
// 409 ALREADY_VERIFIED, which its own comments admit reveal account existence.
// Nothing forces that trade-off here, so it isn't repeated: a caller cannot use
// this endpoint to tell a registered address from an unregistered one.
//
// The client does NOT get a retryAfter for the cooldown, and doesn't need one —
// it starts its own 60s countdown from a successful submit, exactly as the
// verify-email page already does with `codeJustSent`.
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.valid.body;

  // Defined once and used by every 200 below. Two strings that were merely
  // SIMILAR would still let a script tell the branches apart by reading
  // `message`, so there is exactly one wording and no call site writes its own.
  const FORGOT_MESSAGE =
    'If an account exists for that address, a password reset code is on its way';
  const forgotOk = (data) =>
    res.status(200).json({ success: true, data, message: FORGOT_MESSAGE });

  // Checked BEFORE the user lookup, deliberately. deliverResetOtp() would raise
  // this same condition a few lines down, but only on the branch that found an
  // account — so a server with no mail configured would answer 503 for
  // registered addresses and 200 for unknown ones, handing back precisely the
  // account-existence oracle the uniform 200 above exists to remove.
  if (!isEmailUsable()) return emailNotConfigured(res);

  const user = await User.findOne({ email }).select(RESET_OTP_SELECT);
  // Identical status, message and shape as the real path below. The only thing
  // that can differ is `devOtp`, which is never present in production.
  if (!user) return forgotOk({ email });

  // Inside the cooldown: send nothing, write nothing, and say exactly what the
  // other branches say. Returning 429 here (resend-otp's choice) would leak
  // both that the account exists AND that someone recently requested a code
  // for it.
  if (resetCooldownRemainingMs(user) > 0) return forgotOk({ email: user.email });

  // A reset code is offered even to accounts with no password at all
  // (authProvider: 'google'). Completing the reset gives them one and promotes
  // them to 'both' — see resetPassword. Refusing here with "this account uses
  // Google" would be friendlier but would add a second enumeration signal that
  // also discloses the provider.
  const otp = attachResetOtp(user);

  let delivery;
  try {
    delivery = await deliverResetOtp({ user, otp });
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) return emailNotConfigured(res);
    // A transient SMTP failure. This IS a residual enumeration signal — it can
    // only fire on the branch that found an account — but it needs the attacker
    // to catch a window where mail is broken, and swallowing it into a 200
    // would leave a real user retrying forever with no code and no explanation.
    // The isEmailUsable() check above removes the permanent, always-reproducible
    // version of this leak, which is the one that mattered.
    if (err instanceof EmailDeliveryError) return emailSendFailed(res);
    throw err;
  }

  // Saved only after the code is genuinely on its way — same rule as register.
  await user.save();

  return forgotOk({ email: user.email, ...delivery });
});

// POST /api/auth/reset-password — consume the code, set the new password, sign in.
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.valid.body;

  const user = await User.findOne({ email }).select(RESET_OTP_SELECT);

  // Same guard sequence as verifyEmail, for the same reasons.
  const invalid = () =>
    res.status(400).json({
      success: false,
      data: null,
      code: 'OTP_INVALID',
      message: 'That code is not valid. Please check it and try again.',
    });

  // Unknown address gets the wrong-code response, so this endpoint isn't a
  // second way to ask whether an account exists.
  if (!user) return invalid();

  if (
    !user.passwordResetOtpHash ||
    !user.passwordResetOtpExpiresAt ||
    user.passwordResetOtpExpiresAt < new Date()
  ) {
    return res.status(400).json({
      success: false,
      data: null,
      code: 'OTP_EXPIRED',
      message: 'That code has expired. Request a new one.',
    });
  }

  // Six digits is a million guesses — cheap to exhaust without this. Burn the
  // code rather than merely refusing, so the attacker has to trigger a new
  // email (and therefore the cooldown) to keep going.
  if ((user.passwordResetOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    clearResetOtp(user);
    await user.save();
    return res.status(429).json({
      success: false,
      data: null,
      code: 'OTP_ATTEMPTS_EXCEEDED',
      message: 'Too many incorrect attempts. Please request a new code.',
    });
  }

  if (!verifyOtp(user.email, otp, user.passwordResetOtpHash)) {
    user.passwordResetOtpAttempts = (user.passwordResetOtpAttempts || 0) + 1;
    await user.save();
    return invalid();
  }

  // The code was mailed to this address and came back, which proves control of
  // the mailbox — the exact same evidence verify-email accepts. So an
  // unverified account becomes verified here rather than being sent off to
  // enter a second code from the same inbox to prove the same fact.
  user.password = password; // the pre('save') hook hashes it
  user.emailVerified = true;
  // A Google-only account had no password and authProvider 'google'; it now has
  // both credentials. Keyed on googleId rather than the previous authProvider
  // value so this is idempotent and can't downgrade an existing 'both'.
  user.authProvider = user.googleId ? 'both' : 'email';
  clearResetOtp(user);
  // Any pending verification code is moot now the address is proven — same
  // cleanup googleSignIn does when Google proves it another way.
  clearOtp(user);
  // The global kill-switch refresh checks. Its comment in that handler says it
  // is "retained for password changes" — this is that case. Anyone holding a
  // refresh token minted before the reset (including whoever prompted the user
  // to reset in the first place) is cut off.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Order matters: revoke BEFORE starting the new session, or the fresh refresh
  // token gets swept up by the same revokeAllForUser call and the user is
  // signed out again on their first refresh, about a minute later.
  await revokeAllForUser(user._id);

  return res.status(200).json({
    success: true,
    data: { user: publicUser(user), ...(await startSession(user)) },
    message: 'Password updated — you are now signed in',
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

// POST /api/auth/google — sign in with a Google ID token.
//
// The frontend obtains the token from Google Identity Services and posts it
// here; we verify it server-side and mint our OWN session, so the rest of the
// API is unchanged and Google never sees our tokens.
const googleSignIn = asyncHandler(async (req, res) => {
  if (!googleAuth.isGoogleConfigured()) {
    return res.status(503).json({
      success: false,
      data: null,
      code: 'GOOGLE_NOT_CONFIGURED',
      message: 'Google sign-in is not configured on this server',
    });
  }

  const { idToken } = req.valid.body;

  let identity;
  try {
    identity = await googleAuth.verifyGoogleIdToken(idToken);
  } catch {
    // Deliberately no detail: the reason a token failed is not useful to a
    // client and the message may echo internals.
    return unauthorized(
      res,
      'GOOGLE_TOKEN_INVALID',
      'Google sign-in failed. Please try again.'
    );
  }

  // Linking below trusts the email address, so it must actually be proven.
  // Without this an attacker could register an unverified Google account on
  // someone else's address and take over their portal account.
  if (!identity.emailVerified || !identity.email) {
    return res.status(403).json({
      success: false,
      data: null,
      code: 'GOOGLE_EMAIL_UNVERIFIED',
      message: 'Your Google email address is not verified, so it cannot be used to sign in.',
    });
  }

  const email = identity.email.toLowerCase();
  let user = await User.findOne({ googleId: identity.googleId });

  if (!user) {
    // password has select:false — fetch it explicitly, or `user.password` below
    // reads as undefined even for an account that has one, and every linked
    // account would wrongly become google-only instead of 'both'.
    user = await User.findOne({ email }).select('+password');

    if (user) {
      // Capture BEFORE overwriting emailVerified below — that's the only
      // record of whether this address was proven prior to Google arriving.
      const wasVerified = user.emailVerified;
      user.googleId = identity.googleId;

      if (wasVerified) {
        // Same person, second sign-in method. Safe because Google has proven
        // they control the mailbox — this is not a takeover vector, and
        // whatever password is on the account was legitimately set by its
        // owner (the address was already proven before Google showed up).
        user.authProvider = user.password ? 'both' : 'google';
      } else {
        // Attack A: registration proves nothing, so an unverified account's
        // password may have been set by anyone who typed this email address
        // into the register form — not necessarily the person who owns it.
        // Google verification proves the ADDRESS, not that stranger's
        // password, so it must not upgrade that password into a trusted
        // credential (which `authProvider: 'both'` would do) or keep it at
        // all. Discard it — and the name, typed by the same unproven
        // stranger — in favour of what Google actually vouches for.
        user.authProvider = 'google';
        user.name = identity.name || email.split('@')[0];
      }

      user.emailVerified = true;
      if (!user.avatarUrl && identity.picture) user.avatarUrl = identity.picture;
      // A pending code is moot now that the address is proven another way.
      clearOtp(user);
      await user.save();

      if (!wasVerified) {
        // NOT `user.password = undefined` followed by save(): the pre('save')
        // hook re-hashes `password` whenever the path is modified, and
        // bcrypt.hash(undefined, salt) throws "Illegal arguments" — turning
        // this whole request into a 500 instead of clearing the field. A
        // query-level $unset bypasses document middleware entirely and
        // genuinely removes the field from the stored document (verified in
        // tests by reading the raw collection, not just this in-memory copy).
        await User.updateOne({ _id: user._id }, { $unset: { password: 1 } });
        user.password = undefined; // keep this in-memory copy consistent too
      }
    } else {
      // role is hardcoded, exactly as in register — never taken from input.
      try {
        user = await User.create({
          name: identity.name || email.split('@')[0],
          email,
          googleId: identity.googleId,
          authProvider: 'google',
          emailVerified: true,
          avatarUrl: identity.picture || null,
          role: 'user',
        });
      } catch (err) {
        // Two concurrent first-time sign-ins for the same identity can both
        // miss the googleId lookup above and both reach this create() call.
        // The loser hits the unique partial index on googleId and gets back
        // a raw MongoDB 11000, not an application error — left alone, that
        // falls through to errorHandler.js's generic duplicate-key handling,
        // which returns a 409 with no `code` (outside the GOOGLE_* taxonomy
        // every other response on this endpoint uses) and names the
        // internal `googleId` schema field to the client.
        //
        // The winner's document is exactly the account this request wanted,
        // so re-fetch it and let this request proceed as an ordinary sign-in
        // instead of surfacing the race as a confusing error.
        if (err.code === 11000) {
          user = await User.findOne({ googleId: identity.googleId });
          // Should be unreachable — the failed insert proves a document
          // with this googleId now exists. Refuse to retry indefinitely;
          // fall back to a coded error in this endpoint's own taxonomy
          // rather than rethrowing the raw Mongo error.
          if (!user) {
            return res.status(409).json({
              success: false,
              data: null,
              code: 'GOOGLE_SIGNIN_CONFLICT',
              message: 'Google sign-in could not be completed. Please try again.',
            });
          }
        } else {
          throw err;
        }
      }
    }
  }

  return res.status(200).json({
    success: true,
    data: { user: publicUser(user), ...(await startSession(user)) },
    message: 'Signed in with Google',
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

module.exports = {
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
};
