/**
 * FUEL — Auth shell.
 * Google Sign-In → Supabase signInWithIdToken → email gate → main app.
 * Pattern ported from rogers-family-meal-planner's App.js, simplified
 * (no calendar account linking — FUEL doesn't need it yet).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import FuelTracker from './FuelTracker';
import { ALLOWED_EMAILS, GOOGLE_CLIENT_ID } from './lib/constants';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('FUEL crashed:', err, info); }
  handleReset = () => {
    try { sessionStorage.clear(); } catch {}
    window.location.reload();
  };
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-mark"><span className="fuel-mark">FUEL</span></div>
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <p className="auth-tagline">FUEL hit an error and couldn't recover.</p>
          <pre style={{ background: 'var(--bg-elev-1)', padding: 10, borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {String(this.state.err?.message || this.state.err)}
          </pre>
          <button className="fuel-btn fuel-btn-primary" onClick={this.handleReset}>Reset & reload</button>
        </div>
      </div>
    );
  }
}

function isEmailAllowed(email) {
  return ALLOWED_EMAILS.includes((email || '').toLowerCase().trim());
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const googleBtnRef = useRef(null);
  const gsiInitialized = useRef(false);

  const handleCredentialResponse = useCallback(async (response) => {
    try {
      setAuthError('');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      });
      if (error) {
        console.error('Supabase auth error:', error);
        setAuthError('Sign-in failed: ' + error.message);
        return;
      }
      const userEmail = data?.user?.email;
      if (!isEmailAllowed(userEmail)) {
        console.warn('Unauthorized email attempted login:', userEmail);
        await supabase.auth.signOut();
        setAuthError('Access denied. FUEL is restricted to authorized accounts.');
        return;
      }
    } catch (err) {
      console.error('Sign-in error:', err);
      setAuthError('Sign-in failed. Please try again.');
    }
  }, []);

  const initializeGSI = useCallback(() => {
    if (gsiInitialized.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    if (googleBtnRef.current) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 300,
      });
      gsiInitialized.current = true;
    }
  }, [handleCredentialResponse]);

  // Restore session + subscribe to auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s && !isEmailAllowed(s.user?.email)) {
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(s);
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (s && !isEmailAllowed(s.user?.email)) {
        supabase.auth.signOut();
        setSession(null);
        setAuthError('Access denied. FUEL is restricted to authorized accounts.');
      } else {
        setSession(s);
      }
      setLoading(false);
    });

    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => setTimeout(initializeGSI, 100);
      document.head.appendChild(script);
    } else if (window.google?.accounts?.id) {
      initializeGSI();
    }
    return () => subscription.unsubscribe();
  }, [initializeGSI]);

  useEffect(() => {
    if (!session && !loading && googleBtnRef.current) {
      gsiInitialized.current = false;
      initializeGSI();
    }
  }, [session, loading, initializeGSI]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    gsiInitialized.current = false;
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }, []);

  if (loading) {
    return (
      <div className="loader">
        <span className="loader-pulse" />
        <span>FUEL</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-mark"><span className="fuel-mark" style={{ fontSize: 36 }}>FUEL</span></div>
          <p className="auth-tagline">Adaptive nutrition that learns your metabolism.</p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <div ref={googleBtnRef}></div>
          </div>
          {authError && <div className="auth-error">{authError}</div>}
          <p style={{ marginTop: 24, fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
            SIGN IN WITH AN AUTHORIZED GOOGLE ACCOUNT
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <FuelTracker session={session} onSignOut={signOut} />
    </AppErrorBoundary>
  );
}
