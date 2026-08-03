import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Loader from '../../components/Loader';
import Pagination from '../../components/Pagination';
import { useToast } from '../../components/Toast';

// Admins see every lifecycle state, so the table has to show which is which.
const statusClass = {
  open: 'badge-success',
  draft: 'badge-warning',
  closed: 'badge-warning',
  archived: 'badge-danger',
};

const STATUS_FILTERS = ['All', 'open', 'draft', 'closed', 'archived'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [opportunities, setOpportunities] = useState([]);
  const [meta, setMeta] = useState(null);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const params = { page };
    if (statusFilter !== 'All') params.status = statusFilter;

    Promise.all([
      api.get('/opportunities', { params }),
      api.get('/applications/stats'),
    ])
      .then(([opportunityRes, statsRes]) => {
        if (!active) return;
        setOpportunities(opportunityRes.data.data);
        setMeta(opportunityRes.data.meta);
        setStats(statsRes.data.data);
      })
      .catch(() => {
        if (active) setError('Could not load admin dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, statusFilter]);

  const changeFilter = (value) => {
    setStatusFilter(value);
    // A filtered set is smaller, so keeping the page would land on an empty one.
    setPage(1);
  };

  // Deleting archives rather than destroys, so applicants keep their history.
  // The confirm text says as much, and the response reports what was preserved.
  const handleDelete = async (id, title) => {
    const confirmed = window.confirm(
      `Archive "${title}"?\n\nIt will be removed from the public listings and stop accepting applications. Existing applications are kept so applicants keep their history.`
    );
    if (!confirmed) return;

    try {
      const res = await api.delete(`/opportunities/${id}`);
      toast(res.data.message || `"${title}" archived.`, 'success');
      setOpportunities((prev) =>
        prev.map((o) => (o._id === id ? { ...o, status: 'archived' } : o))
      );
    } catch (err) {
      toast(err.response?.data?.message || 'Archive failed. Please try again.', 'error');
    }
  };

  const handleStatusChange = async (id, status, title) => {
    try {
      const res = await api.patch(`/opportunities/${id}/status`, { status });
      setOpportunities((prev) => prev.map((o) => (o._id === id ? res.data.data : o)));
      toast(`"${title}" is now ${status}.`, 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Could not change status.', 'error');
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
              {/* meta.total counts the whole filtered set, not just this page. */}
              <div className="stat-card"><span>Roles listed</span><strong>{meta?.total ?? 0}</strong></div>
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
                  <strong>{application.status || 'Pending'}</strong>
                </div>
              ))}
            </section>
          )}

          <form className="admin-filterbar" onSubmit={(e) => e.preventDefault()}>
            <select
              value={statusFilter}
              aria-label="Filter opportunities by status"
              onChange={(e) => changeFilter(e.target.value)}
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </form>

          {opportunities.length === 0 ? (
            <div className="state">
              {statusFilter === 'All'
                ? 'No opportunities yet. Add your first one.'
                : `No ${statusFilter} opportunities.`}
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Company</th>
                      <th>Domain</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opportunity) => {
                      const status = opportunity.status || 'open';
                      return (
                        <tr key={opportunity._id}>
                          <td>{opportunity.title}</td>
                          <td>{opportunity.company}</td>
                          <td>{opportunity.domain}</td>
                          <td>{opportunity.type}</td>
                          <td>
                            <span className={`badge ${statusClass[status] || ''}`}>{status}</span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => navigate(`/admin/edit/${opportunity._id}`)}
                              >
                                Edit
                              </button>
                              {status === 'open' ? (
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() =>
                                    handleStatusChange(opportunity._id, 'closed', opportunity.title)
                                  }
                                >
                                  Close
                                </button>
                              ) : (
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() =>
                                    handleStatusChange(opportunity._id, 'open', opportunity.title)
                                  }
                                >
                                  Reopen
                                </button>
                              )}
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={status === 'archived'}
                                onClick={() => handleDelete(opportunity._id, opportunity.title)}
                              >
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination meta={meta} onPageChange={setPage} label="opportunities" />
            </>
          )}
        </>
      )}
    </>
  );
}
