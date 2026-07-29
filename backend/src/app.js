// Creates the Express app, registers global middleware, and mounts routes.
// Kept separate from server.js so it can be imported in tests without starting a server.
const express = require('express');
const cors = require('cors');

const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { DOMAINS } = require('./config/constants');

const authRoutes = require('./routes/authRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const applicationRoutes = require('./routes/applicationRoutes');

const app = express();

// --- Global middleware ---
app.use(cors()); // allow the React frontend to call this API
app.use(express.json()); // parse JSON request bodies into req.body

// --- Health check (proves the server is up) ---
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok', uptime: process.uptime() },
    message: 'API is healthy',
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
