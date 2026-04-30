/**
 * FUEL — fuel_weight_log access + EWMA trend recomputation.
 *
 * Adding a new entry recomputes trended_lbs for that entry AND every later
 * entry, since EWMA is a forward sequence. For the typical case (logging
 * today's weight at the end of the series) only one row is updated.
 */
import { supabase, SHARED_USER_ID } from '../supabaseClient';
import { EWMA_ALPHA } from './constants';

const TABLE = 'fuel_weight_log';

export async function getWeightEntries(daysBack = 90) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceIso = since.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', SHARED_USER_ID)
    .gte('date', sinceIso)
    .order('date', { ascending: true });
  if (error) return { ok: false, error, entries: [] };
  return { ok: true, entries: data || [] };
}

export async function getAllWeightEntries() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', SHARED_USER_ID)
    .order('date', { ascending: true });
  if (error) return { ok: false, error, entries: [] };
  return { ok: true, entries: data || [] };
}

/**
 * Upserts (date, weight_lbs) and re-runs EWMA on the affected suffix of the
 * series. Returns the recomputed entries list (full history) for chart use.
 */
export async function addOrUpdateWeight({ date, weight_lbs, notes }) {
  // 1. Upsert the raw value
  const upsert = await supabase
    .from(TABLE)
    .upsert(
      { user_id: SHARED_USER_ID, date, weight_lbs, notes: notes || null },
      { onConflict: 'user_id,date' }
    );
  if (upsert.error) return { ok: false, error: upsert.error };

  // 2. Pull the full history (small table, single user, ordered)
  const { ok, entries, error } = await getAllWeightEntries();
  if (!ok) return { ok: false, error };

  // 3. Recompute trended_lbs forward
  const recomputed = recomputeTrend(entries);

  // 4. Persist trended_lbs for any entries whose computed value differs from stored
  const updates = recomputed.filter((e) => approxNotEqual(e.trended_lbs, e.stored_trended));
  for (const u of updates) {
    await supabase
      .from(TABLE)
      .update({ trended_lbs: u.trended_lbs })
      .eq('id', u.id);
  }

  // Return the recomputed series for the chart
  return { ok: true, entries: recomputed.map((e) => ({ ...e, stored_trended: undefined })) };
}

export async function deleteWeight(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  return { ok: !error, error };
}

/**
 * Walk the series forward. First N (≤7) entries seed the EWMA from a simple
 * mean; after that we use the standard EWMA recursion with alpha=0.12.
 */
export function recomputeTrend(entries) {
  if (!entries || entries.length === 0) return [];
  const SEED = Math.min(7, entries.length);
  const seedMean = entries.slice(0, SEED).reduce((s, e) => s + e.weight_lbs, 0) / SEED;
  let prev = seedMean;
  return entries.map((e, i) => {
    const trended = i === 0 ? seedMean : EWMA_ALPHA * e.weight_lbs + (1 - EWMA_ALPHA) * prev;
    prev = trended;
    return {
      ...e,
      trended_lbs: round1(trended),
      stored_trended: e.trended_lbs ?? null, // keep so we can compare
    };
  });
}

/**
 * Stats for the last N days of the series.
 *   week_change: trended[today] − trended[7 days ago]
 *   rate_lbs_per_week: (trended_now − trended_30d_ago) ÷ (days/7)
 *   total_change: trended_now − trended_first
 */
export function computeStats(entries) {
  if (!entries || entries.length === 0) return null;
  const last = entries[entries.length - 1];
  const first = entries[0];

  const lookup = (daysAgo) => {
    const target = new Date(last.date + 'T00:00:00Z');
    target.setUTCDate(target.getUTCDate() - daysAgo);
    const iso = target.toISOString().slice(0, 10);
    // Find the entry on or before the target
    let best = null;
    for (const e of entries) {
      if (e.date <= iso) best = e;
      else break;
    }
    return best;
  };

  const e7 = lookup(7);
  const e30 = lookup(30);
  const week_change = e7 ? round1(last.trended_lbs - e7.trended_lbs) : null;
  const rate30 = e30 && entries.length >= 7
    ? round2(((last.trended_lbs - e30.trended_lbs) / Math.max(1, daysBetween(e30.date, last.date))) * 7)
    : null;
  const total_change = round1(last.trended_lbs - first.trended_lbs);

  return {
    raw_today: last.weight_lbs,
    trended_today: last.trended_lbs,
    week_change,                   // lbs over the last 7 days (trended)
    rate_lbs_per_week: rate30,     // moving rate over last 30 days
    total_change,                  // since first entry
    days_logged: entries.length,
  };
}

function approxNotEqual(a, b) {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  return Math.abs(a - b) >= 0.05;
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00Z');
  const b = new Date(isoB + 'T00:00:00Z');
  return Math.max(1, Math.round(Math.abs(b - a) / 86400000));
}

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
