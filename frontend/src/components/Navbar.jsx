import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <NavLink to="/" className="navbar-brand">
          JobPortal
        </NavLink>
        <div className="navbar-links">
          <NavLink to="/" end>
            Opportunities
          </NavLink>

          {user && user.role !== 'admin' && <NavLink to="/dashboard">My Applications</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}

          {user ? (
            <>
              <span className="muted" style={{ padding: '0 8px', fontSize: '0.9rem' }}>
                Hi, {user.name.split(' ')[0]}
              </span>
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm" style={{ color: '#fff' }}>
                Register
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
