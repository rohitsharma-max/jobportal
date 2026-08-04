/**
 * Single owner of the theme preference in localStorage, mirroring tokenStore.js
 * so no component reaches into localStorage directly and risks disagreeing
 * with the inline bootstrap script in index.html about what's stored.
 *
 * THEME_KEY must stay byte-for-byte identical to the key read by the inline
 * <script> in index.html. That script runs before this module is even
 * fetched (see index.html for why it has to be inline and synchronous), so
 * it can't import this constant — the two are kept in sync by hand. If you
 * change THEME_KEY, change the literal in index.html too.
 */
const THEME_KEY = 'theme';
const LIGHT = 'light';
const DARK = 'dark';

function systemPrefersDark() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** The user's explicit choice, or null when they're following the system. */
export function getStoredPreference() {
  const value = localStorage.getItem(THEME_KEY);
  return value === LIGHT || value === DARK ? value : null;
}

/** What's actually rendered right now: the explicit choice, else the OS setting. */
export function getEffectiveTheme() {
  return getStoredPreference() ?? (systemPrefersDark() ? DARK : LIGHT);
}

function applyTheme(preference) {
  // Only stamp the attribute for an explicit choice. Leaving it absent when
  // there is none is what lets the :not([data-theme='light']) guard in
  // index.css tell "no opinion" apart from "explicitly chose light".
  if (preference === null) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', preference);
  }
}

/** Persist an explicit choice (or clear it to go back to following the OS) and apply it. */
export function setThemePreference(preference) {
  if (preference === null) {
    localStorage.removeItem(THEME_KEY);
  } else {
    localStorage.setItem(THEME_KEY, preference);
  }
  applyTheme(preference);
}

/** Flip the effective theme and land on an explicit choice; returns the new theme. */
export function toggleTheme() {
  const next = getEffectiveTheme() === DARK ? LIGHT : DARK;
  setThemePreference(next);
  return next;
}

// Re-apply whatever's stored as soon as this module loads. The inline script
// in index.html already set the attribute before first paint for an explicit
// choice; this just keeps this module's own notion of "current theme" in
// sync with the DOM rather than trusting a value that could be stale.
applyTheme(getStoredPreference());
