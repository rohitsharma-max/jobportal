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

  // Creates an UNVERIFIED account and triggers the OTP email. Deliberately does
  // NOT persist anything: there is no session until the code is verified, and
  // pretending otherwise is what produces a 401 on the very next request.
  const register = useCallback(async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    return res.data.data; // { email, requiresVerification, devOtp? }
  }, []);

  // Completing OTP verification is what actually opens the session — register
  // no longer returns tokens. Goes through persist() like every other path, so
  // the tokens reach localStorage and the next request carries them. Skipping
  // that is what produces a "401 NO_TOKEN" immediately after signing up.
  const verifyEmail = useCallback(async (email, otp) => {
    const res = await api.post('/auth/verify-email', { email, otp });
    persist(res.data.data);
    return res.data.data.user;
  }, []);

  // No session involved — just asks for a replacement code. Returns the payload
  // so the caller can read `devOtp` when the server has no mail configured.
  const resendOtp = useCallback(async (email) => {
    const res = await api.post('/auth/resend-otp', { email });
    return res.data.data;
  }, []);

  // `idToken` is the credential Google Identity Services hands us. The server
  // verifies it and returns OUR normal token pair, so nothing downstream needs
  // to know this session began with Google.
  const googleLogin = useCallback(async (idToken) => {
    const res = await api.post('/auth/google', { idToken });
    persist(res.data.data);
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      // Ends THIS session server-side only — the controller revokes the calling
      // device's refresh-token family, so other devices stay signed in. Best
      // effort: the local session is cleared either way.
      await api.post('/auth/logout');
    } catch {
      // Already expired or offline; nothing to do.
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, verifyEmail, resendOtp, googleLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
