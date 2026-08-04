const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { setupTestDb, teardownTestDb, clearCollections, buildApp } = require('./helpers/testApp');

// Stub utils/sendEmail so a delivery failure can be forced without touching
// real SMTP. Injected into require.cache BEFORE buildApp() so that
// services/emailVerification.js — which does a plain
// `const sendEmail = require('../utils/sendEmail')` — captures THIS object as
// its one and only reference for the life of this file's process. Mutating
// .isEmailConfigured/.shouldFail per-test afterwards is safe: deliverOtp reads
// .isEmailConfigured live on every call, and only invokes the function itself
// when that flag is true, so every other test in this file — which never
// touches the flag — behaves exactly as if this stub weren't here at all.
const sendEmailPath = require.resolve('../src/utils/sendEmail');
const sendEmailStub = Object.assign(
  async () => {
    if (sendEmailStub.shouldFail) throw new Error(sendEmailStub.failureMessage);
  },
  { isEmailConfigured: false, shouldFail: false, failureMessage: 'stub SMTP failure' }
);
require.cache[sendEmailPath] = {
  id: sendEmailPath,
  filename: sendEmailPath,
  loaded: true,
  exports: sendEmailStub,
};

let app;
let User;

const body = { name: 'Rohit Sharma', email: 'rohit@example.com', password: 'secret1' };

before(async () => {
  await setupTestDb();
  app = buildApp();
  User = require('../src/models/User');
  await User.syncIndexes();
});

after(async () => { await teardownTestDb(); });
beforeEach(async () => { await clearCollections(); });

test('register creates an unverified user and returns no session', async () => {
  const res = await request(app).post('/api/auth/register').send(body);

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.requiresVerification, true);
  assert.equal(res.body.data.email, 'rohit@example.com');
  // The whole point: no tokens yet.
  assert.equal(res.body.data.accessToken, undefined);
  assert.equal(res.body.data.refreshToken, undefined);

  const user = await User.findOne({ email: 'rohit@example.com' }).select(
    '+emailOtpHash +emailOtpExpiresAt +emailOtpRequestedAt'
  );
  assert.equal(user.emailVerified, false);
  assert.equal(user.authProvider, 'email');
  assert.equal(user.role, 'user');
  assert.match(user.emailOtpHash, /^[0-9a-f]{64}$/);
  assert.ok(user.emailOtpExpiresAt > new Date());
});

test('register exposes devOtp when email is unconfigured outside production', async () => {
  const res = await request(app).post('/api/auth/register').send(body);
  assert.match(res.body.data.devOtp, /^\d{6}$/);
});

test('register cannot be used to grant itself admin', async () => {
  await request(app).post('/api/auth/register').send({ ...body, role: 'admin' });
  const user = await User.findOne({ email: 'rohit@example.com' });
  assert.equal(user.role, 'user');
});

test('a verified duplicate email is rejected with 409', async () => {
  await User.create({ ...body, emailVerified: true });
  const res = await request(app).post('/api/auth/register').send(body);
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'EMAIL_TAKEN');
  assert.equal(res.body.errors.email, 'An account with this email already exists');
});

test('re-registering an unverified email past BOTH the cooldown and the OTP expiry reissues a code', async () => {
  await request(app).post('/api/auth/register').send(body);
  // Push the request timestamp outside the 60s cooldown AND the code's own
  // 10-minute TTL outside its window — this is the legitimate "I abandoned
  // signup, start over" path. (Past the cooldown alone is exactly Attack B's
  // window; see the test below.)
  await User.updateOne(
    { email: body.email },
    {
      $set: {
        emailOtpRequestedAt: new Date(Date.now() - 61_000),
        emailOtpExpiresAt: new Date(Date.now() - 1_000),
      },
    }
  );

  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...body, name: 'Rohit Kumar' });

  assert.equal(res.status, 201);
  const user = await User.findOne({ email: body.email });
  assert.equal(user.name, 'Rohit Kumar');
  assert.equal(await User.countDocuments({}), 1);
});

test('re-registering inside the cooldown is refused and changes nothing', async () => {
  await request(app).post('/api/auth/register').send(body);

  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...body, name: 'Should Not Apply' });

  assert.equal(res.status, 429);
  assert.equal(res.body.code, 'OTP_COOLDOWN');
  assert.ok(res.body.data.retryAfter > 0);
  const user = await User.findOne({ email: body.email });
  assert.equal(user.name, 'Rohit Sharma');
});

// Attack B: past the 60s resend cooldown, but the code itself (10-minute TTL)
// is still live. Before FIX 1b this window let a second registrant silently
// overwrite the name/password underneath a code already sitting in the real
// registrant's inbox — whoever entered that code then activated a stranger's
// account instead of their own.
test('re-registering while the previous code is still live is refused and changes nothing', async () => {
  await request(app).post('/api/auth/register').send(body);
  await User.updateOne(
    { email: body.email },
    { $set: { emailOtpRequestedAt: new Date(Date.now() - 61_000) } }
    // emailOtpExpiresAt is untouched: still ~10 minutes out, exactly as
    // attachOtp() left it when the original registration ran above.
  );

  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...body, name: 'Attacker Name', password: 'attackerpw1' });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'OTP_ALREADY_SENT');
  const user = await User.findOne({ email: body.email }).select('+password');
  assert.equal(user.name, 'Rohit Sharma');
  assert.ok(
    await user.matchPassword(body.password),
    'the original registrant\'s password must survive the refused attempt'
  );
});

test('register in production with mail unconfigured refuses instead of leaking a devOtp', async () => {
  // sendEmailStub.isEmailConfigured defaults to false and nothing before this
  // test in the file flips it (the mail-configured test below always restores
  // it in a finally), so this test only needs to flip NODE_ENV to exercise the
  // production branch of deliverOtp.
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await request(app).post('/api/auth/register').send(body);

    assert.equal(res.status, 503);
    assert.equal(res.body.code, 'EMAIL_NOT_CONFIGURED');
    assert.equal(res.body.data?.devOtp, undefined);
    // Nothing was saved — a rejected delivery must not leave a half-created account.
    assert.equal(await User.countDocuments({}), 0);
  } finally {
    // Restored in finally so a failed assertion above can't leak NODE_ENV into
    // every test that runs after this one in the file.
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('register when mail is configured but delivery fails returns a generic 503, never the SMTP text', async () => {
  sendEmailStub.isEmailConfigured = true;
  sendEmailStub.shouldFail = true;
  sendEmailStub.failureMessage = 'Invalid login: 535-5.7.8 Username and Password not accepted';
  try {
    const res = await request(app).post('/api/auth/register').send(body);

    assert.equal(res.status, 503);
    assert.equal(res.body.code, 'EMAIL_SEND_FAILED');
    // The part that matters: the raw SMTP text must never reach the client.
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes('535-5.7.8'));
    assert.ok(!raw.includes('Username and Password'));
    // Nothing was saved — a rejected delivery must not leave a half-created account.
    assert.equal(await User.countDocuments({}), 0);
  } finally {
    // Restored so later tests in this file see the same "mail unconfigured"
    // world they were written against.
    sendEmailStub.isEmailConfigured = false;
    sendEmailStub.shouldFail = false;
  }
});
