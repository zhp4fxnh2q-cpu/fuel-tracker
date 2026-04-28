/**
 * FUEL — Supabase data access.
 * Phase 1 covers: settings (read/upsert), graceful 'table not yet created'
 * handling so the app deploys cleanly before the SQL migration is run.
 *
 * Phases 3+ will add: food_log read/write, weight_log, food cache, saved meals,
 * weekly reviews, meal planner integration.
 */
import { supabase, SHARED_USER_ID } from '../supabaseClient';
import {
  DEFAULT_PROFILE,
  DEFAULT_TARGETS,
  DEFAULT_PREFERENCES,
} from './constants';

const SETTINGS_TABLE = 'fuel_settings';

/** True when error indicates the table doesn't exist (pre-migration). */
function isMissingTable(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('not found in schema cache') ||
    msg.includes('relation') && msg.includes('does not exist')
  );
}

/** Default settings shape used to bootstrap a new user. */
export function defaultSettings() {
  return {
    user_id: SHARED_USER_ID,
    profile: { ...DEFAULT_PROFILE },
    targets: { ...DEFAULT_TARGETS },
    algo_state: {
      tdee_estimate: 2400, // formula-derived; will be replaced after first weekly review
      tdee_confidence: 'low',
      last_review_date: null,
      phase: 'cutting',
      phase_start_date: new Date().toISOString().slice(0, 10),
      ewma_alpha: 0.12,
    },
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

/**
 * @returns { ok, settings, missingTable, error }
 *   ok:          true when settings were read or successfully bootstrapped
 *   missingTable: true if the SQL migration hasn't been run — UI should explain
 */
export async function fetchSettings() {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('*')
    .eq('user_id', SHARED_USER_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      return { ok: false, missingTable: true, error };
    }
    return { ok: false, missingTable: false, error };
  }

  if (data) {
    return { ok: true, settings: data, missingTable: false };
  }

  // No row yet — bootstrap with defaults
  const seed = defaultSettings();
  const { error: insertErr } = await supabase
    .from(SETTINGS_TABLE)
    .insert(seed);
  if (insertErr) {
    if (isMissingTable(insertErr)) return { ok: false, missingTable: true, error: insertErr };
    return { ok: false, missingTable: false, error: insertErr };
  }
  return { ok: true, settings: seed, missingTable: false };
}

export async function saveSettings(partial) {
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .update({ ...partial, updated_at: new Date().toISOString() })
    .eq('user_id', SHARED_USER_ID);
  return { ok: !error, error };
}
