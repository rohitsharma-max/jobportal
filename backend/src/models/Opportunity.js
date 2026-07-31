const mongoose = require('mongoose');

// NOTE: no `required` / `enum` validators here on purpose. All field validation
// lives in src/validation/schemas.js (Joi) and runs as route middleware before
// any controller — including the domain and type allow-lists, which Joi checks
// against config/constants.js. What stays is structural: types and defaults.
const opportunitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    domain: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    experience: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
    },
    stipendOrSalary: {
      type: String,
      trim: true,
      default: '',
    },
    applicationLink: {
      type: String,
      trim: true,
      default: '',
    },
    requirements: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Opportunity', opportunitySchema);
