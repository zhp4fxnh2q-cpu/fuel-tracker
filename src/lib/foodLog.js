/**
 * FUEL — fuel_food_log access (Supabase).
 * Day reads, single-entry insert + delete, day-totals aggregation.
 */
import { supabase, SHARED_USER_ID } from '../supabaseClient';

const TABLE = 'fuel_food_log';

export async function getDayEntries(isoDate) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', SHARED_USER_ID)
    .eq('date', isoDate)
    .order('logged_at', { ascending: true });
  if (error) return { ok: false, error, entries: [] };
  return { ok: true, entries: data || [] };
}

export async function addEntry(entry) {
  const row = {
    user_id: SHARED_USER_ID,
    date: entry.date,
    meal_slot: entry.meal_slot,
    food_name: entry.food_name,
    serving_qty: entry.serving_qty,
    serving_unit: entry.serving_unit,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    fiber_g: entry.fiber_g || 0,
    sodium_mg: entry.sodium_mg || 0,
    source: entry.source,
    source_id: entry.source_id || null,
  };
  const { error } = await supabase.from(TABLE).insert(row);
  return { ok: !error, error };
}

export async function deleteEntry(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  return { ok: !error, error };
}

export function sumDay(entries) {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein_g: acc.protein_g + (e.protein_g || 0),
      carbs_g: acc.carbs_g + (e.carbs_g || 0),
      fat_g: acc.fat_g + (e.fat_g || 0),
      fiber_g: acc.fiber_g + (e.fiber_g || 0),
      sodium_mg: acc.sodium_mg + (e.sodium_mg || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 }
  );
}

export function groupBySlot(entries, slots) {
  const grouped = Object.fromEntries(slots.map((s) => [s, []]));
  for (const e of entries) {
    if (grouped[e.meal_slot]) grouped[e.meal_slot].push(e);
    else {
      grouped.Other = grouped.Other || [];
      grouped.Other.push(e);
    }
  }
  return grouped;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}


/**
 * Recent foods: pulls the last ~200 log entries, dedupes by (food_name + source_id),
 * keeps each food's most recent serving. Returns up to `limit` unique foods.
 * The dedupe key is a tuple so e.g. "100g chicken breast" and "1 cup chicken breast"
 * collapse to one row (same food, the latest serving wins).
 */
export async function getRecentFoods(limit = 30) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', SHARED_USER_ID)
    .order('logged_at', { ascending: false })
    .limit(200);
  if (error) return { ok: false, error, recents: [] };

  const seen = new Map();
  for (const e of data || []) {
    const key = `${e.source}:${e.source_id || ''}:${e.food_name.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, e);
    if (seen.size >= limit) break;
  }
  return { ok: true, recents: Array.from(seen.values()) };
}

/** Build a per-100g approximation from a logged entry (so we can re-log with new amount). */
export function per100gFromEntry(e) {
  const grams = entryGrams(e);
  if (!grams) return null;
  const factor = 100 / grams;
  return {
    kcal: round1((e.kcal || 0) * factor),
    protein_g: round1((e.protein_g || 0) * factor),
    carbs_g: round1((e.carbs_g || 0) * factor),
    fat_g: round1((e.fat_g || 0) * factor),
    fiber_g: round1((e.fiber_g || 0) * factor),
    sodium_mg: round1((e.sodium_mg || 0) * factor),
  };
}

/** Best-effort grams extraction from serving_unit (e.g. "1 large (50 g)"). */
export function entryGrams(e) {
  // Try to parse a "(NN g)" gram weight from the serving_unit
  const m = (e.serving_unit || '').match(/\((\d+(?:\.\d+)?)\s*g\)/i);
  if (m) return Number(m[1]) * (e.serving_qty || 1);
  // "100 g" / "1 oz (28 g)" / "1 g" — handle simple "g" units
  if (/^\d+\s*g$/i.test(e.serving_unit || '')) {
    const n = parseFloat(e.serving_unit);
    if (Number.isFinite(n)) return n * (e.serving_qty || 1);
  }
  return null;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
