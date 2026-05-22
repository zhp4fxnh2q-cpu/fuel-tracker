/**
 * FUEL — meal planner integration.
 * Reads the meal_planner_data row from Supabase (same project, shared user_id,
 * RLS allows authenticated owner). Resolves today's plan slots to meal names +
 * ingredient lists using the static MEALS_DATA / INGREDIENTS_DATA / SIDES_DATA
 * pulled from the meal planner via scripts/sync-meal-data.sh.
 */
import { supabase, SHARED_USER_ID } from '../supabaseClient';
import { MEALS_DATA, INGREDIENTS_DATA, SIDES_DATA } from '../sharedMealData';
import RESOLVED from './resolvedIngredients.json';

const TABLE = 'meal_planner_data';

const MEALS_BY_ID = Object.fromEntries(MEALS_DATA.map((m) => [m.id, m]));
const SIDES_BY_ID = Object.fromEntries(SIDES_DATA.map((s) => [s.id, s]));

/** Pulls David's plan + custom_meals from meal_planner_data. */
export async function fetchMealPlannerRow() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('plan, custom_meals')
    .eq('user_id', SHARED_USER_ID)
    .maybeSingle();
  if (error) return { ok: false, error };
  return { ok: true, plan: data?.plan || [], custom_meals: data?.custom_meals || [] };
}

/**
 * Returns slots planned for today, resolved with meal name + ingredients.
 * Slots without a meal_id (empty placeholders) are filtered out.
 *
 * Slot shape coming back:
 *   { mealTime, name, ingredients: [{n,q,u,c}], sides: [{name, ingredients}] }
 */
export function resolveTodaysSlots(plan, customMeals) {
  const today = new Date().toISOString().slice(0, 10);
  const customById = Object.fromEntries((customMeals || []).map((m) => [m.id, m]));

  return (plan || [])
    .filter((s) => s.date === today && s.mealId)
    .map((s) => {
      const meal = MEALS_BY_ID[s.mealId] || customById[s.mealId];
      if (!meal) return null;
      const ingredients = INGREDIENTS_DATA[s.mealId] || meal.ingredients || [];
      const sides = [s.side, s.side2, s.side3]
        .filter(Boolean)
        .map((sid) => {
          const side = SIDES_BY_ID[sid] || customById[sid];
          if (!side) return null;
          return { name: side.name, ingredients: side.ingredients || [] };
        })
        .filter(Boolean);
      return {
        mealTime: s.mealTime,
        mealId: s.mealId,
        name: meal.name,
        cuisine: meal.cuisine,
        servings: meal.servings,
        ingredients,
        sides,
        notes: s.notes || null,
      };
    })
    .filter(Boolean);
}

/** Maps meal planner mealTime ("Breakfast"/"Lunch"/"Dinner") to FUEL meal slots. */
export function plannerSlotToFuelSlot(mealTime) {
  // Direct match for the three meals; snacks aren't in the planner.
  return mealTime;
}


// ─────────────────────────────────────────────────────────────────────────────
// Phase C — per-ingredient macros + per-serving math
// ─────────────────────────────────────────────────────────────────────────────
//
// Each meal in the planner declares total ingredient quantities for the full
// recipe (e.g. "3 cups oats", servings: 12). David eats ONE serving at a time,
// so we divide by servings when logging from the planned card.
//
// resolveIngredientMacros({n, q, u}, servings) returns macros for ONE serving.
// The resolved.json bundles a USDA fdcId + per100g + a portion {label, grams}
// that matched the planner unit at pre-curation time.

const MASS_TO_GRAMS = {
  g: 1, gram: 1, grams: 1, kg: 1000,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
};

/** Total grams represented by qty × unit, given the resolved portion. */
export function ingredientGrams(ing, resolved) {
  const u = String(ing.u || '').toLowerCase().trim();
  if (MASS_TO_GRAMS[u]) return Number(ing.q) * MASS_TO_GRAMS[u];
  if (!resolved || !resolved.portion) return 0;
  return Number(ing.q) * resolved.portion.grams;
}

/** Per-SERVING macros for one ingredient. servings defaults to 1. */
export function resolveIngredientMacros(ing, servings = 1) {
  const resolved = RESOLVED[ing.n];
  if (!resolved) {
    return { resolved: false, name: ing.n, kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sodium_mg: 0, grams: 0 };
  }
  const totalGrams = ingredientGrams(ing, resolved);
  const perServingGrams = servings > 0 ? totalGrams / servings : totalGrams;
  const f = perServingGrams / 100;
  const p = resolved.per100g;
  return {
    resolved: true,
    fdcId: resolved.fdcId,
    name: resolved.name,
    grams: perServingGrams,
    kcal: round1(p.kcal * f),
    protein_g: round1(p.protein_g * f),
    fat_g: round1(p.fat_g * f),
    carbs_g: round1(p.carbs_g * f),
    fiber_g: round1((p.fiber_g || 0) * f),
    sodium_mg: round1((p.sodium_mg || 0) * f),
    portion: resolved.portion,
  };
}

/** Per-SERVING macros summed across every ingredient + side ingredient. */
export function slotTotalMacros(slot) {
  const servings = slot.servings || 1;
  const totals = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sodium_mg: 0, unresolved: 0 };
  const all = [...(slot.ingredients || [])];
  for (const side of slot.sides || []) for (const i of side.ingredients || []) all.push(i);
  for (const ing of all) {
    const m = resolveIngredientMacros(ing, servings);
    if (!m.resolved) { totals.unresolved++; continue; }
    totals.kcal += m.kcal;
    totals.protein_g += m.protein_g;
    totals.fat_g += m.fat_g;
    totals.carbs_g += m.carbs_g;
    totals.fiber_g += m.fiber_g;
    totals.sodium_mg += m.sodium_mg;
  }
  totals.kcal = Math.round(totals.kcal);
  totals.protein_g = round1(totals.protein_g);
  totals.fat_g = round1(totals.fat_g);
  totals.carbs_g = round1(totals.carbs_g);
  return totals;
}

function round1(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

/** Build food_log entry rows from a planned slot — one row per ingredient,
 *  scaled to one serving. */
export function buildLogEntriesForSlot(slot, dateIso, mealSlotName) {
  const servings = slot.servings || 1;
  const rows = [];
  const all = [...(slot.ingredients || [])];
  for (const side of slot.sides || []) for (const i of side.ingredients || []) all.push(i);
  for (const ing of all) {
    const m = resolveIngredientMacros(ing, servings);
    if (!m.resolved) continue;
    rows.push({
      date: dateIso,
      meal_slot: mealSlotName,
      food_name: m.name,
      serving_qty: round1((ing.q || 0) / servings),
      serving_unit: `${ing.u || 'serving'} (${Math.round(m.grams)} g)`,
      kcal: m.kcal,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
      fiber_g: m.fiber_g,
      sodium_mg: m.sodium_mg,
      source: 'meal_planner',
      source_id: String(m.fdcId),
    });
  }
  return rows;
}
