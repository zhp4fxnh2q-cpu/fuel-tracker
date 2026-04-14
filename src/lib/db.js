/**
 * Offline-first database using Dexie
 * All data is stored locally and synced to cloud when possible
 * @module lib/db
 */

import Dexie from 'dexie';
import { updateSmoothedWeight } from './algorithm.js';

/**
 * Initialize Dexie database with all tables and schema
 */
export const db = new Dexie('FuelTracker');

db.version(1).stores({
  weightEntries: 'id, date, synced',
  foodLog: 'id, date, meal, recipe_id, synced',
  importedRecipes: 'id, name, source_app, synced',
  customFoods: 'id, name, synced',
  algorithmState: 'id',
  weeklySummaries: 'id, week_start',
  trainingDays: 'date, synced',
  userSettings: 'key',
});

// v2: Add use_count index to customFoods for favorites sorting
db.version(2).stores({
  customFoods: 'id, name, use_count, synced',
});

// ============================================================================
// User Settings
// ============================================================================

/**
 * Get a user setting by key
 * @param {string} key - Setting key
 * @returns {Promise<*>} Setting value
 */
export async function getSetting(key) {
  const setting = await db.userSettings.get(key);
  return setting ? setting.value : null;
}

/**
 * Set a user setting
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  await db.userSettings.put({ key, value, updated_at: new Date().toISOString() });
}

// ============================================================================
// Weight Entries
// ============================================================================

/**
 * Get weight entries in a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Weight entries sorted by date ascending
 */
