/**
 * Bulk-import every recipe from sharedMealData into fuel_saved_meals.
 * Each meal becomes one row with locked-in USDA matches per ingredient.
 *
 * Idempotent: skips meals whose name already exists in fuel_saved_meals.
 */
import { supabase, SHARED_USER_ID } from '../supabaseClient';
import { MEALS_DATA, INGREDIENTS_DATA, SIDES_DATA } from '../sharedMealData';
import { resolveIngredientMacros } from './mealPlanner';

const TABLE = 'fuel_saved_meals';

function round1(n) {
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

/**
 * Convert a meal-planner recipe into a fuel_saved_meals row.
 * "ingredients" is the JSONB array, each element a fully-locked record:
 *   {
 *     name: "Steel Cut Oats",     // canonical meal-planner name
 *     fdcId: 2708489,              // locked USDA reference
 *     usda_name: "Oats, raw",      // canonical USDA name
 *     dataType: "Survey (FNDDS)",
 *     qty: 0.25,                   // PER-SERVING qty
 *     unit: "cup",                 // PER-SERVING unit
 *     portion_label: "1 cup (80 g)",
 *     portion_grams: 80,
 *     grams: 20,                   // qty × portion_grams
 *     kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg,
 *     source: "usda",
 *   }
 */
export function buildLockedIngredients(meal) {
  const ingredients = INGREDIENTS_DATA[meal.id] || meal.ingredients || [];
  const servings = meal.servings || 1;
  const locked = [];
  for (const ing of ingredients) {
    const m = resolveIngredientMacros(ing, servings);
    if (!m.resolved) {
      locked.push({
        name: ing.n,
        fdcId: null,
        usda_name: null,
        dataType: null,
        qty: round1((ing.q || 0) / servings),
        unit: ing.u || '',
        portion_label: null,
        portion_grams: null,
        grams: 0,
        kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0,
        source: 'manual',
        unresolved: true,
      });
      continue;
    }
    locked.push({
      name: ing.n,
      fdcId: m.fdcId,
      usda_name: m.name,
      dataType: null,
      qty: round1((ing.q || 0) / servings),
      unit: ing.u || '',
      portion_label: m.portion?.label || null,
      portion_grams: m.portion?.grams || null,
      grams: round1(m.grams),
      kcal: m.kcal,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
      fiber_g: m.fiber_g,
      sodium_mg: m.sodium_mg,
      source: 'usda',
    });
  }
  return locked;
}

function totalsFor(ingredients) {
  return ingredients.reduce(
    (a, i) => ({
      kcal: a.kcal + (i.kcal || 0),
      protein_g: round1(a.protein_g + (i.protein_g || 0)),
      carbs_g: round1(a.carbs_g + (i.carbs_g || 0)),
      fat_g: round1(a.fat_g + (i.fat_g || 0)),
      fiber_g: round1(a.fiber_g + (i.fiber_g || 0)),
      sodium_mg: round1(a.sodium_mg + (i.sodium_mg || 0)),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 }
  );
}

/** Build the description string used to keep meal-planner context visible. */
function describe(meal) {
  const parts = [];
  if (meal.cuisine) parts.push(meal.cuisine);
  if (meal.prep) parts.push(meal.prep);
  if (meal.cook) parts.push(meal.cook);
  if (meal.servings) parts.push(`serves ${meal.servings}`);
  let desc = parts.join(' · ');
  if (meal.notes) desc = desc ? `${desc} — ${meal.notes}` : meal.notes;
  return desc.slice(0, 500);
}

/** Pull existing saved meals + return a Set of names (lowercased). */
async function existingNames() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('name')
    .eq('user_id', SHARED_USER_ID);
  if (error) return new Set();
  return new Set((data || []).map((d) => (d.name || '').toLowerCase().trim()));
}

/**
 * Import every recipe (MEALS_DATA + SIDES_DATA) that isn't already saved.
 * Returns { inserted, skipped, errors }.
 */
export async function importAllPlannerRecipes() {
  const existing = await existingNames();
  const allMeals = [
    ...MEALS_DATA.map((m) => ({ ...m, _kind: 'meal' })),
    ...SIDES_DATA.map((s) => ({ ...s, _kind: 'side', servings: s.servings || 1 })),
  ];

  let inserted = 0;
  let skipped = 0;
  const errors = [];

  for (const meal of allMeals) {
    const key = (meal.name || '').toLowerCase().trim();
    if (!key) { skipped++; continue; }
    if (existing.has(key)) { skipped++; continue; }

    const ingredients = buildLockedIngredients(meal);
    if (ingredients.length === 0) { skipped++; continue; }
    const totals = totalsFor(ingredients);

    const row = {
      user_id: SHARED_USER_ID,
      name: meal.name,
      description: describe(meal),
      servings: 1, // ingredient qty/unit/grams are already per-serving
      ingredients,
      total_kcal: totals.kcal,
      total_protein_g: totals.protein_g,
      total_carbs_g: totals.carbs_g,
      total_fat_g: totals.fat_g,
      total_fiber_g: totals.fiber_g,
      total_sodium_mg: totals.sodium_mg,
    };

    const { error } = await supabase.from(TABLE).insert(row);
    if (error) {
      errors.push({ name: meal.name, error: error.message });
    } else {
      inserted++;
      existing.add(key);
    }
  }
  return { inserted, skipped, errors };
}

/** Recompute totals from an edited ingredient list + persist. */
export async function updateSavedMeal(id, patch) {
  const next = { ...patch };
  if (Array.isArray(patch.ingredients)) {
    const t = totalsFor(patch.ingredients);
    next.total_kcal = t.kcal;
    next.total_protein_g = t.protein_g;
    next.total_carbs_g = t.carbs_g;
    next.total_fat_g = t.fat_g;
    next.total_fiber_g = t.fiber_g;
    next.total_sodium_mg = t.sodium_mg;
  }
  const { error } = await supabase.from(TABLE).update(next).eq('id', id);
  return { ok: !error, error };
}

/** Re-build ingredient macros after a fdcId / portion / qty change. */
export function recomputeIngredientFromFdc(detail, qty, portion) {
  const safeQty = Number(qty) || 0;
  const grams = (portion?.grams || 0) * safeQty;
  const f = grams / 100;
  const p = detail.per100g || { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sodium_mg: 0 };
  return {
    name: detail.name,
    fdcId: detail.fdcId,
    usda_name: detail.name,
    dataType: detail.dataType,
    qty: safeQty,
    unit: portion?.label || '',
    portion_label: portion?.label || null,
    portion_grams: portion?.grams || null,
    grams: round1(grams),
    kcal: round1(p.kcal * f),
    protein_g: round1((p.protein_g || 0) * f),
    carbs_g: round1((p.carbs_g || 0) * f),
    fat_g: round1((p.fat_g || 0) * f),
    fiber_g: round1((p.fiber_g || 0) * f),
    sodium_mg: round1((p.sodium_mg || 0) * f),
    source: 'usda',
  };
}


const MASS_TO_GRAMS = {
  g: 1, gram: 1, grams: 1, kg: 1000,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
};

/** Call /api/llm/match-ingredient for one ingredient line. */
async function aiResolveIngredient(ing, recipe) {
  const r = await fetch('/api/llm/match-ingredient', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ingredient: ing.n,
      qty: ing.q,
      unit: ing.u,
      recipe_name: recipe?.name || '',
      recipe_cuisine: recipe?.cuisine || '',
      servings: recipe?.servings || 1,
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`llm match ${r.status}: ${t.slice(0, 200)}`);
  }
  return await r.json();
}

