
// Force every load through the canonical domain. Cloudflare Pages issues a
// preview hash URL for every commit (e.g. abc12345.rdnafuel.pages.dev), and
// Google OAuth only allowlists the bare host. If a PWA install or bookmark
// landed on a preview URL, redirect to the canonical one BEFORE React mounts.
(function enforceCanonicalDomain() {
  try {
    const host = window.location.hostname;
    const canonical = 'rdnafuel.pages.dev';
    if (host !== canonical && host.endsWith('.' + canonical)) {
      const target = 'https://' + canonical + window.location.pathname + window.location.search + window.location.hash;
      window.location.replace(target);
    }
  } catch (e) {
    // best-effort — never block boot
  }
})();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the SW after first paint so it never blocks the shell.
registerServiceWorker();
