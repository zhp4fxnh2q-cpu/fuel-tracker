import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';

/**
 * PinScreen - PIN/passphrase authentication screen
 * Props: { onAuthenticated: () => void }
 */
const PinScreen = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('pin'); // 'pin' or 'passphrase'
  const [pin, setPin] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isSettingNew, setIsSettingNew] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Check if PIN is already set on mount
  useEffect(() => {
    const checkPin = async () => {
      try {
        const settings = await db.userSettings.where('key').equals('pin_hash').first();
        setIsSettingNew(!settings);
      } catch (err) {
        console.error('Error checking PIN:', err);
        setIsSettingNew(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkPin();
  }, []);

  // Hash PIN with SHA-256
  const hashPin = async (input) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  // Handle PIN digit input
  const handlePinDigit = (digit) => {
    if (pin.length < 4) {
      setPin(pin + digit);
      setError('');
    }
  };

  // Handle PIN backspace
  const handlePinBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  // Handle PIN submission
  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    setIsLoading(true);

    try {
      if (isSettingNew) {
        // Setting new PIN - confirm match
        if (pin !== confirmPin && confirmPin.length > 0) {
          setError('PINs do not match');
          setPin('');
          setConfirmPin('');
          setIsLoading(false);
          return;
        }

        if (confirmPin.length === 0) {
          // First PIN entered, now waiting for confirmation
          setConfirmPin(pin);
          setPin('');
          setError('');
          setIsLoading(false);
          return;
        }

        // Both PINs match - save new PIN
        const hash = await hashPin(pin);
        await db.userSettings.put({
          key: 'pin_hash',
          value: hash,
        });
        onAuthenticated();
      } else {
        // Authenticating with existing PIN
        const storedSettings = await db.userSettings
          .where('key')
          .equals('pin_hash')
          .first();

        if (!storedSettings) {
          setError('PIN not configured');
          setPin('');
          setIsLoading(false);
          return;
        }

        const hash = await hashPin(pin);

        if (hash === storedSettings.value) {
          onAuthenticated();
        } else {
          setError('Invalid PIN');
          setPin('');
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('Error processing PIN:', err);
      setError('Authentication error');
      setPin('');
      setIsLoading(false);
    }
  };

  // Handle passphrase submit
  const handlePassphraseSubmit = async () => {
    if (passphrase.trim().length === 0) {
      setError('Passphrase cannot be empty');
      return;
    }

    setIsLoading(true);

    try {
      if (isSettingNew) {
        const hash = await hashPin(passphrase.trim());
        await db.userSettings.put({
          key: 'pin_hash',
          value: hash,
        });
        onAuthenticated();
      } else {
        const storedSettings = await db.userSettings
          .where('key')
          .equals('pin_hash')
          .first();

        if (!storedSettings) {
          setError('PIN not configured');
          setPassphrase('');
          setIsLoading(false);
          return;
        }

        const hash = await hashPin(passphrase.trim());

        if (hash === storedSettings.value) {
          onAuthenticated();
        } else {
          setError('Invalid passphrase');
          setPassphrase('');
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('Error processing passphrase:', err);
      setError('Authentication error');
      setPassphrase('');
      setIsLoading(false);
    }
  };

  if (isLoading && !isSettingNew && mode === 'pin') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="animate-pulse" style={{ color: 'var(--text-secondary)' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <div
          className="text-5xl font-bold mb-2 tracking-wider"
          style={{ color: 'var(--accent-primary)' }}
        >
          FUEL
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Adaptive Calorie Tracking
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => {
            setMode('pin');
            setPin('');
            setConfirmPin('');
            setPassphrase('');
            setError('');
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: mode === 'pin' ? 'var(--accent-primary)' : 'var(--bg-card)',
            color:
              mode === 'pin' ? 'var(--bg-primary)' : 'var(--text-secondary)',
            border: `1px solid ${mode === 'pin' ? 'transparent' : 'var(--border)'}`,
          }}
        >
          PIN
        </button>
        <button
          onClick={() => {
            setMode('passphrase');
            setPin('');
            setConfirmPin('');
            setPassphrase('');
            setError('');
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: mode === 'passphrase' ? 'var(--accent-primary)' : 'var(--bg-card)',
            color:
              mode === 'passphrase'
                ? 'var(--bg-primary)'
                : 'var(--text-secondary)',
            border: `1px solid ${mode === 'passphrase' ? 'transparent' : 'var(--border)'}`,
          }}
        >
          PASSPHRASE
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isSettingNew ? 'Set Your PIN' : 'Enter PIN'}
        </h1>
        {isSettingNew && confirmPin.length > 0 && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Confirm your PIN
          </p>
        )}
      </div>

      {/* PIN Mode */}
      {mode === 'pin' && (
        <>
          {/* PIN display */}
          <div className="mb-8 flex gap-4 justify-center">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-colors"
                style={{
                  borderColor:
                    i < pin.length ? 'var(--accent-primary)' : 'var(--border)',
                  backgroundColor:
                    i < pin.length ? 'var(--bg-elevated)' : 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }}
              >
                {i < pin.length ? '•' : ''}
              </div>
            ))}
          </div>

          {/* Keypad */}
          <div className="w-full max-w-xs mb-8">
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePinDigit(String(num))}
                  disabled={isLoading}
                  className="py-4 rounded-lg font-semibold text-lg transition-colors active:scale-95 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: `1px solid var(--border)`,
                  }}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Bottom row: 0, backspace, enter */}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <button
                onClick={() => handlePinDigit('0')}
                disabled={isLoading}
                className="py-4 rounded-lg font-semibold text-lg transition-colors active:scale-95 disabled:opacity-50 col-span-1"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: `1px solid var(--border)`,
                }}
              >
                0
              </button>

              <button
                onClick={handlePinBackspace}
                disabled={isLoading || pin.length === 0}
                className="py-4 rounded-lg transition-colors active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: `1px solid var(--border)`,
                }}
              >
                <svg
                  className="w-6 h-6 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
                  />
                </svg>
              </button>

              <button
                onClick={handlePinSubmit}
                disabled={isLoading || pin.length !== 4}
                className="py-4 rounded-lg font-semibold transition-colors active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor:
                    pin.length === 4
                      ? 'var(--accent-primary)'
                      : 'var(--bg-elevated)',
                  color:
                    pin.length === 4
                      ? 'var(--bg-primary)'
                      : 'var(--text-secondary)',
                }}
              >
                ✓
              </button>
            </div>
          </div>
        </>
      )}

      {/* Passphrase Mode */}
      {mode === 'passphrase' && (
        <>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => {
              setPassphrase(e.target.value);
              setError('');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePassphraseSubmit();
              }
            }}
            placeholder={isSettingNew ? 'Create passphrase' : 'Enter passphrase'}
            disabled={isLoading}
            className="w-full max-w-xs px-4 py-3 rounded-lg border mb-6 bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
            style={{
              borderColor: 'var(--border)',
              focusColor: 'var(--accent-primary)',
            }}
          />

          <button
            onClick={handlePassphraseSubmit}
            disabled={isLoading || passphrase.trim().length === 0}
            className="w-full max-w-xs px-6 py-3 rounded-lg font-semibold transition-colors active:scale-95 disabled:opacity-50"
            style={{
              backgroundColor:
                passphrase.trim().length > 0
                  ? 'var(--accent-primary)'
                  : 'var(--bg-elevated)',
              color:
                passphrase.trim().length > 0
                  ? 'var(--bg-primary)'
                  : 'var(--text-secondary)',
            }}
          >
            Continue
          </button>
        </>
      )}

      {/* Error message */}
      {error && (
        <div
          className="mt-6 px-4 py-2 rounded-lg text-sm text-center"
          style={{
            backgroundColor: 'rgba(255, 59, 48, 0.1)',
            color: '#FF3B30',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default PinScreen;
