/**
 * BarcodeScanner — full-screen camera viewfinder using the native
 * BarcodeDetector API. When a barcode is detected it stops the camera
 * and calls onDetected(code).
 *
 * Browser support: Chrome/Edge desktop, Android Chrome, iOS Safari 17+,
 * macOS Safari 17+. Falls back to an error message if missing.
 */
import React, { useEffect, useRef, useState } from 'react';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

export default function BarcodeScanner({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState(null);
  const [supported, setSupported] = useState(true);
  const [hint, setHint] = useState('Point at a barcode');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    if (typeof window.BarcodeDetector === 'undefined') {
      setSupported(false);
      setError('Your browser does not support native barcode scanning. Update iOS to 17+ or Chrome to a recent version.');
      return;
    }

    detectorRef.current = new window.BarcodeDetector({ formats: FORMATS });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scan();
      } catch (e) {
        setError(`Camera unavailable: ${e.message}`);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const scan = async () => {
    if (!videoRef.current || !detectorRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes && codes.length > 0) {
        const code = codes[0].rawValue;
        setHint(`Detected ${code} — looking up...`);
        if (navigator.vibrate) navigator.vibrate(80);
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        onDetected(code);
        return;
      }
    } catch (e) {
      // per-frame errors are noisy — ignore
    }
    rafRef.current = requestAnimationFrame(scan);
  };

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={topBarStyle}>
        <button onClick={onClose} style={closeBtn}>×</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: '#cbd5e1' }}>{hint}</div>
        <div style={{ width: 36 }} />
      </div>

      {supported && (
        <div style={viewfinderWrap}>
          <video ref={videoRef} autoPlay playsInline muted style={videoStyle} />
          <div style={targetBoxStyle} />
        </div>
      )}

      {error && (
        <div style={errorWrap}>
          <div style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 12 }}>{error}</div>
          <button onClick={onClose} className="fuel-btn">Close</button>
        </div>
      )}

      <div style={hintBarStyle}>
        Hold steady ~6 inches from the barcode. The phone vibrates when it locks.
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: '#000',
  display: 'flex', flexDirection: 'column',
};
const topBarStyle = {
  display: 'flex', alignItems: 'center',
  padding: 'calc(10px + env(safe-area-inset-top, 0px)) 14px 10px',
  background: 'rgba(0,0,0,0.6)',
};
const closeBtn = {
  width: 36, height: 36, borderRadius: '50%',
  background: 'rgba(255,255,255,0.12)', border: 'none',
  color: '#fff', fontSize: 22, fontWeight: 300,
  cursor: 'pointer',
};
const viewfinderWrap = {
  flex: 1, position: 'relative', overflow: 'hidden',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const videoStyle = {
  width: '100%', height: '100%', objectFit: 'cover',
};
const targetBoxStyle = {
  position: 'absolute',
  width: '78%', maxWidth: 360, height: 180,
  border: '2px solid #34d399',
  borderRadius: 14,
  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45), 0 0 24px rgba(52,211,153,0.4) inset',
  pointerEvents: 'none',
};
const hintBarStyle = {
  padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
  background: 'rgba(0,0,0,0.7)',
  color: '#cbd5e1', fontSize: 12, textAlign: 'center', lineHeight: 1.4,
};
const errorWrap = {
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: 24, color: '#fda4af', textAlign: 'center',
};
