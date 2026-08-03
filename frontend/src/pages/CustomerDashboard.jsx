import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

const statusClass = {
  Pending: 'badge-warning',
  Approved: 'badge-success',
  Rejected: 'badge-danger',
};

const EMPTY_SUMMARY = { total: 0, byStatus: { Pending: 0, Approved: 0, Rejected: 0 } };

export default function CustomerDashboard() {
  const [applications, setApplications] = useState([]);
  const [meta, setMeta] = useState(null);
  // Counts across the whole history. These come from the server rather than
  // being tallied from `applications`, which now holds a single page — counting
  // that would tell someone with thirty applications that they have three.
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api
      .get('/applications/me', { params: { page } })
      .then((res) => {
        if (!active) return;
        setApplications(res.data.data);
        setMeta(res.data.meta);
        setSummary(res.data.summary || EMPTY_SUMMARY);
      })
      .catch(() => {
        if (active) setError('Could not load your applications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  const fmtDate = (date) => new Date(date).toLocaleDateString();

  const goToPage = (next) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
            <div className="stat-card"><span>Total</span><strong>{summary.total}</strong></div>
            <div className="stat-card"><span>Pending</span><strong>{summary.byStatus.Pending}</strong></div>
            <div className="stat-card"><span>Approved</span><strong>{summary.byStatus.Approved}</strong></div>
            <div className="stat-card"><span>Rejected</span><strong>{summary.byStatus.Rejected}</strong></div>
          </div>

          {applications.length === 0 ? (
            <div className="state">You have not applied anywhere yet.</div>
          ) : (
            <>
              <div className="application-list">
                {applications.map((application) => {
                  const opportunity = application.opportunityId;
                  // An archived opportunity still resolves here — DELETE archives
                  // rather than destroying, so history survives. The fallback text
                  // now only covers records from before that change.
                  const isArchived = opportunity?.status === 'archived';
                  return (
                    <article className="application-card" key={application._id}>
                      <div>
                        <div className="card-kicker">{opportunity?.domain || 'Opportunity'}</div>
                        <h2>{opportunity?.title || 'Deleted opportunity'}</h2>
                        <p className="muted">
                          {opportunity
                            ? `${opportunity.company} - ${opportunity.type}`
                            : 'This opportunity is no longer available'}
                        </p>
                      </div>
                      <div className="application-meta">
                        <span className={`badge ${statusClass[application.status || 'Pending'] || ''}`}>
                          {application.status || 'Pending'}
                        </span>
                        {isArchived && <span className="badge">No longer listed</span>}
                        <span>Applied {fmtDate(application.createdAt)}</span>
                        {application.reviewedAt && <span>Reviewed {fmtDate(application.reviewedAt)}</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
              <Pagination meta={meta} onPageChange={goToPage} label="applications" />
            </>
          )}
        </>
      )}
    </>
  );
}
