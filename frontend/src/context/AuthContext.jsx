import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  AUTH_LOGOUT_EVENT,
  clearTokens,
  hasSession,
  setTokens,
} from '../api/tokenStore';
import { useToast } from '../components/Toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until we've checked storage
  const navigate = useNavigate();
  const toast = useToast();

  // On first load, if a session exists, fetch the current user to restore it.
  // The access token may already be expired (it only lives a minute), in which
  // case the axios interceptor refreshes it transparently before this resolves.
  useEffect(() => {
    if (!hasSession()) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => {
        clearTokens(); // stale/invalid session
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // The axios layer fires this when a session ends on its own — a refresh token
  // that expired or was revoked. Clear the UI and send the user to login.
  useEffect(() => {
    const onForcedLogout = (event) => {
      setUser((current) => {
        // Only announce it if they actually were logged in.
        if (current) {
          toast(
            event.detail?.reason === 'invalid'
              ? 'Your session is no longer valid. Please log in again.'
              : 'Your session expired. Please log in again.',
            'error'
          );
          navigate('/login', { replace: true });
        }
        return null;
      });
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
  }, [navigate, toast]);

  const persist = (data) => {
    setTokens(data); // { accessToken, refreshToken }
    setUser(data.user);
  };

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    persist(res.data.data);
    return res.data.data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    persist(res.data.data);
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      // Retires every refresh token for this account server-side. Best effort —
      // the local session is cleared either way.
      await api.post('/auth/logout');
    } catch {
      // Already expired or offline; nothing to do.
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
