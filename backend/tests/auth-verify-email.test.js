const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { setupTestDb, teardownTestDb, clearCollections, buildApp } = require('./helpers/testApp');

let app;
let User;

const body = { name: 'Rohit Sharma', email: 'rohit@example.com', password: 'secret1' };

// Registers and returns the plaintext code (available as devOtp because the
// harness leaves EMAIL_USER/EMAIL_PASS unset).
async function registerAndGetOtp() {
  const res = await request(app).post('/api/auth/register').send(body);
  return res.body.data.devOtp;
}

before(async () => {
  await setupTestDb();
  app = buildApp();
  User = require('../src/models/User');
  await User.syncIndexes();
});

after(async () => { await teardownTestDb(); });
beforeEach(async () => { await clearCollections(); });

test('a correct code verifies the account and returns a usable session', async () => {
  const otp = await registerAndGetOtp();

  const res = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: body.email, otp });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.emailVerified, true);
  assert.ok(res.body.data.accessToken);
  assert.ok(res.body.data.refreshToken);

  // The session must genuinely work — this is the regression that produced the
  // original "401 after signup" report.
  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${res.body.data.accessToken}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.email, body.email);

  const user = await User.findOne({ email: body.email }).select('+emailOtpHash +emailOtpAttempts');
  assert.equal(user.emailOtpHash, null);
  assert.equal(user.emailOtpAttempts, 0);
});

test('a wrong code is rejected and increments the attempt counter', async () => {
  await registerAndGetOtp();

  const res = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: body.email, otp: '000000' });

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'OTP_INVALID');
  const user = await User.findOne({ email: body.email }).select('+emailOtpAttempts');
  assert.equal(user.emailOtpAttempts, 1);
});

test('the code is burned after OTP_MAX_ATTEMPTS wrong guesses', async () => {
  const otp = await registerAndGetOtp();

  for (let i = 0; i < 5; i += 1) {
    await request(app).post('/api/auth/verify-email').send({ email: body.email, otp: '000000' });
  }

  // Even the CORRECT code must now fail — the code is gone, not just throttled.
  const res = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: body.email, otp });

  assert.equal(res.status, 429);
  assert.equal(res.body.code, 'OTP_ATTEMPTS_EXCEEDED');
  const user = await User.findOne({ email: body.email }).select('+emailOtpHash');
  assert.equal(user.emailOtpHash, null);
});

test('an expired code is rejected', async () => {
  const otp = await registerAndGetOtp();
  await User.updateOne(
    { email: body.email },
    { $set: { emailOtpExpiresAt: new Date(Date.now() - 1000) } }
  );

  const res = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: body.email, otp });

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'OTP_EXPIRED');
});

test('an unknown email gives the same generic answer as a wrong code', async () => {
  const res = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: 'nobody@example.com', otp: '123456' });

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'OTP_INVALID');
});

test('verifying an already-verified account is a 409', async () => {
  const otp = await registerAndGetOtp();
  await request(app).post('/api/auth/verify-email').send({ email: body.email, otp });

  const res = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: body.email, otp });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'ALREADY_VERIFIED');
});

test('a malformed code is a validation error, not an attempt', async () => {
  await registerAndGetOtp();
  const res = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: body.email, otp: 'abc' });

  assert.equal(res.status, 400);
  assert.equal(res.body.errors.otp, 'Verification code must be 6 digits');
  const user = await User.findOne({ email: body.email }).select('+emailOtpAttempts');
  assert.equal(user.emailOtpAttempts, 0);
});
