import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEffectiveTheme, toggleTheme } from '../api/themeStore';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(getEffectiveTheme);
  // Mobile disclosure state. Only has any effect under 760px — above that the
  // link list is always displayed, so this flag is simply ignored (see the
  // .navbar-links rules in index.css).
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef(null);

  // logout() now also tells the server to retire this account's refresh tokens,
  // so it is async — await it before navigating away.
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleToggleTheme = () => setTheme(toggleTheme());
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  // A panel left hanging open across a navigation would cover the page the user
  // just asked for. Keyed on pathname rather than the whole location object,
  // which changes identity on every state-only update.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Escape closes it, and focus goes back to the button that opened it —
  // otherwise focus is left on a link that just became display:none, which
  // drops the keyboard user back to the top of the document.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

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

        <div className="navbar-right">
          {/* Always visible, never inside the collapsible panel: the theme
              toggle must stay reachable without opening a menu, and it has to
              work for logged-out visitors too. `order` in the stylesheet puts
              it back to the left of the links on desktop, so this DOM change
              doesn't reorder the wide layout. */}
          <div className="navbar-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={handleToggleTheme}
              aria-label={`Switch to ${nextTheme} mode`}
              title={`Switch to ${nextTheme} mode`}
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            </button>
            <button
              type="button"
              className="navbar-toggle"
              ref={toggleRef}
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="primary-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {/* Drawn, not a ☰/✕ glyph: those two characters come from
                  different fonts on most systems, so they render at different
                  weights and jump as the button toggles. */}
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                {menuOpen ? (
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M3 5h14M3 10h14M3 15h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* One click handler on the container rather than one per link:
              navigating already closes the panel via the pathname effect above,
              but tapping the link for the route you are ALREADY on doesn't
              change the pathname, so without this the panel would stay open. */}
          <div
            className={`navbar-links${menuOpen ? ' is-open' : ''}`}
            id="primary-nav"
            onClick={() => setMenuOpen(false)}
          >
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
                <span className="navbar-greeting muted">
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
      </div>
    </nav>
  );
}
