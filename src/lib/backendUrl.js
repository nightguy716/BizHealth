const PROD_BACKEND = 'https://bizhealth-production.up.railway.app';

export function getBackendBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL;
  if (fromEnv) return String(fromEnv).replace(/\/+$/, '');

  // Local dev default: keep frontend and backend on localhost without extra env setup.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://127.0.0.1:8000';
    }
  }

  return PROD_BACKEND;
}
