const mongoose = require('mongoose');

// NOTE: no `required` / `match` / `enum` validators here on purpose. All field
// validation lives in src/validation/schemas.js (Joi) and runs as route
// middleware before any controller. What stays is structural: types, refs,
// defaults, and the unique index below.
const applicationSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    resumeLink: {
      type: String,
      trim: true,
    },
    coverNote: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      default: 'Pending',
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// One application per user per opportunity. This is a database CONSTRAINT, not
// field validation — it is the only thing that can stop two concurrent submits
// from both passing an application-level "already applied?" check. The second
// one fails with duplicate-key error 11000, which the controller turns into 409.
applicationSchema.index({ userId: 1, opportunityId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
