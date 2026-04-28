/**
 * FUEL — Supabase client.
 * Reuses the meal planner's Supabase project (shared user ID).
 * Single source of truth for all primary data: weight, food log, settings,
 * saved meals, food cache, weekly reviews.
 */
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://nuixrqyzzwkpdwzzkjsg.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51aXhycXl6endrcGR3enpranNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzUzODUsImV4cCI6MjA4OTU1MTM4NX0.41hCtjD8ZgMbYYg2pSWDcVxUXwO3xB4zBKY7KiLPW84';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Shared with meal planner — single human, one user_id everywhere.
export const SHARED_USER_ID = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6';
