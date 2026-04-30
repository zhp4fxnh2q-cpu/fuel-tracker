/**
 * FUEL — fuel_saved_meals access.
 * Lite Phase 8: snapshot a meal slot's current items as a saved meal,
 * then bulk-log them back to any meal slot in the future.
 */
import { supabase, SHARED_USER_ID } from '../supabaseClient';
import { addEntry, todayIso } from './foodLog';

const TABLE = 'fuel_saved_meals';

export async function getSavedMeals() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', SHARED_USER_ID)
    .order('last_used_at', { ascending: false, nullsFirst: false });
  if (error) return { ok: false, error, meals: [] };
  return { ok: true, meals: data || [] };
}

/**
 * Create a saved meal from a list of food log entries (or AddFoodSheet picks).
 * Each ingredient stores enough data to be re-logged later: food_name,
 * serving_qty, serving_unit, per-entry macros, source ref.
 */
export async function saveMeal({ name, description, entries }) {
  const ingredients = entries.map((e) => ({
    food_name: e.food_name,
    serving_qty: e.serving_qty,
    serving_unit: e.serving_unit,
    kcal: e.kcal,
    protein_g: e.protein_g,
    carbs_g: e.carbs_g,
    fat_g: e.fat_g,
    fiber_g: e.fiber_g || 0,
    sodium_mg: e.sodium_mg || 0,
    source: e.source,
    source_id: e.source_id || null,
  }));
  const totals = ingredients.reduce(
    (acc, i) => ({
      total_kcal: acc.total_kcal + (i.kcal || 0),
      total_protein_g: acc.total_protein_g + (i.protein_g || 0),
      total_carbs_g: acc.total_carbs_g + (i.carbs_g || 0),
      total_fat_g: acc.total_fat_g + (i.fat_g || 0),
      total_fiber_g: acc.total_fiber_g + (i.fiber_g || 0),
      total_sodium_mg: acc.total_sodium_mg + (i.sodium_mg || 0),
    }),
    { total_kcal: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, total_fiber_g: 0, total_sodium_mg: 0 }
  );
  const { error } = await supabase.from(TABLE).insert({
    user_id: SHARED_USER_ID,
    name,
    description: description || null,
    servings: 1,
    ingredients,
    ...totals,
  });
  return { ok: !error, error };
}

/** Bulk-log a saved meal's ingredients into the chosen meal slot for today. */
export async function logSavedMeal(mealId, mealSlot) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', mealId).maybeSingle();
  if (error || !data) return { ok: false, error: error || new Error('saved meal missing') };

  const date = todayIso();
  for (const ing of data.ingredients || []) {
    const r = await addEntry({ ...ing, date, meal_slot: mealSlot, source: ing.source || 'saved_meal', source_id: String(mealId) });
    if (!r.ok) return r;
  }
  // Update last_used_at
  await supabase.from(TABLE).update({ last_used_at: new Date().toISOString() }).eq('id', mealId);
  return { ok: true };
}

export async function deleteSavedMeal(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  return { ok: !error, error };
}
