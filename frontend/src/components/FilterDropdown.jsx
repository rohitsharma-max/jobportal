// Domain filter dropdown. Options come from the backend (/api/domains) so the
// list always matches the schema enum.
export default function FilterDropdown({ value, onChange, domains }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto' }}>
      <option value="">All domains</option>
      {domains.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );
}
