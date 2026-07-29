// Controlled search input. Value + onChange are owned by the parent (HomePage)
// so the search term can be combined with the domain filter — "lifting state up".
export default function SearchBar({ value, onChange }) {
  return (
    <input
      className="search"
      type="text"
      placeholder="Search by title or company…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