/** Build a locked-ingredient row from an AI match result, scaled per-serving. */
function lockedFromAiMatch(match, ing, servings) {
  const u = String(ing.u || '').toLowerCase().trim();
  const totalGramsRaw =
    MASS_TO_GRAMS[u] ? Number(ing.q) * MASS_TO_GRAMS[u] :
    (match.portion?.grams ? Number(ing.q) * match.portion.grams : 0);
  const perServingGrams = servings > 0 ? totalGramsRaw / servings : totalGramsRaw;
  const f = perServingGrams / 100;
  const p = match.per100g || { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sodium_mg: 0 };
  return {
    name: ing.n,
    fdcId: match.fdcId,
    usda_name: match.name,
    dataType: match.dataType,
    qty: round1((ing.q || 0) / servings),
    unit: ing.u || '',
    portion_label: match.portion?.label || null,
    portion_grams: match.portion?.grams || null,
    grams: round1(perServingGrams),
    kcal: round1(p.kcal * f),
    protein_g: round1((p.protein_g || 0) * f),
    carbs_g: round1((p.carbs_g || 0) * f),
    fat_g: round1((p.fat_g || 0) * f),
    fiber_g: round1((p.fiber_g || 0) * f),
    sodium_mg: round1((p.sodium_mg || 0) * f),
    source: 'usda',
    reasoning: match.reasoning || null,
  };
}

