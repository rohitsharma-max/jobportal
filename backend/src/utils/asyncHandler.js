// Wraps an async controller so any thrown/rejected error is forwarded to
// Express's error handling middleware (our errorHandler) instead of crashing.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
