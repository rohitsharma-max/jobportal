import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

/**
 * Loads the Google Identity Services script exactly once per page.
 *
 * Module-level promise rather than component state: React StrictMode mounts
 * every component twice in development, and two <script> tags would initialise
 * the library twice.
 */
let gsiPromise = null;
function loadGsi() {
  if (gsiPromise) return gsiPromise;

  const attempt = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();

    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    const script = existing || document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () =>
      reject(new Error('Could not reach Google. Check your connection or blocker.'))
    );

    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  // Success stays cached for the page's lifetime (that's the whole point of
  // the module-level promise, per the comment above). Failure does not: an
  // ad blocker, corporate proxy, or transient network blip would otherwise
  // leave gsiPromise permanently rejected, and every later mount — e.g.
  // navigating from /login to /register — would replay that same dead
  // promise forever, recoverable only by a full page reload. Clearing it here
  // gives the NEXT mount exactly one fresh attempt; it is not a retry loop or
  // backoff, since nothing here retries the current attempt itself. Guarded
  // so this only clears its OWN attempt, not a newer one already in flight.
  attempt.catch(() => {
    if (gsiPromise === attempt) gsiPromise = null;
  });

  gsiPromise = attempt;
  return gsiPromise;
}

/**
 * "Continue with Google". Renders nothing at all when VITE_GOOGLE_CLIENT_ID is
 * unset — an inert button that always errors is worse than no button.
 */
export default function GoogleSignInButton({ onSignedIn }) {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const containerRef = useRef(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  // `onSignedIn` is whatever the parent passes — often a fresh inline arrow on
  // every render (LoginPage does exactly this). If it sat in the script-loading
  // effect's dependency array below, every keystroke in the login form would
  // tear down and re-run that effect, which clears and re-renders the Google
  // iframe button: visible flicker, and a risk of stealing focus mid-typing.
  // A ref sidesteps that without letting the callback go stale — kept current
  // here, read at call time inside handleCredential instead of being closed
  // over. Do not "simplify" this back into the dependency array.
  const onSignedInRef = useRef(onSignedIn);
  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  }, [onSignedIn]);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;

    let cancelled = false;

    // Google calls this with the ID token once the user picks an account.
    const handleCredential = async (response) => {
      if (!response?.credential) {
        toast('Google did not return a credential. Please try again.', 'error');
        return;
      }
      // setBusy is UI belonging to this mounted instance — skip it once
      // cancelled, same reasoning as the finally block below.
      if (!cancelled) setBusy(true);
      try {
        // googleLogin() must run to completion even if this component has
        // since unmounted (e.g. the user navigated away from /login while the
        // Google account chooser was open, then picked an account). It calls
        // persist(), which writes the tokens and updates AuthContext's user
        // state — that's what actually establishes the session, and it is a
        // context-level concern, not this component's. Abandoning it here
        // would leave the user having authenticated with Google but never
        // actually signed into our app. So this call is deliberately NOT
        // guarded by `cancelled`.
        const user = await googleLogin(response.credential);
        // The toast is also left unguarded: ToastProvider is mounted above
        // the router (see main.jsx) and outlives this button regardless of
        // navigation, and "Signed in with Google" is true whether or not the
        // user is still looking at this page — the sign-in really happened.
        toast('Signed in with Google', 'success');
        // Navigation, in contrast, is page-level: firing it after this
        // component has unmounted would yank the user away from wherever the
        // SPA sent them in the meantime. So — like setBusy — it is guarded.
        if (!cancelled) {
          // Read from the ref, not the closed-over prop, so this always uses
          // the latest callback even though the effect that defined this
          // closure ran only once (see onSignedInRef comment above).
          const signedIn = onSignedInRef.current;
          if (signedIn) signedIn(user);
          // '/' is the public landing page now — it would only bounce a
          // non-admin straight back out to /opportunities, so go there directly.
          else navigate(user.role === 'admin' ? '/admin' : '/opportunities', { replace: true });
        }
      } catch (err) {
        // Left unguarded for the same reason as the success toast above.
        toast(
          err?.response?.data?.message || 'Google sign-in failed. Please try again.',
          'error'
        );
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    loadGsi()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredential,
        });
        // Clear first: StrictMode's second mount would otherwise stack a second
        // iframe button inside the same container.
        containerRef.current.innerHTML = '';

        const buttonWidth = Math.min(
          containerRef.current.offsetWidth,
          376
        );

        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: buttonWidth,
          text: 'continue_with',
          logo_alignment: 'center',
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });

    return () => {
      cancelled = true;
    };
    // onSignedIn is deliberately excluded: it is read live from onSignedInRef
    // inside handleCredential, not closed over. googleLogin and toast are
    // useCallback(..., [])-memoised in AuthContext/ToastProvider, and useNavigate()
    // returns a stable function reference across renders of the same router
    // (React Router v7) — so this effect now runs once per mount (twice under
    // StrictMode in dev, which the idempotent script loader and container clear
    // already handle), and never again merely because the parent re-rendered.
  }, [googleLogin, navigate, toast]);

  if (!CLIENT_ID) return null;

  return (
    <div className="google-signin">
      <div className="divider-or"><span>or</span></div>
      {loadError ? (
        <div className="alert alert-error">{loadError}</div>
      ) : (
        <div
          ref={containerRef}
          aria-busy={busy || undefined}
          style={{ display: 'flex', justifyContent: 'center', minHeight: 44, width: '100%'
           }}
        />
      )}
      {busy && <p className="muted" style={{ textAlign: 'center' }}>Signing you in…</p>}
    </div>
  );
}
