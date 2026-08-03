import { LIMITS } from '../utils/validationRules';

// Controlled search input. Value + onChange are owned by the parent (HomePage)
// so the search term can be combined with the domain filter — "lifting state up".
// maxLength matches the backend query schema, so the API can never reject what
// the user is able to type.
export default function SearchBar({ value, onChange }) {
  return (
    <input
      className="search"
      type="search"
      aria-label="Search opportunities by title or company"
      placeholder="Search by title or company…"
      maxLength={LIMITS.search.max}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
