import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import OpportunityForm from '../../components/OpportunityForm';

export default function AddOpportunity() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/opportunities', payload);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create opportunity.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Link to="/admin" className="back-link">
        ← Back to dashboard
      </Link>
      <div className="card">
        <h1 style={{ fontSize: '1.5rem' }}>Add Opportunity</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <OpportunityForm onSubmit={handleSubmit} submitting={submitting} submitLabel="Create opportunity" />
      </div>
    </>
  );
}
