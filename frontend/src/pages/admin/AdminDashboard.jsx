import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Loader from '../../components/Loader';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([api.get('/opportunities'), api.get('/applications/stats')])
      .then(([opportunityRes, statsRes]) => {
        setOpportunities(opportunityRes.data.data);
        setStats(statsRes.data.data);
      })
      .catch(() => setError('Could not load admin dashboard.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/opportunities/${id}`);
      setOpportunities((prev) => prev.filter((opportunity) => opportunity._id !== id));
    } catch {
      alert('Delete failed. Please try again.');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="muted page-subtitle">Manage jobs, applications, and hiring decisions.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/admin/applications" className="btn btn-outline">View applications</Link>
          <Link to="/admin/add" className="btn btn-primary">+ Add opportunity</Link>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <>
          {stats && (
            <div className="stats-grid">
              <div className="stat-card"><span>Open roles</span><strong>{opportunities.length}</strong></div>
              <div className="stat-card"><span>Total requests</span><strong>{stats.total}</strong></div>
              <div className="stat-card"><span>Pending</span><strong>{stats.byStatus.Pending}</strong></div>
              <div className="stat-card"><span>Approved</span><strong>{stats.byStatus.Approved}</strong></div>
            </div>
          )}

          {stats?.recentApplications?.length > 0 && (
            <section className="insight-panel admin-section">
              <div className="section-head">
                <h2>Recent applications</h2>
                <Link to="/admin/applications" className="back-link">Review all</Link>
              </div>
              {stats.recentApplications.map((application) => (
                <div className="insight-row" key={application._id}>
                  <span>{application.name} - {application.opportunityId?.title || 'Deleted opportunity'}</span>
                  <strong>{application.status}</strong>
                </div>
              ))}
            </section>
          )}

          {opportunities.length === 0 ? (
            <div className="state">No opportunities yet. Add your first one.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Company</th>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opportunity) => (
                    <tr key={opportunity._id}>
                      <td>{opportunity.title}</td>
                      <td>{opportunity.company}</td>
                      <td>{opportunity.domain}</td>
                      <td>{opportunity.type}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/edit/${opportunity._id}`)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(opportunity._id, opportunity.title)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
