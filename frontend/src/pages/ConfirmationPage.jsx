import { Link } from 'react-router-dom';

export default function ConfirmationPage() {
  return (
    <div className="center-narrow">
      <div className="big-icon">Done</div>
      <h2>Application submitted!</h2>
      <p className="muted">
        Thanks for applying. Your application has been received and saved.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
        <Link to="/dashboard" className="btn btn-primary">Track status</Link>
        <Link to="/opportunities" className="btn btn-outline">Browse more</Link>
      </div>
    </div>
  );
}
