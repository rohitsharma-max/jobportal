import axios from 'axios';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  hasSession,
  emitLogout,
} from './tokenStore';
import { isRefreshTokenDead } from './refreshPolicy';

// One central Axios instance. Every API call imports this.
// baseURL comes from the env file so we never hardcode localhost in components.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// 20s: comfortably over a Render free-plan cold start, well under a user's
// patience. Without any timeout a hung request never settles at all.
const TIMEOUT_MS = 20_000;

const api = axios.create({ baseURL, timeout: TIMEOUT_MS });

// Bare client used ONLY for the refresh call. It deliberately has no
// interceptors — otherwise a failing refresh would try to refresh itself.
const refreshClient = axios.create({ baseURL, timeout: TIMEOUT_MS });

// Endpoints that establish a session. A 401 from these is a normal credential
// failure, not an expired session, so it must not trigger refresh-or-logout.
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/resend-otp',
  '/auth/google',
];
const isAuthEndpoint = (url = '') => AUTH_ENDPOINTS.some((path) => url.includes(path));

// Attach the access token (if present) to every request.
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * The access token lives for 1 minute, so nearly every page load will hit an
 * expired token at some point. Only ONE refresh may be in flight: if three
 * requests 401 at once they all await the same promise, then retry with the
 * single new token. Without this the three parallel refreshes would rotate the
 * refresh token three times and invalidate each other.
 */
let refreshPromise = null;

function runRefresh() {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(new Error('No refresh token available'));
  }

  refreshPromise = refreshClient
    .post('/auth/refresh', { refreshToken })
    .then((res) => {
      const data = res.data.data;
      setTokens(data); // rotates BOTH tokens
      return data.accessToken;
    })
    .catch((err) => {
      // Only a server that has actually rejected the refresh token ends the
      // session. A network failure, timeout, 429 or 5xx leaves the tokens in
      // place so the next request can try again — clearing them here is what
      // used to log people out a minute after signing in.
      if (isRefreshTokenDead(err)) {
        clearTokens();
        emitLogout('expired');
      }
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    // Network error / request cancelled — nothing to interpret.
    if (!response || !config) return Promise.reject(error);
    if (response.status !== 401) return Promise.reject(error);
    if (isAuthEndpoint(config.url)) return Promise.reject(error);

    const code = response.data?.code;

    // Expired access token: refresh once, then replay the original request.
    // `_retried` stops an infinite loop if the fresh token is somehow rejected.
    if (code === 'TOKEN_EXPIRED' && !config._retried && getRefreshToken()) {
      config._retried = true;
      try {
        const accessToken = await runRefresh();
        config.headers = { ...config.headers, Authorization: `Bearer ${accessToken}` };
        return await api(config);
      } catch {
        // runRefresh has already decided whether the session is over —
        // tokens are cleared and the logout emitted only if the refresh
        // token itself was dead. Either way this request can't succeed on
        // its own, so surface the original error.
        return Promise.reject(error);
      }
    }

    // Any other 401 (missing, malformed, or revoked token; deleted account)
    // cannot be fixed by refreshing.
    if (hasSession()) {
      clearTokens();
      emitLogout(code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid');
    }
    return Promise.reject(error);
  }
);

export default api;
