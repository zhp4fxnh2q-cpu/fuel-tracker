/**
 * Supabase Auth Helper for FUEL
 * Authenticates with the Rogers Meal Planner Supabase project
 * using the Google ID token from FUEL's Google Sign-In.
 * This gives us read access to the meal_planner_data table (plan column).
 */

import { db } from './db';

const SUPABASE_URL = 'https://nuixrqyzzwkpdwzzkjsg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51aXhycXl6endrcGR3enpranNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzUzODUsImV4cCI6MjA4OTU1MTM4NX0.41hCtjD8ZgMbYYg2pSWDcVxUXwO3xB4zBKY7KiLPW84';

/**
 * Sign in to Supabase using a Google ID token.
 * Stores the resulting access_token and refresh_token in Dexie.
 */
export async function signInWithGoogle(googleIdToken) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        provider: 'google',
        id_token: googleIdToken,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Supabase auth failed:', response.status, err);
      return null;
    }

    const data = await response.json();
    const { access_token, refresh_token, expires_at } = data;

    if (access_token) {
      // Store tokens in Dexie
      await db.userSettings.put({ key: 'supabase_access_token', value: access_token });
      await db.userSettings.put({ key: 'supabase_refresh_token', value: refresh_token });
      await db.userSettings.put({ key: 'supabase_expires_at', value: String(expires_at) });
      return access_token;
    }

    return null;
  } catch (error) {
    console.error('Error signing in to Supabase:', error);
    return null;
  }
}

/**
 * Get a valid Supabase access token.
 * Refreshes if expired. Returns null if no session.
 */
export async function getSupabaseToken() {
  try {
    const tokenSetting = await db.userSettings.where('key').equals('supabase_access_token').first();
    const expiresSetting = await db.userSettings.where('key').equals('supabase_expires_at').first();
    const refreshSetting = await db.userSettings.where('key').equals('supabase_refresh_token').first();

    if (!tokenSetting?.value) return null;

    const expiresAt = Number(expiresSetting?.value || 0);
    const now = Math.floor(Date.now() / 1000);

    // If token is still valid (with 60s buffer), return it
    if (expiresAt > now + 60) {
      return tokenSetting.value;
    }

    // Try to refresh
    if (refreshSetting?.value) {
      return await refreshSupabaseToken(refreshSetting.value);
    }

    return null;
  } catch (error) {
    console.error('Error getting Supabase token:', error);
    return null;
  }
}

/**
 * Refresh the Supabase access token using the refresh token.
 */
async function refreshSupabaseToken(refreshToken) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('Supabase token refresh failed:', response.status);
      return null;
    }

    const data = await response.json();
    const { access_token, refresh_token, expires_at } = data;

    if (access_token) {
      await db.userSettings.put({ key: 'supabase_access_token', value: access_token });
      await db.userSettings.put({ key: 'supabase_refresh_token', value: refresh_token });
      await db.userSettings.put({ key: 'supabase_expires_at', value: String(expires_at) });
      return access_token;
    }

    return null;
  } catch (error) {
    console.error('Error refreshing Supabase token:', error);
    return null;
  }
}

/**
 * Make an authenticated Supabase REST API call.
 * Uses the stored access token (refreshes if needed).
 */
export async function supabaseFetch(path, options = {}) {
  const token = await getSupabaseToken();
  if (!token) return null;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    console.error('Supabase fetch error:', response.status);
    return null;
  }

  return response.json();
}
