/**
 * Page controls driven by the `meta` block every list endpoint now returns:
 * { page, limit, total, totalPages, hasNext }.
 *
 * Renders nothing for a single page, so a short list looks exactly as it did
 * before pagination existed.
 */
export default function Pagination({ meta, onPageChange, label = 'results' }) {
  if (!meta || meta.totalPages <= 1) return null;

  const { page, limit, total, totalPages } = meta;

  // Human-readable range for the current page, e.g. "13–24 of 57".
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav className="pagination" aria-label={`${label} pagination`}>
      <span className="pagination-status" aria-live="polite">
        {first}–{last} of {total} {label}
      </span>

      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          ← Previous
        </button>

        <span className="pagination-page">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!meta.hasNext}
        >
          Next →
        </button>
      </div>
    </nav>
  );
}
