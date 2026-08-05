const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// NOTE: no `required` / `match` / `minlength` validators here on purpose.
// All field validation lives in src/validation/schemas.js (Joi) and runs as
// route middleware before any controller. Keeping a second rulebook on the
// model would mean two places to change and two chances to disagree.
// What stays is structural: types, defaults, normalisation, and indexes.
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      unique: true, // an index (uniqueness constraint), not field validation
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false, // never returned by default
    },
    role: {
      type: String,
      // Kept: no Joi schema covers `role` because the server sets it, never the
      // client — so this enum is its only guard.
      enum: ['user', 'admin'],
      default: 'user',
    },
    // Bumped on logout. Refresh tokens embed the version they were minted with,
    // so incrementing this invalidates every refresh token already handed out.
    tokenVersion: {
      type: Number,
      default: 0,
    },

    /**
     * Whether the address has been proven to belong to this person.
     *
     * Defaults to TRUE on purpose. Existing documents — including the admin
     * created by `npm run seed` — carry no such field, and Mongoose applies this
     * default when they are read, so they stay able to log in. New registrations
     * pass `emailVerified: false` EXPLICITLY. Flipping this default to false
     * would lock every existing account out of the system on deploy.
     */
    emailVerified: {
      type: Boolean,
      default: true,
    },
    // OTP state. select:false for the same reason as `password`: these are
    // credentials, and no handler that returns a user should be able to leak them.
    emailOtpHash: { type: String, default: null, select: false },
    emailOtpExpiresAt: { type: Date, default: null, select: false },
    // Drives the resend cooldown, which is also what stops register-spam from
    // being used to mail-bomb an address.
    emailOtpRequestedAt: { type: Date, default: null, select: false },
    // Wrong guesses against the current code. Burns the code at OTP_MAX_ATTEMPTS.
    emailOtpAttempts: { type: Number, default: 0, select: false },

    // Password-reset OTP state. A SEPARATE set from emailOtp* above, not a
    // reuse of it: the two flows can be live at the same time (an unverified
    // user who has also forgotten their password), and sharing one set would
    // mean issuing one code silently invalidates the other — which the
    // recipient would experience as a code from their inbox simply not working.
    // select:false for the same reason as `password`: these are credentials,
    // and no handler that returns a user should be able to leak them.
    // See services/passwordReset.js, which owns this half of the lifecycle.
    passwordResetOtpHash: { type: String, default: null, select: false },
    passwordResetOtpExpiresAt: { type: Date, default: null, select: false },
    // Drives the reset resend cooldown, which is also what stops this endpoint
    // from being used to mail-bomb an address.
    passwordResetOtpRequestedAt: { type: Date, default: null, select: false },
    passwordResetOtpAttempts: { type: Number, default: 0, select: false },

    // --- Google identity ---
    //
    // No `default` on purpose. With `default: null` every password-only user
    // would carry googleId: null, and a unique index counts explicit nulls — the
    // second such user would collide. Left absent instead, and the index below
    // is partial rather than sparse (sparse skips MISSING fields but still
    // indexes nulls, so it would not save us either).
    googleId: { type: String },
    authProvider: {
      type: String,
      enum: ['email', 'google', 'both'],
      default: 'email',
    },
    avatarUrl: { type: String, default: null },
  },
  { timestamps: true }
);

// Unique only over documents that actually have a googleId string.
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
);

// Hash the password before saving (only when it changed).
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance helper to compare a plaintext password with the stored hash.
// A Google-only account has no password. bcrypt.compare(x, undefined) throws,
// which would turn an ordinary failed login into a 500 — so answer false.
userSchema.methods.matchPassword = function (entered) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
