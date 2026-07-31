// Two-token scheme.
//
//   access token  — short-lived (1 minute), sent as `Authorization: Bearer …`
//                   on every request. This is the token the task requires to
//                   expire after 1 minute.
//   refresh token — long-lived, used ONLY against POST /api/auth/refresh to
//                   mint a new access token. Without it a 1-minute access token
//                   would log the user out mid-form every minute.
//
// The two are signed with different secrets and carry a `type` claim, and the
// verify helpers below enforce that claim. That means a refresh token can never
// be replayed as an access token to reach a protected route, and vice versa.

const jwt = require('jsonwebtoken');

const accessSecret = () => process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const refreshSecret = () =>
  process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}:refresh`;

const accessTtl = () => process.env.JWT_ACCESS_EXPIRES_IN || '1m';
const refreshTtl = () => process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function signAccessToken(user) {
  return jwt.sign({ id: String(user._id), type: 'access' }, accessSecret(), {
    expiresIn: accessTtl(),
  });
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: String(user._id), type: 'refresh', tokenVersion: user.tokenVersion || 0 },
    refreshSecret(),
    { expiresIn: refreshTtl() }
  );
}

// Both tokens a client needs after a successful login / register / refresh.
function issueTokens(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    accessTokenExpiresIn: accessTtl(),
  };
}

function verifyTyped(token, secret, expectedType) {
  const decoded = jwt.verify(token, secret);
  if (decoded.type !== expectedType) {
    // Surface as a normal JWT failure so callers handle it in one branch.
    const err = new Error(`Expected a ${expectedType} token`);
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}

const verifyAccessToken = (token) => verifyTyped(token, accessSecret(), 'access');
const verifyRefreshToken = (token) => verifyTyped(token, refreshSecret(), 'refresh');

module.exports = {
  signAccessToken,
  signRefreshToken,
  issueTokens,
  verifyAccessToken,
  verifyRefreshToken,
};
