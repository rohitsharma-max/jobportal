import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';

// Wraps routes that need authentication.
// - requireAdmin: also require the user to be an admin.
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;

  if (!user) {
    // Send to login, remembering where they wanted to go.
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return (
      <div className="center-narrow">
        <div className="big-icon">🚫</div>
        <h2>Admins only</h2>
        <p className="muted">You don't have access to this page.</p>
      </div>
    );
  }

  return children;
}
