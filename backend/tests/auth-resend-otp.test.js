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

const escapeCooldown = () =>
  User.updateOne({ email: body.email }, { $set: { emailOtpRequestedAt: new Date(Date.now() - 61_000) } });

before(async () => {
  await setupTestDb();
  app = buildApp();
  User = require('../src/models/User');
  await User.syncIndexes();
});

after(async () => { await teardownTestDb(); });
beforeEach(async () => { await clearCollections(); });

test('resend inside the cooldown returns 429 with retryAfter', async () => {
  await request(app).post('/api/auth/register').send(body);

  const res = await request(app).post('/api/auth/resend-otp').send({ email: body.email });

  assert.equal(res.status, 429);
  assert.equal(res.body.code, 'OTP_COOLDOWN');
  assert.ok(res.body.data.retryAfter > 0 && res.body.data.retryAfter <= 60);
});

test('resend past the cooldown issues a different code', async () => {
  const first = await request(app).post('/api/auth/register').send(body);
  await escapeCooldown();

  const res = await request(app).post('/api/auth/resend-otp').send({ email: body.email });

  assert.equal(res.status, 200);
  assert.match(res.body.data.devOtp, /^\d{6}$/);
  // Old code must no longer work.
  const stale = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: body.email, otp: first.body.data.devOtp });
  assert.equal(stale.status, 400);
});

test('resend resets the attempt counter', async () => {
  await request(app).post('/api/auth/register').send(body);
  for (let i = 0; i < 3; i += 1) {
    await request(app).post('/api/auth/verify-email').send({ email: body.email, otp: '000000' });
  }
  await escapeCooldown();

  await request(app).post('/api/auth/resend-otp').send({ email: body.email });

  const user = await User.findOne({ email: body.email }).select('+emailOtpAttempts');
  assert.equal(user.emailOtpAttempts, 0);
});

test('an unknown email returns a generic success, not a 404', async () => {
  const res = await request(app).post('/api/auth/resend-otp').send({ email: 'nobody@example.com' });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  // Nothing that distinguishes it from the real thing.
  assert.equal(res.body.data.devOtp, undefined);
  assert.equal(await User.countDocuments({}), 0);
});

test('resending for an already-verified account is a 409', async () => {
  const reg = await request(app).post('/api/auth/register').send(body);
  await request(app)
    .post('/api/auth/verify-email')
    .send({ email: body.email, otp: reg.body.data.devOtp });

  const res = await request(app).post('/api/auth/resend-otp').send({ email: body.email });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'ALREADY_VERIFIED');
});

test('resend response message is identical for a real account and an unknown email', async () => {
  await request(app).post('/api/auth/register').send(body);
  await escapeCooldown();

  const real = await request(app).post('/api/auth/resend-otp').send({ email: body.email });
  const unknown = await request(app).post('/api/auth/resend-otp').send({ email: 'nobody2@example.com' });

  assert.equal(real.status, 200);
  assert.equal(unknown.status, 200);
  // The whole point of the generic-200 design: identical wording, or a script
  // can read `message` to learn which addresses are registered even though
  // both paths already share the same status code and data shape.
  assert.equal(real.body.message, unknown.body.message);
});

test('resend when mail is configured but delivery fails returns a generic 503, never the SMTP text', async () => {
  await request(app).post('/api/auth/register').send(body);
  await escapeCooldown();

  sendEmailStub.isEmailConfigured = true;
  sendEmailStub.shouldFail = true;
  sendEmailStub.failureMessage = 'Invalid login: 535-5.7.8 Username and Password not accepted';
  try {
    const res = await request(app).post('/api/auth/resend-otp').send({ email: body.email });

    assert.equal(res.status, 503);
    assert.equal(res.body.code, 'EMAIL_SEND_FAILED');
    // The part that matters: the raw SMTP text must never reach the client.
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes('535-5.7.8'));
    assert.ok(!raw.includes('Username and Password'));
  } finally {
    // Restored so later tests in this file see the same "mail unconfigured"
    // world they were written against.
    sendEmailStub.isEmailConfigured = false;
    sendEmailStub.shouldFail = false;
  }
});
