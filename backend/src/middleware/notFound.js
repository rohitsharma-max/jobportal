// Runs when no route matched. Passes a 404 error to the central error handler.
function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;
