const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertRequiredEnv } = require('../src/config/env');

const complete = {
  MONGO_URI: 'mongodb://127.0.0.1:27017/x',
  JWT_SECRET: 's'.repeat(32),
  OTP_SECRET: 'o'.repeat(32),
};

test('passes when JWT_SECRET covers both token secrets', () => {
  const { warnings } = assertRequiredEnv(complete);
  assert.deepEqual(warnings, []);
});

test('passes with explicit access and refresh secrets and no JWT_SECRET', () => {
  assertRequiredEnv({
    MONGO_URI: complete.MONGO_URI,
    OTP_SECRET: complete.OTP_SECRET,
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'r'.repeat(32),
  });
});

test('lists every missing variable in one throw', () => {
  assert.throws(
    () => assertRequiredEnv({}),
    (err) => {
      assert.match(err.message, /MONGO_URI/);
      assert.match(err.message, /JWT_ACCESS_SECRET/);
      assert.match(err.message, /JWT_REFRESH_SECRET/);
      assert.match(err.message, /OTP_SECRET/);
      return true;
    }
  );
});

test('a bare JWT_SECRET does not satisfy OTP_SECRET', () => {
  assert.throws(
    () => assertRequiredEnv({ MONGO_URI: complete.MONGO_URI, JWT_SECRET: 's'.repeat(32) }),
    /OTP_SECRET/
  );
});

test('warns about the dead JWT_EXPIRES_IN variable without failing', () => {
  const { warnings } = assertRequiredEnv({ ...complete, JWT_EXPIRES_IN: '7d' });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /JWT_EXPIRES_IN/);
});
