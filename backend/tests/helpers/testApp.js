// Shared lifecycle for backend integration tests.
//
// Env vars are set BEFORE src/app.js is required, because config/cloudinary.js
// and utils/sendEmail.js read process.env at module load time. EMAIL_USER and
// EMAIL_PASS are deliberately deleted so sendEmail() no-ops and the OTP comes
// back as `devOtp` — that is how the OTP tests read the code without a mailbox.
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo = null;

// Every test FILE calls setupTestDb() in its own before() hook and gets its own
// MongoMemoryServer (own mongod child process, own port). node --test defaults
// file-level concurrency to the CPU core count, so on a machine with enough
// cores and enough test files, several mongod instances try to boot at the same
// moment and blow mongodb-memory-server's 10-second startup timeout — not
// occasionally, but reliably once there are enough files. That is why
// package.json's "test" script pins `--test-concurrency=1`: it is not a
// performance knob to "fix" later, it is what keeps this suite from failing
// most of the time. See backend/package.json.
async function setupTestDb() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
  process.env.OTP_SECRET = 'test-otp-secret-at-least-32-characters-long';
  process.env.JWT_ACCESS_EXPIRES_IN = '5m'; // long enough that tests never race the TTL
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  delete process.env.GOOGLE_CLIENT_ID;

  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
}

async function teardownTestDb() {
  // finally guarantees mongo.stop() runs even if dropDatabase/disconnect
  // throws — otherwise the in-memory mongod child process is never killed and
  // leaks for the rest of the run (13 later test files each start their own).
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  } finally {
    if (mongo) await mongo.stop();
    mongo = null;
  }
}

// Between cases. Also rebuilds indexes, which matters for the unique partial
// index on googleId — deleteMany does not drop indexes, but a fresh model in a
// fresh file would otherwise race index creation.
// mongoose.connection.collections only lists collections whose models have
// already been compiled, so this depends on buildApp() having run first in
// this file.
async function clearCollections() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

// Required lazily so env is in place first. Guards against the app module
// being require()'d — and permanently cached by Node — before setupTestDb()
// has set process.env, which would silently wire it to the wrong config for
// the rest of the process with no way to repair it later.
function buildApp() {
  if (!process.env.MONGO_URI) {
    throw new Error(
      'buildApp() called before setupTestDb() — call setupTestDb() in a before() hook first.'
    );
  }
  return require('../../src/app');
}

module.exports = { setupTestDb, teardownTestDb, clearCollections, buildApp };
