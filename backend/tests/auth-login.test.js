const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { setupTestDb, teardownTestDb, clearCollections, buildApp } = require('./helpers/testApp');

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

test('an unverified account cannot log in and is told to verify', async () => {
  await request(app).post('/api/auth/register').send(body);

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: body.email, password: body.password });

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(res.body.data.requiresVerification, true);
  assert.equal(res.body.data.email, body.email);
});

test('a verified account logs in normally', async () => {
  const reg = await request(app).post('/api/auth/register').send(body);
  await request(app)
    .post('/api/auth/verify-email')
    .send({ email: body.email, otp: reg.body.data.devOtp });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: body.email, password: body.password });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.accessToken);
});

test('a wrong password on an unverified account still reads as bad credentials', async () => {
  await request(app).post('/api/auth/register').send(body);

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: body.email, password: 'wrongpass' });

  // The verified check must run AFTER the password check, or the 403 confirms
  // the address exists to anyone who guesses it.
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'BAD_CREDENTIALS');
});

test('a Google-only account gives a generic 401, never a 500', async () => {
  await User.create({
    name: 'Google User', email: 'g@example.com', googleId: 'g-1',
    authProvider: 'google', emailVerified: true,
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'g@example.com', password: 'anything' });

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'BAD_CREDENTIALS');
  assert.equal(res.body.message, 'Invalid email or password');
});
