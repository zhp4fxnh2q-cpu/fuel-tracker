// Minimal SW registration. Only registers in production builds.
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .catch((err) => console.warn('FUEL SW registration failed:', err));
    });
  }
}
