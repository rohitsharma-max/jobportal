import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import Loader from '../../components/Loader';

export default function ViewApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/applications')
      .then((res) => setApplications(res.data.data))
      .catch(() => setError('Could not load applications.'))
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (d) => new Date(d).toLocaleDateString();

  return (
    <>
      <div className="page-header">
        <h1>Admin · Applications</h1>
        <Link to="/admin" className="btn btn-outline">
          ← Back to dashboard
        </Link>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : applications.length === 0 ? (
        <div className="state">No applications submitted yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Opportunity</th>
                <th>Resume</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a._id}>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td>{a.phone || '—'}</td>
                  <td>
                    {a.opportunityId
                      ? `${a.opportunityId.title} · ${a.opportunityId.company}`
                      : '(deleted opportunity)'}
                  </td>
                  <td>
                    {a.resumeLink ? (
                      <a href={a.resumeLink} target="_blank" rel="noreferrer" className="back-link" style={{ margin: 0 }}>
                        View ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{fmtDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
