import React, { useEffect, useState } from 'react';
import { db } from '../lib/db';

import FlameIcon from './FlameIcon';

/**
 * GoogleAuth - Google Sign-In with fallback to "Continue without sign-in"
 * Uses Google Identity Services (GSI) library
 * Props: { onAuthenticated: (email?: string, name?: string) => void }
 */
const GoogleAuth = ({ onAuthenticated }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [gsiLoaded, setGsiLoaded] = useState(false);

  // Load GSI script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGsiLoaded(true);
    };
    script.onerror = () => {
      console.warn('Failed to load Google GSI script');
      setGsiLoaded(false);
      setIsLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Once GSI is loaded AND the div is rendered, initialize + render button
  useEffect(() => {
    if (!gsiLoaded) return;
    try {
      if (window.google && window.google.accounts) {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleSignIn,
        });
        // Small delay to ensure React has rendered the div
        setTimeout(() => {
          const btnContainer = document.getElementById('g_id_signin');
          if (btnContainer) {
            window.google.accounts.id.renderButton(btnContainer, {
              type: 'standard',
              size: 'large',
              theme: 'filled_black',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 320,
            });
          }
        }, 100);
        setIsLoading(false);
      } else {
        console.warn('Google accounts not available');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error initializing Google:', err);
      setIsLoading(false);
    }
  }, [gsiLoaded]);

  const handleGoogleSignIn = async (response) => {
    if (!response.credential) {
      setError('Sign-in failed. Please try again.');
      return;
    }

    try {
      setIsLoading(true);
      const idToken = response.credential;

      // For now, just decode the token and extract user info
      // In production, send to server to verify
      const decodedToken = JSON.parse(atob(idToken.split('.')[1]));
      const email = decodedToken.email || '';
      const name = decodedToken.name || '';
      const picture = decodedToken.picture || '';

      // Save to Dexie
      await db.userSettings.put({
        key: 'authenticated',
        value: 'true',
      });
      await db.userSettings.put({
        key: 'user_email',
        value: email,
      });
      await db.userSettings.put({
        key: 'user_name',
        value: name,
      });
      if (picture) {
        await db.userSettings.put({
          key: 'user_picture',
          value: picture,
        });
      }

      onAuthenticated(email, name);
    } catch (err) {
      console.error('Error processing Google sign-in:', err);
      setError('Sign-in processing failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleContinueWithout = async () => {
    try {
      await db.userSettings.put({
        key: 'authenticated',
        value: 'true',
      });
      onAuthenticated();
    } catch (err) {
      console.error('Error continuing without sign-in:', err);
      setError('Failed to continue. Please try again.');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, #0D1117 0%, #161B22 100%)',
      }}
    >
      {/* Warm radial glow behind logo */}
      <div
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(240,136,62,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content Container */}
      <div className="w-full max-w-sm flex flex-col items-center" style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div className="mb-12 text-center animate-fade-in">
          <FlameIcon size={80} glow className="mb-4 mx-auto" />
          <div
            className="text-5xl font-extrabold tracking-widest mb-2"
            style={{
              background: 'linear-gradient(135deg, #F5B84A, #F0983E, #E07020)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            FUEL
          </div>
          <div
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}
          >
            Adaptive Calorie Tracking
          </div>
        </div>

        {/* Sign-in Button Container */}
        <div className="w-full space-y-4 mb-8">
          {gsiLoaded && (
            <div
              id="g_id_onload"
              data-client_id={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID'}
              data-callback="handleGoogleSignIn"
              style={{ display: 'none' }}
            />
          )}

          {gsiLoaded ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div id="g_id_signin" />
            </div>
          ) : (
            <button
              disabled={true}
              className="w-full px-6 py-3 rounded-lg font-semibold text-sm transition-all"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border)',
              }}
            >
              Loading Google Sign-In...
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3 mb-6">
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            or
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
        </div>

        {/* Continue Without Sign-in */}
        <button
          onClick={handleContinueWithout}
          disabled={isLoading}
          className="w-full px-6 py-3 rounded-lg font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--accent-warm)',
            border: '1px solid rgba(240, 136, 62, 0.4)',
          }}
        >
          Continue Without Sign-in
        </button>

        {/* Error Message */}
        {error && (
          <div
            className="mt-6 px-4 py-3 rounded-lg text-sm text-center w-full"
            style={{
              backgroundColor: 'rgba(255, 59, 48, 0.1)',
              color: '#FF3B30',
            }}
          >
            {error}
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
          <p className="text-xs" style={{ letterSpacing: '0.06em' }}>PERSONAL EDITION · BUILT FOR DAVID</p>
        </div>
      </div>
    </div>
  );
};

export default GoogleAuth;
