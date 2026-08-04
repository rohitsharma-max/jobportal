// The only place that talks to Google.
//
// Isolated behind one function for two reasons: the controller stays free of SDK
// detail, and tests can replace this seam (node:test's mock.method) instead of
// reaching the network. Callers MUST invoke it as `googleAuth.verifyGoogleIdToken`
// through the module object — a destructured import would bypass the stub.
const { OAuth2Client } = require('google-auth-library');

// Read lazily, not at module load: tests set GOOGLE_CLIENT_ID after requiring
// the app, and an unset value must produce a 503 rather than a crash at boot.
const clientId = () => process.env.GOOGLE_CLIENT_ID;

const isGoogleConfigured = () => Boolean(clientId());

let cachedClient = null;
let cachedForId = null;

function client() {
  const id = clientId();
  if (cachedForId !== id) {
    cachedClient = new OAuth2Client(id);
    cachedForId = id;
  }
  return cachedClient;
}

/**
 * Verifies a Google ID token and returns the identity it asserts.
 *
 * verifyIdToken checks the signature against Google's published keys, the
 * issuer, the expiry, AND the audience — `audience` is the load-bearing part:
 * without it a token minted for a DIFFERENT application would verify here, and
 * anyone with any Google client could sign in as any of our users.
 *
 * @throws when the token is missing, malformed, expired, or not ours.
 */
async function verifyGoogleIdToken(idToken) {
  const ticket = await client().verifyIdToken({ idToken, audience: clientId() });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error('Google ID token carried no subject');

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    // Google sends this as a real boolean, but be strict: a missing claim must
    // not read as verified.
    emailVerified: payload.email_verified === true,
  };
}

module.exports = { isGoogleConfigured, verifyGoogleIdToken };
