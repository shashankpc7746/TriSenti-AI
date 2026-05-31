/**
 * Central runtime configuration for the frontend.
 *
 * API_URL resolves the backend base URL from the Vite env var `VITE_API_URL`
 * (set at build time in a .env file or the hosting platform's env settings),
 * falling back to localhost for local development.
 *
 * Examples:
 *   .env.production →  VITE_API_URL=https://trisenti-api.onrender.com
 *   .env.local      →  VITE_API_URL=http://localhost:8000
 */
const rawApiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// Strip any trailing slash so callers can safely do `${API_URL}/api/...`
export const API_URL = rawApiUrl.replace(/\/+$/, '');
