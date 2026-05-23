/**
 * BarcodeScanner — camera-based barcode reader using ZXing (loaded from CDN
 * at runtime so we don't bloat the main bundle).
 *
 * Works on:
 *   • iOS Safari 14+ (no native BarcodeDetector, ZXing does the decoding)
 *   • Android Chrome
 *   • Desktop Chrome / Edge / Safari
 *
 * Requires HTTPS (Cloudflare Pages is). Falls back to manual barcode entry
 * if the camera permission is denied or ZXing fails to load.
 */
import { useEffect, useRef, useState } from 'react';

const ZXING_URL = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';

function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (window.__zxingLoading) return window.__zxingLoading;
  window.__zxingLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ZXING_URL;
    script.async = true;
    script.onload = () => resolve(window.ZXing);
    script.onerror = () => reject(new Error('Failed to load ZXing'));
    document.head.appendChild(script);
  });
  return window.__zxingLoading;
}

export default function BarcodeScanner({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState(null);
  const [hint, setHint] = useState('Point at a barcode');
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        setHint('Loading scanner…');
        const Z = await loadZxing();
        if (cancelled) return;

        setHint('Starting camera…');
        const reader = new Z.BrowserMultiFormatReader();
        readerRef.current = reader;

        // Prefer rear camera on phones
        const devices = await Z.BrowserCodeReader.listVideoInputDevices().catch(() => []);
        const rear = devices.find((d) => /back|rear|environment/i.test(d.label || ''));
        const deviceId = (rear || devices[0])?.deviceId;

        await reader.decodeFromVideoDevice(
          deviceId || null,
          videoRef.current,
          (result, err) => {
            if (cancelled) return;
            if (result) {
              setHint('Detected');
              try { reader.reset(); } catch (e) { /* noop */ }
              onDetected?.(result.getText());
            }
            // Ignore per-frame errors — ZXing emits NotFoundException continuously
          }
        );
        setHint('Point at a barcode');
      } catch (e) {
        if (cancelled) return;
        const msg = String(e?.message || e);
        if (/permission|denied|NotAllowed/i.test(msg)) {
          setError('Camera permission denied. Enable camera access for this site in Safari settings.');
        } else if (/NotFound|video|getUserMedia/i.test(msg)) {
          setError('No camera available on this device.');
        } else {
          setError(`Scanner unavailable: ${msg}`);
        }
        setShowManual(true);
      }
    })();

    return () => {
      cancelled = true;
      try { readerRef.current?.reset(); } catch (e) { /* noop */ }
      readerRef.current = null;
    };
  }, [open, onDetected]);

  const onManualSubmit = (e) => {
    e.preventDefault();
    const v = manualCode.trim();
    if (v) onDetected?.(v);
  };

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={header}>
        <button onClick={onClose} style={hbtn}>Cancel</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
          Scan barcode
        </div>
        <button onClick={() => setShowManual((v) => !v)} style={hbtn}>
          {showManual ? 'Camera' : 'Type it'}
        </button>
      </div>

      {!showManual && (
        <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#000' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={frameStyle}>
            <div style={cornerStyle('tl')} />
            <div style={cornerStyle('tr')} />
            <div style={cornerStyle('bl')} />
            <div style={cornerStyle('br')} />
          </div>
          <div style={hintStyle}>{hint}</div>
        </div>
      )}

      {error && (
        <div style={errStyle}>{error}</div>
      )}

      {showManual && (
        <form onSubmit={onManualSubmit} style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Type or paste the barcode (UPC/EAN). Found on the back of the package.
          </div>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="012345678905"
            style={{
              width: '100%',
              background: 'var(--bg-elev-2)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-primary)',
              padding: '12px 14px',
              borderRadius: 10,
              fontSize: 16,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="fuel-btn fuel-btn-primary"
            style={{ width: '100%', marginTop: 12, padding: '12px', fontSize: 14 }}
          >
            Look up
          </button>
        </form>
      )}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(0,0,0,0.92)',
  display: 'flex', flexDirection: 'column',
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};

const header = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '12px 12px',
};

const hbtn = {
  background: 'transparent', border: '1px solid var(--card-border)',
  color: 'var(--text-primary)',
  fontSize: 13, fontWeight: 500,
  padding: '6px 12px', borderRadius: 8,
  cursor: 'pointer',
};

const frameStyle = {
  position: 'absolute',
  inset: '20% 12%',
  pointerEvents: 'none',
};

function cornerStyle(corner) {
  const base = {
    position: 'absolute',
    width: 28, height: 28,
    borderColor: 'var(--accent-bright)',
    borderStyle: 'solid',
  };
  if (corner === 'tl') return { ...base, top: 0, left: 0, borderWidth: '3px 0 0 3px' };
  if (corner === 'tr') return { ...base, top: 0, right: 0, borderWidth: '3px 3px 0 0' };
  if (corner === 'bl') return { ...base, bottom: 0, left: 0, borderWidth: '0 0 3px 3px' };
  return { ...base, bottom: 0, right: 0, borderWidth: '0 3px 3px 0' };
}

const hintStyle = {
  position: 'absolute', left: 0, right: 0, bottom: 16,
  textAlign: 'center', color: 'var(--accent-bright)',
  fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
  textShadow: '0 0 8px rgba(0,0,0,0.6)',
};

const errStyle = {
  margin: '12px 16px', padding: '10px 12px',
  background: 'var(--danger-fill)',
  border: '1px solid rgba(239,68,68,0.32)',
  color: 'var(--danger)',
  borderRadius: 10, fontSize: 13,
};
