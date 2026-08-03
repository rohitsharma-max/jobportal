const mongoose = require('mongoose');
const { OPPORTUNITY_PUBLIC_STATUS } = require('../config/constants');

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
    // Lifecycle state — see OPPORTUNITY_STATUSES in config/constants.js.
    // Deleting sets this to 'archived' rather than removing the document, so an
    // applicant's approved application never points at a row that vanished.
    status: {
      type: String,
      trim: true,
      default: OPPORTUNITY_PUBLIC_STATUS,
    },
  },
  { timestamps: true }
);

// Indexes for the two shapes the listing query actually takes. Both lead with
// `status` because every public read filters on it first, and end with
// `createdAt` because every listing is sorted newest-first — so Mongo can serve
// the sort from the index instead of collecting and sorting in memory.
opportunitySchema.index({ status: 1, createdAt: -1 });
opportunitySchema.index({ status: 1, domain: 1, createdAt: -1 });

// NOTE: `?search=` is deliberately NOT indexed. It compiles to a
// case-insensitive unanchored $regex, which no B-tree index can serve, so that
// path remains a collection scan. A $text index would be indexable but matches
// whole stemmed words — "fron" would stop matching "Frontend Developer" and
// break the search-as-you-type box. The real fix is Atlas Search with an
// autocomplete analyzer; until then the limitation is known, not hidden.

module.exports = mongoose.model('Opportunity', opportunitySchema);
