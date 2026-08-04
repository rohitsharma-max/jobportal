const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { setupTestDb, teardownTestDb, buildApp } = require('./helpers/testApp');

let app;

before(async () => {
  await setupTestDb();
  app = buildApp();
});

after(async () => {
  await teardownTestDb();
});

test('GET /api/health reports a connected database', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.database, 'connected');
});
