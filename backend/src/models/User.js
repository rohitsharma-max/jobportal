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
  },
  { timestamps: true }
);

// Hash the password before saving (only when it changed).
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance helper to compare a plaintext password with the stored hash.
userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
