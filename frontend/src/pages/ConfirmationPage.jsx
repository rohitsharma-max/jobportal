import { Link } from 'react-router-dom';

export default function ConfirmationPage() {
  return (
    <div className="center-narrow">
      <div className="big-icon">✅</div>
      <h2>Application submitted!</h2>
      <p className="muted">
        Thanks for applying. Your application has been received and saved.
      </p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
        Browse more opportunities
      </Link>
    </div>
  );
}
