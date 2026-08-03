const mongoose = require('mongoose');

// One document per live refresh token — the record that makes revocation
// possible. Without it, a leaked refresh token is valid for its full TTL no
// matter what the server does.
//
// Unlike the other models, this one DOES carry `required` validators. The rule
// elsewhere ("all validation lives in Joi, at the request boundary") applies to
// client-supplied fields; nothing here is ever populated from a request body.
// These are structural integrity checks on server-generated data.
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // sha256 of the raw token, never the token itself — a dump of this
    // collection yields nothing an attacker can present to /auth/refresh.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    // Every rotation of one login shares a familyId. Detecting reuse anywhere in
    // the chain lets us kill the whole chain at once.
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    // Mirrors the JWT's own `exp`, so the row and the token die together.
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    // Set to the successor's tokenHash when this token is rotated out. Purely
    // diagnostic — useful when tracing how a family was compromised.
    replacedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// TTL index: Mongo deletes each row once the token it describes has expired, so
// the collection stays bounded with no cleanup job to run or forget.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
