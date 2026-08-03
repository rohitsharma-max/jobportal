// Shared pagination for every list endpoint.
//
// These endpoints previously returned the entire collection on every request:
// with 5,000 listings the home page downloaded all 5,000. `limit` is capped in
// the Joi schemas, so a client cannot opt back into that by asking for more.
//
// `data` stays a plain array and the page info goes in a sibling `meta` key, so
// existing consumers that just map over `data` keep working unchanged.

/**
 * Run a paginated find alongside its count.
 *
 * @param {import('mongoose').Model} model
 * @param {object}   filter        Mongo filter
 * @param {object}   options
 * @param {number}   options.page  1-based page number (already validated)
 * @param {number}   options.limit page size (already validated and capped)
 * @param {object}   [options.sort]     defaults to newest-first
 * @param {Function} [options.decorate] wraps the Query — use for .populate()
 * @returns {Promise<{ items: any[], meta: object }>}
 */
async function paginate(model, filter, { page, limit, sort = { createdAt: -1 }, decorate }) {
  const query = model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);

  // countDocuments runs against the same filter but ignores skip/limit, so
  // `total` is the size of the whole result set, not of this page.
  const [items, total] = await Promise.all([
    decorate ? decorate(query) : query,
    model.countDocuments(filter),
  ]);

  return { items, meta: buildMeta({ page, limit, total }) };
}

/** The `meta` block, also used by callers that already have their results. */
function buildMeta({ page, limit, total }) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
  };
}

module.exports = { paginate, buildMeta };
