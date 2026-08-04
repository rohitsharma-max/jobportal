// Entry point: load env, connect to DB, then start the HTTP server.
require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { assertRequiredEnv } = require('./src/config/env');

const PORT = process.env.PORT || 5000;

let server;

/**
 * Stop accepting new connections, let in-flight requests finish, then close the
 * database. Without this, a deploy or `docker stop` kills the process mid-request
 * and the client sees a dropped connection instead of a response.
 *
 * The timer is the backstop: if a request hangs, exit anyway rather than sit
 * there until the platform issues SIGKILL.
 */
function shutdown(signal, exitCode = 0) {
  console.log(`\n${signal} received — shutting down gracefully…`);

  const forceExit = setTimeout(() => {
    console.error('Shutdown timed out after 10s — forcing exit.');
    process.exit(1);
  }, 10_000);
  // Don't let the timer itself keep the event loop alive.
  forceExit.unref();

  const closeDb = () =>
    mongoose.connection
      .close(false)
      .then(() => {
        console.log('MongoDB connection closed.');
        process.exit(exitCode);
      })
      .catch((err) => {
        console.error('Error closing MongoDB:', err.message);
        process.exit(1);
      });

  if (server) server.close(closeDb);
  else closeDb();
}

// SIGTERM is what container platforms (Render, Docker, Kubernetes) send first.
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A rejected promise nobody handled leaves the process in an unknown state.
// Log it loudly and exit non-zero so the platform restarts a clean instance,
// rather than silently continuing to serve from a corrupted one.
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
  shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  // No graceful path here — the process is not in a state to be trusted.
  process.exit(1);
});

// Fail before opening a database connection or a port: a process that boots with
// a missing secret serves broken auth instead of telling anyone why.
try {
  const { warnings } = assertRequiredEnv();
  for (const warning of warnings) console.warn(`⚠️  ${warning}`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

// Connect to MongoDB first, then start listening.
connectDB()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  });
