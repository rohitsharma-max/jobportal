import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="center-narrow">
      <div className="big-icon">🧭</div>
      <h2>Page not found</h2>
      <p className="muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>
        Go home
      </Link>
    </div>
  );
}
