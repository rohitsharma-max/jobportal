import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRefreshTokenDead } from '../src/api/refreshPolicy.js';

const withResponse = (status, code) => ({ response: { status, data: { code } } });

test('the four server-side rejections are fatal', () => {
  for (const code of ['REFRESH_EXPIRED', 'REFRESH_INVALID', 'REFRESH_REVOKED', 'USER_GONE']) {
    assert.equal(isRefreshTokenDead(withResponse(401, code)), true, code);
  }
});

test('a network failure or timeout is NOT fatal', () => {
  assert.equal(isRefreshTokenDead(new Error('Network Error')), false);
  assert.equal(isRefreshTokenDead({ code: 'ECONNABORTED' }), false);
  assert.equal(isRefreshTokenDead({}), false);
  assert.equal(isRefreshTokenDead(undefined), false);
});

test('being rate limited is NOT fatal', () => {
  assert.equal(isRefreshTokenDead(withResponse(429, 'RATE_LIMITED')), false);
});

test('a server error is NOT fatal', () => {
  assert.equal(isRefreshTokenDead(withResponse(500, undefined)), false);
  assert.equal(isRefreshTokenDead(withResponse(503, undefined)), false);
});

test('a 401 with an unrecognised or absent code is NOT fatal', () => {
  assert.equal(isRefreshTokenDead(withResponse(401, 'SOMETHING_NEW')), false);
  assert.equal(isRefreshTokenDead(withResponse(401, undefined)), false);
});
