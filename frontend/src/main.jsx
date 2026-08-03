import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {/* ToastProvider must sit OUTSIDE AuthProvider: AuthProvider calls
          useToast() to announce a session that expired on its own. */}
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
