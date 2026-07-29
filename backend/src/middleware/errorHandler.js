// Central error handler. Every controller's errors end up here so responses
// stay consistent: { success: false, data: null, message }.
function errorHandler(err, req, res, next) {
  // If a status was already set (e.g. 404), keep it; otherwise 500.
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || 'Server Error';

  // Mongoose: bad ObjectId format -> 400 (not 500)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Mongoose: schema validation failed -> 400
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // MongoDB: duplicate key (e.g. email already registered) -> 400
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `That ${field} is already in use`;
  }

  // Multer: file upload error (e.g. file too large) -> 400
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = `Upload error: ${err.message}`;
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    message,
  });
}

module.exports = errorHandler;
