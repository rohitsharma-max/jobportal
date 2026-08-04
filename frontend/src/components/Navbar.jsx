import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEffectiveTheme, toggleTheme } from '../api/themeStore';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getEffectiveTheme);

  // logout() now also tells the server to retire this account's refresh tokens,
  // so it is async — await it before navigating away.
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleToggleTheme = () => setTheme(toggleTheme());
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        {/* / is the public landing page now, not the list — a signed-in user
            clicking the brand should land on the list, not bounce through
            marketing copy (LandingPage would redirect them there anyway, but
            going straight there is one less hop and one less flash). */}
        <NavLink to={user ? '/opportunities' : '/'} className="navbar-brand">
          JobPortal
        </NavLink>
        <div className="navbar-links">
          {/* Outside the user-conditional block below on purpose: it must be
              reachable for logged-out visitors too, not just signed-in users. */}
          <button
            type="button"
            className="theme-toggle"
            onClick={handleToggleTheme}
            aria-label={`Switch to ${nextTheme} mode`}
            title={`Switch to ${nextTheme} mode`}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
          {/* No `end` needed any more: `/opportunities` (unlike `/`) doesn't
              prefix-match every route, and dropping it lets this link also
              read as active on /opportunities/:id and its /apply route. */}
          <NavLink to="/opportunities">
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
              {/* No inline color here: this renders as a filled .btn-primary, whose
                  ink is var(--on-accent) in index.css. That token flips between
                  themes (white on the dark-mode fill fails contrast — see
                  --on-accent), so a hardcoded '#fff' here would silently break
                  dark mode even though it looked like the same "constant label"
                  case as the fill color itself. */}
              <NavLink to="/register" className="btn btn-primary btn-sm">
                Register
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
