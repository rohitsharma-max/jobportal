const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, teardownTestDb, clearCollections } = require('./helpers/testApp');

let User;

before(async () => {
  await setupTestDb();
  User = require('../src/models/User');
  await User.syncIndexes(); // build the partial unique index on googleId
});

after(async () => { await teardownTestDb(); });
beforeEach(async () => { await clearCollections(); });

test('emailVerified defaults to true so pre-existing accounts keep working', async () => {
  const user = await User.create({ name: 'Legacy', email: 'legacy@x.com', password: 'secret1' });
  assert.equal(user.emailVerified, true);
  assert.equal(user.authProvider, 'email');
});

test('a registration can opt into unverified explicitly', async () => {
  const user = await User.create({
    name: 'New', email: 'new@x.com', password: 'secret1', emailVerified: false,
  });
  assert.equal(user.emailVerified, false);
});

test('OTP fields are not selected by default', async () => {
  await User.create({
    name: 'A', email: 'a@x.com', password: 'secret1',
    emailOtpHash: 'f'.repeat(64), emailOtpAttempts: 2,
  });
  const plain = await User.findOne({ email: 'a@x.com' });
  assert.equal(plain.emailOtpHash, undefined);
  const withOtp = await User.findOne({ email: 'a@x.com' }).select('+emailOtpHash +emailOtpAttempts');
  assert.equal(withOtp.emailOtpHash, 'f'.repeat(64));
  assert.equal(withOtp.emailOtpAttempts, 2);
});

test('two password-only users can coexist without colliding on googleId', async () => {
  await User.create({ name: 'A', email: 'a@x.com', password: 'secret1' });
  await User.create({ name: 'B', email: 'b@x.com', password: 'secret1' });
  const count = await User.countDocuments({});
  assert.equal(count, 2);
});

test('googleId is unique when present', async () => {
  await User.create({ name: 'A', email: 'a@x.com', googleId: 'g-1', authProvider: 'google' });
  await assert.rejects(
    () => User.create({ name: 'B', email: 'b@x.com', googleId: 'g-1', authProvider: 'google' }),
    (err) => err.code === 11000
  );
});

test('matchPassword returns false instead of throwing for a Google-only account', async () => {
  await User.create({ name: 'G', email: 'g@x.com', googleId: 'g-2', authProvider: 'google' });
  const user = await User.findOne({ email: 'g@x.com' }).select('+password');
  assert.equal(await user.matchPassword('anything'), false);
});

test('matchPassword still verifies a real password', async () => {
  await User.create({ name: 'P', email: 'p@x.com', password: 'secret1' });
  const user = await User.findOne({ email: 'p@x.com' }).select('+password');
  assert.equal(await user.matchPassword('secret1'), true);
  assert.equal(await user.matchPassword('wrong'), false);
});
