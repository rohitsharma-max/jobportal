import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Loader from '../components/Loader';

const statusClass = {
  Pending: 'badge-warning',
  Approved: 'badge-success',
  Rejected: 'badge-danger',
};

export default function CustomerDashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/applications/me')
      .then((res) => setApplications(res.data.data))
      .catch(() => setError('Could not load your applications.'))
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (date) => new Date(date).toLocaleDateString();
  const counts = applications.reduce(
    (acc, application) => {
      const status = application.status || 'Pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { Pending: 0, Approved: 0, Rejected: 0 }
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My Applications</h1>
          <p className="muted page-subtitle">Track every job and internship you applied for.</p>
        </div>
        <Link to="/" className="btn btn-primary">Browse opportunities</Link>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span>Total</span><strong>{applications.length}</strong></div>
            <div className="stat-card"><span>Pending</span><strong>{counts.Pending}</strong></div>
            <div className="stat-card"><span>Approved</span><strong>{counts.Approved}</strong></div>
            <div className="stat-card"><span>Rejected</span><strong>{counts.Rejected}</strong></div>
          </div>

          {applications.length === 0 ? (
            <div className="state">You have not applied anywhere yet.</div>
          ) : (
            <div className="application-list">
              {applications.map((application) => {
                const opportunity = application.opportunityId;
                return (
                  <article className="application-card" key={application._id}>
                    <div>
                      <div className="card-kicker">{opportunity?.domain || 'Opportunity'}</div>
                      <h2>{opportunity?.title || 'Deleted opportunity'}</h2>
                      <p className="muted">
                        {opportunity ? `${opportunity.company} - ${opportunity.type}` : 'This opportunity is no longer available'}
                      </p>
                    </div>
                    <div className="application-meta">
                      <span className={`badge ${statusClass[application.status || 'Pending'] || ''}`}>{application.status || 'Pending'}</span>
                      <span>Applied {fmtDate(application.createdAt)}</span>
                      {application.reviewedAt && <span>Reviewed {fmtDate(application.reviewedAt)}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
