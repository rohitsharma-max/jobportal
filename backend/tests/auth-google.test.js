const { test, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { setupTestDb, teardownTestDb, clearCollections, buildApp } = require('./helpers/testApp');

let app;
let User;
let googleAuth;

const IDENTITY = {
  googleId: 'google-uid-1',
  email: 'rohit@example.com',
  name: 'Rohit Sharma',
  picture: 'https://lh3.googleusercontent.com/a/photo',
  emailVerified: true,
};

// Stubs the one seam that talks to Google. Nothing here reaches the network.
function stubGoogle(identity = IDENTITY) {
  mock.method(googleAuth, 'verifyGoogleIdToken', async () => identity);
}

before(async () => {
  await setupTestDb();
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  app = buildApp();
  User = require('../src/models/User');
  googleAuth = require('../src/services/googleAuth');
  await User.syncIndexes();
});

after(async () => { await teardownTestDb(); });

beforeEach(async () => {
  await clearCollections();
  mock.restoreAll();
});

test('a first-time Google sign-in creates a verified user and a working session', async () => {
  stubGoogle();

  const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, IDENTITY.email);
  assert.equal(res.body.data.user.emailVerified, true);
  assert.equal(res.body.data.user.authProvider, 'google');
  assert.ok(res.body.data.accessToken);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${res.body.data.accessToken}`);
  assert.equal(me.status, 200);

  const user = await User.findOne({ email: IDENTITY.email });
  assert.equal(user.googleId, IDENTITY.googleId);
  assert.equal(user.role, 'user');
  assert.equal(user.avatarUrl, IDENTITY.picture);
});

test('signing in twice reuses the account instead of duplicating it', async () => {
  stubGoogle();
  await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });
  await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });
  assert.equal(await User.countDocuments({}), 1);
});

test('an existing password account is linked, not duplicated', async () => {
  await User.create({
    name: 'Rohit Sharma', email: IDENTITY.email, password: 'secret1', emailVerified: true,
  });
  stubGoogle();

  const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.authProvider, 'both');
  assert.equal(await User.countDocuments({}), 1);
  const user = await User.findOne({ email: IDENTITY.email }).select('+password');
  assert.equal(user.googleId, IDENTITY.googleId);
  assert.ok(user.password, 'the existing password must survive linking');
});

// Attack A: registration proves nothing, so an unverified account's password
// may have been set by an attacker who registered the victim's address with a
// password of their own choosing — the victim never got a chance to prove
// they owned the mailbox before this point. If Google linking kept that
// password (as it did before FIX 1a), the attacker's password would silently
// become valid for logging in to the victim's now-verified account.
test('linking an unverified account discards its password instead of blessing it', async () => {
  const attackerPassword = 'attackerpw1';
  await request(app).post('/api/auth/register').send({
    name: 'Attacker Name', email: IDENTITY.email, password: attackerPassword,
  });
  stubGoogle();

  const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.authProvider, 'google');
  assert.equal(res.body.data.user.name, IDENTITY.name);
  assert.equal(await User.countDocuments({}), 1);

  // The attacker's password must not authenticate the now-verified account.
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: IDENTITY.email, password: attackerPassword });
  assert.equal(login.status, 401);
  assert.equal(login.body.code, 'BAD_CREDENTIALS');

  // Not just undefined-in-memory: gone from the stored document too.
  const raw = await User.collection.findOne({ email: IDENTITY.email });
  assert.equal(
    Object.prototype.hasOwnProperty.call(raw, 'password'),
    false,
    'password field must be unset in the raw document, not merely falsy'
  );
});

// Guard against over-correcting FIX 1a: an address proven verified BEFORE
// Google arrives is genuinely safe to keep the password for (this is the
// existing "an existing password account is linked, not duplicated" test's
// scenario), and that password must still work afterwards.
test('a verified account linked via Google still authenticates with its original password', async () => {
  const password = 'secret1';
  await User.create({
    name: 'Rohit Sharma', email: IDENTITY.email, password, emailVerified: true,
  });
  stubGoogle();
  await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: IDENTITY.email, password });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.authProvider, 'both');
});

test('linking also verifies a previously unverified account', async () => {
  await request(app).post('/api/auth/register').send({
    name: 'Rohit Sharma', email: IDENTITY.email, password: 'secret1',
  });
  stubGoogle();

  await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });

  const user = await User.findOne({ email: IDENTITY.email });
  assert.equal(user.emailVerified, true);

  // clearOtp(user) runs against a document the handler's own findOne never
  // `select`ed the OTP fields on (see googleSignIn) — it works only because
  // Mongoose marks an assigned path modified regardless of whether it was
  // selected. That is non-obvious enough that a refactor could silently
  // break it and leave a stale OTP hash on a now-verified account, so assert
  // on the RAW document (bypassing the model, and therefore its selection
  // and default rules) that every OTP field genuinely persisted as cleared.
  const raw = await User.collection.findOne({ email: IDENTITY.email });
  assert.equal(raw.emailOtpHash, null);
  assert.equal(raw.emailOtpExpiresAt, null);
  assert.equal(raw.emailOtpRequestedAt, null);
  assert.equal(raw.emailOtpAttempts, 0);
});

// Two concurrent first-time Google sign-ins for the same identity can both
// miss the googleId lookup and both call User.create; the loser hits the
// unique partial index and must recover instead of leaking a raw Mongo 409.
//
// Forced via a stub on User.create rather than real concurrency (spinning up
// two overlapping requests against this in-memory test server is not
// reliably deterministic), but the stub does not fabricate the error itself
// — that would only prove the catch branch handles whatever shape we invented.
// Instead it inserts a document with the same googleId directly into the
// collection (simulating the "winning" concurrent request finishing first),
// then calls straight through to the real, unstubbed User.create. That call
// collides with the actual unique index enforced by the real database, so
// the duplicate-key error reaching the controller's catch block is genuine —
// the same error MongoDB would raise under a real race — not a stand-in.
test('a race between two first-time Google sign-ins recovers instead of leaking a raw duplicate-key error', async () => {
  stubGoogle();

  const realCreate = User.create.bind(User);
  mock.method(User, 'create', async (doc) => {
    // The "winner": lands in the collection first, exactly as a concurrent
    // request's own User.create would.
    await User.collection.insertOne({
      ...doc,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // The "loser": this call now genuinely collides with the document just
    // inserted above, via the real unique partial index on googleId.
    return realCreate(doc);
  });

  const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, IDENTITY.email);
  assert.equal(res.body.data.user.authProvider, 'google');
  assert.ok(res.body.data.accessToken);
  // Recovered onto the winner's account rather than erroring — and did not
  // create a second document alongside it.
  assert.equal(await User.countDocuments({}), 1);
});

test('an unverified Google email is refused', async () => {
  stubGoogle({ ...IDENTITY, emailVerified: false });

  const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'GOOGLE_EMAIL_UNVERIFIED');
  assert.equal(await User.countDocuments({}), 0);
});

test('an invalid token is a 401', async () => {
  mock.method(googleAuth, 'verifyGoogleIdToken', async () => {
    throw new Error('Wrong recipient, payload audience != requiredAudience');
  });

  const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'GOOGLE_TOKEN_INVALID');
});

test('a missing idToken is a validation error', async () => {
  const res = await request(app).post('/api/auth/google').send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.errors.idToken, 'Google credential is required');
});

test('the endpoint reports 503 when GOOGLE_CLIENT_ID is unset', async () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  try {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(40) });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, 'GOOGLE_NOT_CONFIGURED');
  } finally {
    process.env.GOOGLE_CLIENT_ID = saved;
  }
});
