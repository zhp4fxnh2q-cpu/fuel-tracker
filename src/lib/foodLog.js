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
