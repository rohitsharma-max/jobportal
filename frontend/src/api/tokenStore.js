/**
 * Single owner of the tokens in localStorage.
 *
 * Both the axios interceptors and AuthContext read/write through here so they
 * can never disagree about what the current session is.
 */

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const LEGACY_KEY = 'token'; // the old single 7-day token

// Fired when the session ends for a reason the user didn't ask for (refresh
// token expired or revoked). AuthContext listens and clears the UI.
export const AUTH_LOGOUT_EVENT = 'auth:logout';

// Tokens issued by the previous single-token scheme carry no `type` claim and
// are signed with a different secret, so they can never verify again. Drop them
// on load rather than letting the user sit in a broken half-logged-in state.
if (localStorage.getItem(LEGACY_KEY)) {
  localStorage.removeItem(LEGACY_KEY);
}

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const hasSession = () => Boolean(getAccessToken() || getRefreshToken());

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(LEGACY_KEY);
}

export function emitLogout(reason = 'expired') {
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason } }));
}
