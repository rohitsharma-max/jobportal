import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Loader from '../../components/Loader';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api
      .get('/opportunities')
      .then((res) => setOpportunities(res.data.data))
      .catch(() => setError('Could not load opportunities.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/opportunities/${id}`);
      // Update state after the mutation so the list stays fresh.
      setOpportunities((prev) => prev.filter((o) => o._id !== id));
    } catch {
      alert('Delete failed. Please try again.');
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Admin · Opportunities</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/admin/applications" className="btn btn-outline">
            View applications
          </Link>
          <Link to="/admin/add" className="btn btn-primary">
            + Add opportunity
          </Link>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : opportunities.length === 0 ? (
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
              {opportunities.map((o) => (
                <tr key={o._id}>
                  <td>{o.title}</td>
                  <td>{o.company}</td>
                  <td>{o.domain}</td>
                  <td>{o.type}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/admin/edit/${o._id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(o._id, o.title)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
