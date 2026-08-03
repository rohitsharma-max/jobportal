// Route-level Joi validation middleware.
//
// Runs BEFORE the controller so controllers hold business logic only, and
// exposes a whitelisted, sanitized copy of the input on `req.valid`.
//
// Controllers must read `req.valid.body` / `req.valid.query` / `req.valid.params`
// and never `req.body` directly — `stripUnknown` is what guarantees unexpected
// keys (`role`, `_id`, `userId`, `status`, …) can never reach the database.
//
// A schema looks like:
//   { params: Joi.object({ id: objectId('Opportunity ID') }),
//     body:   Joi.object({ title: requiredText('Title', { min: 3, max: 120 }) }),
//     refine: (req, valid) => ({ field: 'message' })  // optional cross-field pass
//   }

const SOURCES = ['params', 'query', 'body'];

const JOI_OPTIONS = {
  abortEarly: false, // report EVERY bad field, not just the first
  stripUnknown: true, // drop anything the schema doesn't declare (whitelist)
  convert: true, // apply .trim() / .lowercase() / custom coercions
};

const validate = (schema) => (req, res, next) => {
  const errors = {};
  const valid = { params: {}, query: {}, body: {} };

  for (const source of SOURCES) {
    const joiSchema = schema[source];
    if (!joiSchema) continue;

    // req.body can be undefined for an unparsed content-type; treat as empty.
    const { value, error } = joiSchema.validate(req[source] || {}, JOI_OPTIONS);

    // Joi still returns the coerced value alongside the error, which lets
    // refine() inspect the fields that did pass.
    valid[source] = value || {};

    if (error) {
      for (const detail of error.details) {
        const field = detail.path.join('.') || detail.context?.key || source;
        // Keep the first message per field — with abortEarly off, one field can
        // trip several rules and only the first is worth showing.
        if (!errors[field]) errors[field] = detail.message;
      }
    }
  }

  // Cross-field and file-aware checks only run once every field is individually
  // valid, so the user isn't shown contradictory messages at the same time.
  if (schema.refine && Object.keys(errors).length === 0) {
    Object.assign(errors, schema.refine(req, valid) || {});
  }

  const failed = Object.keys(errors);
  if (failed.length > 0) {
    return res.status(400).json({
      success: false,
      data: null,
      // First error doubles as the banner message for clients that only read
      // `message`; `errors` lets a form highlight each offending input.
      message: errors[failed[0]],
      errors,
    });
  }

  req.valid = valid;
  return next();
};

module.exports = validate;