/**
 * AI-driven bulk import. For every meal, every ingredient goes through
 * Claude's match-ingredient endpoint instead of the local heuristic.
 *
 * onProgress({done, total, meal_name, ingredient_name, kind}) is called
 * after every ingredient so the UI can stream progress.
 */
export async function importAllPlannerRecipesWithAI({ onProgress } = {}) {
  const existing = await existingNames();
  const allMeals = [
    ...MEALS_DATA.map((m) => ({ ...m, _kind: 'meal' })),
    ...SIDES_DATA.map((s) => ({ ...s, _kind: 'side', servings: s.servings || 1 })),
  ];

  // Count total ingredients up front for progress
  const total = allMeals.reduce((s, meal) => {
    const ings = INGREDIENTS_DATA[meal.id] || meal.ingredients || [];
    return s + ings.length;
  }, 0);

  let done = 0;
  let inserted = 0;
  let skipped = 0;
  const errors = [];

  for (const meal of allMeals) {
    const key = (meal.name || '').toLowerCase().trim();
    if (!key) { skipped++; continue; }
    if (existing.has(key)) {
      const ings = INGREDIENTS_DATA[meal.id] || meal.ingredients || [];
      done += ings.length;
      skipped++;
      onProgress?.({ done, total, meal_name: meal.name, kind: 'skipped' });
      continue;
    }

    const ingredients = INGREDIENTS_DATA[meal.id] || meal.ingredients || [];
    const locked = [];
    for (const ing of ingredients) {
      try {
        const match = await aiResolveIngredient(ing, meal);
        locked.push(lockedFromAiMatch(match, ing, meal.servings || 1));
      } catch (e) {
        errors.push({ meal: meal.name, ingredient: ing.n, error: String(e.message || e) });
        // Fall back to the heuristic seed map for this ingredient
        const fallback = resolveIngredientMacros(ing, meal.servings || 1);
        if (fallback.resolved) {
          locked.push({
            name: ing.n,
            fdcId: fallback.fdcId,
            usda_name: fallback.name,
            dataType: null,
            qty: round1((ing.q || 0) / (meal.servings || 1)),
            unit: ing.u || '',
            portion_label: fallback.portion?.label || null,
            portion_grams: fallback.portion?.grams || null,
            grams: round1(fallback.grams),
            kcal: fallback.kcal,
            protein_g: fallback.protein_g,
            carbs_g: fallback.carbs_g,
            fat_g: fallback.fat_g,
            fiber_g: fallback.fiber_g,
            sodium_mg: fallback.sodium_mg,
            source: 'usda',
            reasoning: 'fallback (AI match failed)',
          });
        } else {
          // (no fallback — drop ingredient)
        }
      }
      done++;
      onProgress?.({ done, total, meal_name: meal.name, ingredient_name: ing.n, kind: 'matched' });
    }

    if (locked.length === 0) {
      skipped++;
      continue;
    }

    const totals = locked.reduce(
      (a, i) => ({
        kcal: a.kcal + (i.kcal || 0),
        protein_g: round1(a.protein_g + (i.protein_g || 0)),
        carbs_g: round1(a.carbs_g + (i.carbs_g || 0)),
        fat_g: round1(a.fat_g + (i.fat_g || 0)),
        fiber_g: round1(a.fiber_g + (i.fiber_g || 0)),
        sodium_mg: round1(a.sodium_mg + (i.sodium_mg || 0)),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 }
    );

    const row = {
      user_id: SHARED_USER_ID,
      name: meal.name,
      description: describe(meal),
      servings: 1,
      ingredients: locked,
      total_kcal: totals.kcal,
      total_protein_g: totals.protein_g,
      total_carbs_g: totals.carbs_g,
      total_fat_g: totals.fat_g,
      total_fiber_g: totals.fiber_g,
      total_sodium_mg: totals.sodium_mg,
    };

    const { error } = await supabase.from(TABLE).insert(row);
    if (error) {
      errors.push({ meal: meal.name, error: error.message });
    } else {
      inserted++;
      existing.add(key);
    }
  }
  return { inserted, skipped, errors };
}
