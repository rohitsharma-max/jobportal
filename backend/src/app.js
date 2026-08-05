  // Creates the Express app, registers global middleware, and mounts routes.
  // Kept separate from server.js so it can be imported in tests without starting a server.
  const express = require('express');
  const cors = require('cors');
  const helmet = require('helmet');
  const morgan = require('morgan');
  const mongoose = require('mongoose');

  const notFound = require('./middleware/notFound');
  const errorHandler = require('./middleware/errorHandler');
  const { DOMAINS } = require('./config/constants');

  const authRoutes = require('./routes/authRoutes');
  const opportunityRoutes = require('./routes/opportunityRoutes');
  const applicationRoutes = require('./routes/applicationRoutes');

  const app = express();

  // --- Global middleware ---

  // Security headers (CSP, HSTS, X-Content-Type-Options, frame protection …).
  // `crossOriginResourcePolicy` is relaxed because the frontend is served from a
  // different origin than this API.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  /**
   * CORS allow-list.
   *
   * This used to be a bare `cors()`, which sets
   * `Access-Control-Allow-Origin: *` — every site on the internet could call the
   * API from a visitor's browser. Origins now come from CORS_ORIGINS
   * (comma-separated), so deploying only means setting the env var.
   *
   * With no CORS_ORIGINS set we fall back to the local Vite dev servers, which
   * keeps `npm run dev` working out of the box without leaving production open.
   */
  const allowedOrigins = (
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: same-origin, curl, or a server-to-server call. CORS
        // is a browser mechanism, so there is nothing to police here.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);

        // Tagged so errorHandler answers 403 rather than treating a rejected
        // origin as an unexpected server fault and returning 500.
        const err = new Error(`Origin ${origin} is not allowed by CORS`);
        err.status = 403;
        return callback(err);
      },
    })
  );

  app.use(express.json({ limit: '100kb' })); // parse JSON request bodies into req.body
  app.use(express.urlencoded({ extended: false, limit: '100kb' })); // form-encoded posts

  // Request logging. Silent under test so the suite output stays readable.
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // Rate limiters read req.ip; behind a single reverse proxy this makes it the
  // real client address instead of the proxy's.
  app.set('trust proxy', 1);

  // --- Health check ---
  //
  // Reports the database too. Returning a flat "ok" while Mongo was unreachable
  // meant a container orchestrator would keep a broken instance in rotation and
  // route traffic to it, because the process itself was alive.
  app.get('/api/health', (req, res) => {
    // 1 === connected, per mongoose.STATES
    const dbReady = mongoose.connection.readyState === 1;

    res.status(dbReady ? 200 : 503).json({
      success: dbReady,
      data: {
        status: dbReady ? 'ok' : 'degraded',
        database: dbReady ? 'connected' : 'disconnected',
        uptime: process.uptime(),
      },
      message: dbReady ? 'API is healthy' : 'API is up but the database is unreachable',
    });
  });

  // --- Fixed domain list (frontend filter dropdown reads from this) ---
  app.get('/api/domains', (req, res) => {
    res.status(200).json({ success: true, data: DOMAINS, message: 'Domains fetched' });
  });

  // --- Feature routes ---
  app.use('/api/auth', authRoutes);
  app.use('/api/opportunities', opportunityRoutes);
  app.use('/api/applications', applicationRoutes);

  // --- 404 for unknown routes, then the central error handler (must be last) ---
  app.use(notFound);
  app.use(errorHandler);

  module.exports = app;
