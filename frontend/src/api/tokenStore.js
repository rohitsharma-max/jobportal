/**
 * Single owner of the tokens in localStorage.
 *
 * Both the axios interceptors and AuthContext read/write through here so they
 * can never disagree about what the current session is.
 */

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const LEGACY_KEY = 'token'; // the old single 7-day token
const SCHEME_KEY = 'authScheme';

/**
 * Which server-side session scheme the stored tokens belong to. Bump this
 * whenever a change makes existing tokens unusable.
 *
 *   1 — access + refresh pair, refresh tokens not tracked server-side
 *   2 — refresh tokens recorded per session and revocable
 */
const AUTH_SCHEME = '2';

// Fired when the session ends for a reason the user didn't ask for (refresh
// token expired or revoked). AuthContext listens and clears the UI.
export const AUTH_LOGOUT_EVENT = 'auth:logout';

function dropStoredTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(LEGACY_KEY);
}

/**
 * Discard sessions the server can no longer honour.
 *
 * Tokens from the original single-token scheme carry no `type` claim and use a
 * different secret, so they can never verify. Scheme-1 refresh tokens verify
 * fine but have no row in the server's session store, so /auth/refresh now
 * answers REFRESH_INVALID.
 *
 * Dropping them up front matters for the second case: a scheme-1 access token
 * may still be unexpired, so the user would look signed in, work for up to a
 * minute, and then get bounced to the login screen mid-task when the first
 * refresh failed. Clearing on load turns that into a plain "please log in".
 */
if (localStorage.getItem(SCHEME_KEY) !== AUTH_SCHEME) {
  dropStoredTokens();
  localStorage.setItem(SCHEME_KEY, AUTH_SCHEME);
}

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const hasSession = () => Boolean(getAccessToken() || getRefreshToken());

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(SCHEME_KEY, AUTH_SCHEME);
}

export function clearTokens() {
  dropStoredTokens();
}

export function emitLogout(reason = 'expired') {
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason } }));
}
