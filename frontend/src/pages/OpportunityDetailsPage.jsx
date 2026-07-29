import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import Loader from '../components/Loader';

export default function OpportunityDetailsPage() {
  const { id } = useParams();
  const [opp, setOpp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api
      .get(`/opportunities/${id}`)
      .then((res) => {
        if (active) setOpp(res.data.data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.status === 404
              ? 'Opportunity not found.'
              : 'Something went wrong loading this opportunity.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <Loader label="Loading opportunity…" />;

  if (error) {
    return (
      <div className="center-narrow">
        <div className="big-icon">🔍</div>
        <h2>{error}</h2>
        <Link to="/" className="btn btn-primary">
          Back to opportunities
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link to="/" className="back-link">
        ← Back to opportunities
      </Link>

      <div className="card">
        <div className="detail-head">
          <div>
            <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>{opp.title}</h1>
            <div className="company" style={{ fontSize: '1rem' }}>
              {opp.company}
            </div>
          </div>
          <Link to={`/opportunities/${opp._id}/apply`} className="btn btn-primary">
            Apply now
          </Link>
        </div>

        <div className="opp-card-meta">
          <span className="badge badge-primary">{opp.domain}</span>
          <span className="badge badge-type">{opp.type}</span>
        </div>

        <div className="detail-grid">
          {opp.location && (
            <div>
              <div className="label">Location</div>
              <div className="value">{opp.location}</div>
            </div>
          )}
          {opp.experience && (
            <div>
              <div className="label">Experience</div>
              <div className="value">{opp.experience}</div>
            </div>
          )}
          {opp.stipendOrSalary && (
            <div>
              <div className="label">Stipend / Salary</div>
              <div className="value">{opp.stipendOrSalary}</div>
            </div>
          )}
        </div>

        <h3>Description</h3>
        <p className="muted" style={{ whiteSpace: 'pre-line', color: 'var(--text)' }}>
          {opp.description}
        </p>

        {opp.requirements?.length > 0 && (
          <>
            <h3 style={{ marginTop: 20 }}>Requirements</h3>
            <div className="chips">
              {opp.requirements.map((r, i) => (
                <span key={i} className="badge">
                  {r}
                </span>
              ))}
            </div>
          </>
        )}

        {opp.applicationLink && (
          <p style={{ marginTop: 20 }}>
            <a href={opp.applicationLink} target="_blank" rel="noreferrer" className="back-link">
              External application link ↗
            </a>
          </p>
        )}
      </div>
    </>
  );
}
