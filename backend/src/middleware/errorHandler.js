// Central error handler. Every controller's errors end up here so responses
// stay consistent: { success: false, data: null, message }.
// Field-level validation is handled earlier by middleware/validate.js — this is
// the safety net for anything that slips past it.
function errorHandler(err, req, res, next) {
  // An explicit err.status wins; then a status already set on the response
  // (e.g. 404); otherwise 500.
  let statusCode =
    err.status || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Server Error';
  let errors = err.errors && !err.errors.name ? err.errors : undefined;

  // Mongoose: bad ObjectId format -> 400 (not 500)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'Invalid ID format';
    errors = { [err.path]: 'Invalid ID format' };
  }

  // Mongoose: schema validation failed -> 400, one entry per offending field
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.fromEntries(
      Object.values(err.errors).map((e) => [e.path, e.message])
    );
    message = Object.values(errors).join(', ');
  }

  // MongoDB: duplicate key -> 409 Conflict (the request was well-formed, it just
  // collides with existing data)
  if (err.code === 11000) {
    statusCode = 409;
    const keys = Object.keys(err.keyValue || {});
    if (keys.includes('userId') && keys.includes('opportunityId')) {
      message = 'You have already applied to this opportunity';
    } else {
      const field = keys[0] || 'field';
      message = `That ${field} is already in use`;
      errors = { [field]: message };
    }
  }

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body is not valid JSON';
  }

  // Body larger than the configured limit
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large';
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    message,
    ...(errors ? { errors } : {}),
  });
}

module.exports = errorHandler;
