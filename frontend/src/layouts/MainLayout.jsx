import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function MainLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