export async function getWeightEntries(startDate, endDate) {
  return await db.weightEntries
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

/**
 * Add a new weight entry
 * Automatically calculates and stores smoothed weight using EWMA
 * @param {Object} entry - Weight entry data
 * @param {string} entry.date - Date in YYYY-MM-DD format
 * @param {number} entry.weight_lbs - Weight in pounds
 * @param {string} [entry.notes] - Optional notes
 * @returns {Promise<string>} Generated ID
 */
export async function addWeightEntry({ date, weight_lbs, notes = '' }) {
  // Get previous smoothed weight to calculate new smoothed weight
  const previousEntries = await db.weightEntries.where('date').below(date).toArray();
  const previousSmoothed =
    previousEntries.length > 0
      ? previousEntries[previousEntries.length - 1].smoothed_weight
      : null;

  const smoothed_weight = updateSmoothedWeight(weight_lbs, previousSmoothed);

  const id = generateId();
  const entry = {
    id,
    date,
    weight_lbs,
    smoothed_weight,
    notes,
    created_at: new Date().toISOString(),
    synced: 0,
  };

  await db.weightEntries.add(entry);
  return id;
}

// ============================================================================
// Food Log
// ============================================================================

/**
 * Get all food log entries for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Food entries for that date
 */
export async function getFoodLog(date) {
  return await db.foodLog.where('date').equals(date).toArray();
}

/**
 * Get food log entries across a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} All food entries in range, sorted by date
 */
export async function getFoodLogRange(startDate, endDate) {
  return await db.foodLog
    .where('date')
    .between(startDate, endDate, true, true)
    .sortBy('date');
}

/**
 * Add a food entry to the log
 * @param {Object} entry - Food entry data
 * @param {string} entry.date - Date (YYYY-MM-DD)
 * @param {string} entry.meal - Meal type ('breakfast', 'lunch', 'dinner', 'snack')
 * @param {string} entry.food_name - Name of the food
 * @param {number} entry.calories - Calorie count
 * @param {number} [entry.protein_g] - Protein in grams
 * @param {number} [entry.carbs_g] - Carbs in grams
 * @param {number} [entry.fat_g] - Fat in grams
 * @param {number} [entry.portion_g] - Portion weight in grams
 * @param {string} [entry.source] - Source ('manual', 'barcode', 'recipe', 'import')
 * @param {string} [entry.recipe_id] - ID if from a recipe
 * @param {string} [entry.confidence] - Confidence level ('high', 'medium', 'low')
 * @param {string} [entry.notes] - Optional notes
 * @returns {Promise<string>} Generated ID
 */
export async function addFoodEntry({
  date,
  meal,
  food_name,
  calories,
  protein_g = 0,
  carbs_g = 0,
  fat_g = 0,
  portion_g = 0,
  source = 'manual',
  recipe_id = null,
  confidence = 'medium',
  notes = '',
}) {
  const id = generateId();
  const entry = {
    id,
    date,
    meal,
    food_name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    portion_g,
    source,
    recipe_id,
    confidence,
    notes,
    created_at: new Date().toISOString(),
    synced: 0,
  };

  await db.foodLog.add(entry);
  return id;
}

/**
 * Delete a food entry
 * @param {string} id - Entry ID
 * @returns {Promise<void>}
 */
export async function deleteFoodEntry(id) {
  await db.foodLog.delete(id);
}

/**
 * Update a food entry
 * @param {string} id - Entry ID
 * @param {Object} changes - Fields to update
 * @returns {Promise<number>} Number of entries updated (0 or 1)
 */
export async function updateFoodEntry(id, changes) {
  return await db.foodLog.update(id, {
    ...changes,
    synced: 0,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Get daily totals for a specific date
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<{
 *   calories: number,
 *   protein_g: number,
 *   carbs_g: number,
 *   fat_g: number,
 *   meals: Object
 * }>} Daily totals
 */
export async function getDailyTotals(date) {
  const entries = await getFoodLog(date);

  const totals = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    meals: {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snack: 0,
    },
  };

  entries.forEach(entry => {
    totals.calories += entry.calories || 0;
    totals.protein_g += entry.protein_g || 0;
    totals.carbs_g += entry.carbs_g || 0;
    totals.fat_g += entry.fat_g || 0;

    if (totals.meals[entry.meal] !== undefined) {
      totals.meals[entry.meal] += entry.calories || 0;
    }
  });

  return totals;
}

// ============================================================================
// Training Days
// ============================================================================

/**
 * Get training status for a specific date
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<boolean>} True if training day
 */
export async function getTrainingDay(date) {
  const day = await db.trainingDays.get(date);
  if (day !== undefined) {
    return day.trained || false;
  }
  // Fallback to default schedule from settings if not explicitly set
  return isTrainingDay(date);
}

/**
 * Set training day status
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {boolean} trained - Whether this was a training day
 * @returns {Promise<void>}
 */
export async function setTrainingDay(date, trained) {
  await db.trainingDays.put({
    date,
    trained,
    created_at: new Date().toISOString(),
    synced: 0,
  });
}

/**
 * Check if a date is a training day
 * First checks explicit trainingDays table, falls back to settings
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<boolean>} True if training day
 */
export async function isTrainingDay(date) {
  // Check explicit entry first
  const entry = await db.trainingDays.get(date);
  if (entry) {
    return entry.trained;
  }

  // Fall back to default schedule from settings
  // Default schedule assumes 4 training days per week (e.g., Mon-Thurs)
  const dayOfWeek = new Date(date).getDay();
  const defaultTrainingDays = await getSetting('defaultTrainingDaysOfWeek');

  if (defaultTrainingDays && Array.isArray(defaultTrainingDays)) {
    return defaultTrainingDays.includes(dayOfWeek);
  }

  // Default: Monday-Thursday are training days
  return dayOfWeek >= 1 && dayOfWeek <= 4;
}

// ============================================================================
// Algorithm State
// ============================================================================

/**
 * Get current algorithm state
 * @returns {Promise<Object>} Algorithm state object
 */
export async function getAlgorithmState() {
  let state = await db.algorithmState.get('current');

  if (!state) {
    state = {
      id: 'current',
      tdee: 2400,
      formulaTDEE: 2400,
      dataDrivenTDEE: null,
      daysOfData: 0,
      lastAdjustmentDate: new Date().toISOString().split('T')[0],
      phase: 'cut',
      phaseStartDate: new Date().toISOString().split('T')[0],
      lastWeeklyCheckDate: null,
      created_at: new Date().toISOString(),
    };
  }

  return state;
}

/**
 * Update algorithm state
 * @param {Object} changes - Fields to update
 * @returns {Promise<void>}
 */
export async function updateAlgorithmState(changes) {
  const current = await getAlgorithmState();
  await db.algorithmState.put({
    ...current,
    ...changes,
    updated_at: new Date().toISOString(),
  });
}

// ============================================================================
// Weekly Summaries
// ============================================================================

/**
 * Get weekly summary for a specific week
 * @param {string} weekStart - Week start date (YYYY-MM-DD)
 * @returns {Promise<Object|null>} Weekly summary or null if not found
 */
export async function getWeeklySummary(weekStart) {
  const summaries = await db.weeklySummaries.where('week_start').equals(weekStart).toArray();
  return summaries.length > 0 ? summaries[0] : null;
}

/**
 * Save or update weekly summary
 * @param {Object} summary - Weekly summary object
 * @returns {Promise<string>} Summary ID
 */
export async function saveWeeklySummary(summary) {
  const id = summary.id || generateId();

  const record = {
    id,
    ...summary,
    created_at: summary.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.weeklySummaries.put(record);
  return id;
}

// ============================================================================
// Imported Recipes
// ============================================================================

/**
 * Get all imported recipes
 * @returns {Promise<Array>} Array of recipe objects
 */
export async function getImportedRecipes() {
  return await db.importedRecipes.toArray();
}

/**
 * Save an imported recipe
 * @param {Object} recipe - Recipe object
 * @param {string} recipe.name - Recipe name
 * @param {string} recipe.source_app - Source app (e.g., 'myfitnesspal')
 * @param {number} [recipe.servings] - Number of servings
 * @param {number} [recipe.calories_per_serving] - Calories per serving
 * @param {Array} [recipe.ingredients] - Ingredient list
 * @returns {Promise<string>} Recipe ID
 */
export async function saveImportedRecipe(recipe) {
  const id = recipe.id || generateId();

  const record = {
    id,
    ...recipe,
    created_at: recipe.created_at || new Date().toISOString(),
    synced: 0,
  };

  await db.importedRecipes.put(record);
  return id;
}

// ============================================================================
// Custom Foods
// ============================================================================

/**
 * Get all custom foods
 * @returns {Promise<Array>} Array of custom food objects
 */
export async function getCustomFoods() {
  return await db.customFoods.toArray();
}

/**
 * Save a custom food
 * @param {Object} food - Custom food object
 * @param {string} food.name - Food name
 * @param {number} [food.calories_per_gram] - Calories per gram
 * @param {number} [food.protein_per_gram] - Protein per gram
 * @param {number} [food.use_count] - Number of times used
 * @returns {Promise<string>} Food ID
 */
export async function saveCustomFood(food) {
  const id = food.id || generateId();

  const record = {
    id,
    ...food,
    use_count: food.use_count || 0,
    created_at: food.created_at || new Date().toISOString(),
    synced: 0,
  };

  await db.customFoods.put(record);
  return id;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get most recently used foods
 * @param {number} [limit=20] - Maximum number to return
 * @returns {Promise<Array>} Recent unique food entries from food log
 */
export async function getRecentFoods(limit = 20) {
  const entries = await db.foodLog.reverse().toArray();

  // Get unique food names preserving order
  const uniqueFoods = [];
  const seen = new Set();

  for (const entry of entries) {
    if (!seen.has(entry.food_name)) {
      uniqueFoods.push({
        food_name: entry.food_name,
        calories: entry.calories,
        protein_g: entry.protein_g,
        carbs_g: entry.carbs_g,
        fat_g: entry.fat_g,
      });
      seen.add(entry.food_name);

      if (uniqueFoods.length >= limit) break;
    }
  }

  return uniqueFoods;
}

/**
 * Get favorite/most-used custom foods
 * @param {number} [limit=20] - Maximum number to return
 * @returns {Promise<Array>} Custom foods sorted by use_count descending
 */
export async function getFavoriteFoods(limit = 20) {
  return await db.customFoods
    .orderBy('use_count')
    .reverse()
    .limit(limit)
    .toArray();
}

/**
 * Generate a unique ID using crypto.randomUUID
 * @returns {string} Unique ID
 */
export function generateId() {
  return crypto.randomUUID();
}
