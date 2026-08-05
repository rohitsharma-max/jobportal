import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function MainLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page">
        <div className="container">
          <Outlet />
        </div>
      </main>
      {/* Footer.jsx has existed since the start but was never rendered
          anywhere, so every page just ended against the bottom of the shell.
          It goes after <main>, outside .page's .container, so its border and
          background run the full width while its text still aligns to the
          container via its own. */}
      {/* <Footer /> */}
    </div>
  );
}
