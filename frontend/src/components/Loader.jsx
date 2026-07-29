export default function Loader({ label = 'Loading…' }) {
  return (
    <div className="state">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}
