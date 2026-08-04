const { test, before } = require('node:test');
const assert = require('node:assert/strict');

before(() => {
  process.env.OTP_SECRET = 'o'.repeat(32);
});

const { generateOtp, hashOtp, verifyOtp } = require('../src/utils/otp');

test('generateOtp always returns exactly six digits', () => {
  for (let i = 0; i < 500; i += 1) {
    assert.match(generateOtp(), /^\d{6}$/);
  }
});

test('generateOtp is not constant', () => {
  const seen = new Set();
  for (let i = 0; i < 100; i += 1) seen.add(generateOtp());
  assert.ok(seen.size > 50, `expected varied codes, got ${seen.size} distinct`);
});

test('hashOtp is stable and case-insensitive on the email', () => {
  const a = hashOtp('User@Example.com', '123456');
  const b = hashOtp('user@example.com', '123456');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('hashOtp binds the code to the email', () => {
  assert.notEqual(hashOtp('a@b.co', '123456'), hashOtp('c@d.co', '123456'));
});

test('hashOtp depends on OTP_SECRET', () => {
  const before = hashOtp('a@b.co', '123456');
  process.env.OTP_SECRET = 'different-secret-value-here-32-chars';
  const after = hashOtp('a@b.co', '123456');
  process.env.OTP_SECRET = 'o'.repeat(32);
  assert.notEqual(before, after);
});

test('verifyOtp accepts the right code and rejects everything else', () => {
  const hash = hashOtp('a@b.co', '123456');
  assert.equal(verifyOtp('a@b.co', '123456', hash), true);
  assert.equal(verifyOtp('a@b.co', '654321', hash), false);
  assert.equal(verifyOtp('other@b.co', '123456', hash), false);
});

test('verifyOtp returns false rather than throwing on missing or malformed hashes', () => {
  assert.equal(verifyOtp('a@b.co', '123456', null), false);
  assert.equal(verifyOtp('a@b.co', '123456', ''), false);
  assert.equal(verifyOtp('a@b.co', '123456', 'deadbeef'), false);
});
