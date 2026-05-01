/**
 * FUEL — meal planner integration.
 * Reads the meal_planner_data row from Supabase (same project, shared user_id,
 * RLS allows authenticated owner). Resolves today's plan slots to meal names +
 * ingredient lists using the static MEALS_DATA / INGREDIENTS_DATA / SIDES_DATA
 * pulled from the meal planner via scripts/sync-meal-data.sh.
 */
import { supabase, SHARED_USER_ID } from '../supabaseClient';
import { MEALS_DATA, INGREDIENTS_DATA, SIDES_DATA } from '../sharedMealData';

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
