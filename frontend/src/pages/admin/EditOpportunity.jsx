import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import OpportunityForm from '../../components/OpportunityForm';
import Loader from '../../components/Loader';

export default function EditOpportunity() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch the opportunity to pre-fill the form.
  useEffect(() => {
    api
      .get(`/opportunities/${id}`)
      .then((res) => setInitial(res.data.data))
      .catch(() => setLoadError('Opportunity not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setError('');
    try {
      await api.put(`/opportunities/${id}`, payload);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update opportunity.');
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;
  if (loadError)
    return (
      <div className="center-narrow">
        <h2>{loadError}</h2>
        <Link to="/admin" className="btn btn-primary">
          Back to dashboard
        </Link>
      </div>
    );

  return (
    <>
      <Link to="/admin" className="back-link">
        ← Back to dashboard
      </Link>
      <div className="card">
        <h1 style={{ fontSize: '1.5rem' }}>Edit Opportunity</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <OpportunityForm
          initial={initial}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel="Save changes"
        />
      </div>
    </>
  );
}
