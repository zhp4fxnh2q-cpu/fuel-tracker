/**
 * Meal Planner Data
 * Static array of meals from Rogers Family Meal Planner
 * Custom meals are fetched from Supabase
 */

const MEAL_PLANNER_MEALS = [
  { id: 'B001', name: 'Steel Cut Oatmeal', times: ['Breakfast'], cuisine: 'American' },
  { id: 'B002', name: 'Dutch Baby', times: ['Breakfast'], cuisine: 'American' },
  { id: 'B003', name: 'Shakshuka', times: ['Breakfast', 'Lunch'], cuisine: 'Mediterranean' },
  { id: 'B004', name: 'Huevos de Abuelita', times: ['Breakfast'], cuisine: 'Latin' },
  { id: 'B005', name: 'Eggs', times: ['Breakfast'], cuisine: 'American' },
  { id: 'B007', name: 'Kodiak Pancakes', times: ['Breakfast'], cuisine: 'American' },
  { id: 'B008', name: 'Maple Brown Sugar Cream of Wheat', times: ['Breakfast'], cuisine: 'American' },
  { id: 'B009', name: 'Parfait', times: ['Breakfast', 'Dinner'], cuisine: 'American' },
  { id: 'B010', name: 'Breakfast Burrito', times: ['Breakfast'], cuisine: 'Mexican/Latin' },
  { id: 'D001', name: 'Spicy Shrimp & Andouille over Charleston Grits', times: ['Dinner', 'Lunch'], cuisine: 'Southern/Cajun' },
  { id: 'D002', name: 'Meatloaf (Alton Brown Mod)', times: ['Dinner', 'Lunch'], cuisine: 'American' },
  { id: 'D003', name: 'Greek Moussaka', times: ['Dinner', 'Lunch'], cuisine: 'Greek/Mediterranean' },
  { id: 'D004', name: 'Turkish Chicken Wraps', times: ['Dinner', 'Lunch'], cuisine: 'Turkish/Mediterranean' },
  { id: 'D005', name: 'Lentil Stew', times: ['Dinner'], cuisine: 'American/Latin' },
  { id: 'D006', name: 'Hearty Kid-Friendly Turkey Chili', times: ['Dinner'], cuisine: 'American' },
  { id: 'D007', name: 'Pot Roast', times: ['Dinner'], cuisine: 'American' },
  { id: 'D008', name: 'Birria de Res (Quesatacos)', times: ['Dinner'], cuisine: 'Mexican' },
  { id: 'D009', name: 'Tacos Al Pastor', times: ['Dinner'], cuisine: 'Mexican' },
  { id: 'D010', name: 'Cauliflower Supreme Pizza', times: ['Dinner'], cuisine: 'American/Italian' },
  { id: 'D011', name: 'Frozen Gyoza', times: ['Dinner', 'Lunch'], cuisine: 'Japanese' },
  { id: 'D012', name: 'Frozen Udon Noodles', times: ['Dinner', 'Lunch'], cuisine: 'Japanese' },
  { id: 'D013', name: 'Gyoza & Udon Combo', times: ['Dinner'], cuisine: 'Japanese' },
  { id: 'D014', name: 'Cañón de Cerdo Entomatado', times: ['Dinner', 'Lunch'], cuisine: 'Honduran/Latin' },
  { id: 'D015', name: 'Chuletas de Diario', times: ['Dinner', 'Lunch'], cuisine: 'Mexican/Latin' },
  { id: 'D016', name: 'Carbonada Criolla', times: ['Dinner'], cuisine: 'Chilean/Latin' },
  { id: 'D017', name: 'Carne Asada a la Plancha', times: ['Dinner', 'Lunch'], cuisine: 'Central American/Latin' },
  { id: 'D018', name: 'Vaca Frita', times: ['Dinner', 'Lunch'], cuisine: 'Cuban/Latin' },
  { id: 'D019', name: 'Carne Guisada', times: ['Dinner', 'Lunch'], cuisine: 'Guatemalan/Latin' },
  { id: 'D020', name: 'Pollo en Loroco', times: ['Dinner', 'Lunch'], cuisine: 'Guatemalan/Latin' },
  { id: 'D021', name: 'Pollo en Cerveza', times: ['Dinner', 'Lunch'], cuisine: 'Central American/Latin' },
  { id: 'D022', name: 'Pollo para Tacos', times: ['Dinner', 'Lunch'], cuisine: 'Mexican/Latin' },
  { id: 'D023', name: 'Sopa de Fideos', times: ['Dinner', 'Lunch'], cuisine: 'Mexican/Latin' },
  { id: 'D024', name: 'Camarones Veracruzanos', times: ['Dinner', 'Lunch'], cuisine: 'Mexican/Latin' },
  { id: 'D025', name: 'Sopa de Quinoa', times: ['Dinner', 'Lunch'], cuisine: 'Bolivian/Latin' },
  { id: 'D026', name: 'Arroz con Pollo', times: ['Dinner', 'Lunch'], cuisine: 'Latin' },
  { id: 'D027', name: 'Pastelón de Plátano Maduro', times: ['Dinner', 'Lunch'], cuisine: 'Dominican/Latin' },
  { id: 'D028', name: 'Sopa Juliana', times: ['Dinner', 'Lunch'], cuisine: 'Central American/Latin' },
  { id: 'D029', name: 'Sopa de Riendas', times: ['Dinner', 'Lunch'], cuisine: 'Chilean/Latin' },
  { id: 'D030', name: 'Sopa de Tortilla', times: ['Dinner', 'Lunch'], cuisine: 'Mexican/Latin' },
  { id: 'D031', name: 'Pozole Rojo de Pollo', times: ['Dinner', 'Lunch'], cuisine: 'Mexican/Latin' },
  { id: 'D032', name: 'Pollo Guisado', times: ['Dinner', 'Lunch'], cuisine: 'Panamanian/Latin' },
  { id: 'D033', name: 'Sancocho de Domingo', times: ['Dinner', 'Lunch'], cuisine: 'Panamanian/Latin' },
  { id: 'D034', name: 'Cochinita Pibil', times: ['Dinner'], cuisine: 'Mexican/Yucatan' },
  { id: 'D035', name: 'Steak', times: ['Dinner', 'Lunch'], cuisine: 'American' },
  { id: 'D036', name: 'Hamburgers', times: ['Dinner', 'Lunch'], cuisine: 'American' },
  { id: 'D037', name: 'Hot Dogs', times: ['Lunch'], cuisine: 'American' },
  { id: 'D038', name: 'Mixtas', times: ['Dinner', 'Lunch'], cuisine: 'Guatemalan' },
  { id: 'D039', name: 'Spaghetti', times: ['Dinner'], cuisine: 'American' },
  { id: 'D040', name: 'Pulled Pork', times: ['Lunch'], cuisine: 'American' },
  { id: 'D041', name: 'Burrito (Pollo or Carne Asada)', times: ['Dinner', 'Lunch'], cuisine: 'Mexican/Latin' },
  { id: 'D042', name: 'Fish Sticks & Fish Filets', times: ['Dinner'], cuisine: 'American' },
  { id: 'L001', name: 'Chicken Salad', times: ['Lunch'], cuisine: 'American' },
  { id: 'L003', name: 'Tuna Salad', times: ['Lunch'], cuisine: 'American' },
  { id: 'L004', name: 'Lentil Soup', times: ['Dinner', 'Lunch'], cuisine: 'American' },
  { id: 'L005', name: 'Shepherd\'s Pie', times: ['Dinner', 'Lunch'], cuisine: 'British' },
  { id: 'L006', name: 'Country Captain', times: ['Dinner', 'Lunch'], cuisine: 'Indian-American' },
  { id: 'L007', name: 'Cincinnati Chili', times: ['Dinner', 'Lunch'], cuisine: 'American' },
  { id: 'L008', name: 'Sloppy Joe', times: ['Dinner', 'Lunch'], cuisine: 'American' },
  { id: 'L009', name: 'Caesar Salad', times: ['Lunch', 'Dinner'], cuisine: 'American' },
];

// ── Supabase RPC config (anon key only, no auth needed) ──
const SUPABASE_URL = 'https://nuixrqyzzwkpdwzzkjsg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51aXhycXl6endrcGR3enpranNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzUzODUsImV4cCI6MjA4OTU1MTM4NX0.41hCtjD8ZgMbYYg2pSWDcVxUXwO3xB4zBKY7KiLPW84';
const MEAL_PLANNER_USER_ID = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6';

// Cache the RPC result for the session (plan + custom_meals)
let _cachedRpcData = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchRpcData() {
  const now = Date.now();
  if (_cachedRpcData && (now - _cacheTimestamp) < CACHE_TTL_MS) {
    return _cachedRpcData;
  }
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_fuel_plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ p_user_id: MEAL_PLANNER_USER_ID }),
    });
    if (!resp.ok) {
      console.error('RPC get_fuel_plan failed:', resp.status);
      return null;
    }
    const data = await resp.json();
    _cachedRpcData = data;
    _cacheTimestamp = now;
    return data;
  } catch (error) {
    console.error('Error calling get_fuel_plan RPC:', error);
    return null;
  }
}

/**
 * Fetch custom meals from Supabase via RPC
 * Filters out items with _isSide flag
 */
export async function fetchCustomMeals() {
  try {
    const data = await fetchRpcData();
    if (!data) return [];

    const customMealsArray = data.custom_meals || [];

    // Filter out sides and map to our format
    return customMealsArray
      .filter(meal => !meal._isSide)
      .map(meal => ({
        id: meal.id || meal.name,
        name: meal.name,
        times: Array.isArray(meal.time) ? meal.time : [meal.time || 'Dinner'],
        cuisine: meal.cuisine || 'Custom',
      }));
  } catch (error) {
    console.error('Error fetching custom meals:', error);
    return [];
  }
}

/**
 * Get all meal planner meals (static + custom)
 */
export async function getAllMealPlannerMeals() {
  const customMeals = await fetchCustomMeals();
  return [...MEAL_PLANNER_MEALS, ...customMeals];
}

/**
 * Map FUEL meal types to Meal Planner mealTime values
 */
const MEAL_TIME_MAP = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

/**
 * Fetch today's planned meals from Supabase via RPC
 * Returns an object keyed by FUEL meal type: { breakfast: { id, name, cuisine, ... }, lunch: ..., dinner: ... }
 */
export async function fetchTodaysPlan(dateStr) {
  try {
    const data = await fetchRpcData();
    if (!data) return {};

    const plan = data.plan || {};
    const customMeals = data.custom_meals || [];

    // Build a lookup of all meals (static + custom) by ID
    const mealLookup = {};
    MEAL_PLANNER_MEALS.forEach(m => { mealLookup[m.id] = m; });
    customMeals
      .filter(m => !m._isSide)
      .forEach(m => {
        mealLookup[m.id || m.name] = {
          id: m.id || m.name,
          name: m.name,
          times: Array.isArray(m.time) ? m.time : [m.time || 'Dinner'],
          cuisine: m.cuisine || 'Custom',
        };
      });

    // The plan object has keys like "2026-04-14_Breakfast", "2026-04-14_Lunch", etc.
    // OR it could be an array of slot objects with { date, mealTime, mealId, ... }
    const result = {};

    if (Array.isArray(plan)) {
      // Array format: filter slots for this date
      plan.forEach(slot => {
        if (slot.date === dateStr && slot.mealId) {
          const fuelMealType = Object.entries(MEAL_TIME_MAP).find(
            ([, plannerTime]) => plannerTime === slot.mealTime
          )?.[0];
          if (fuelMealType && mealLookup[slot.mealId]) {
            result[fuelMealType] = { ...mealLookup[slot.mealId] };
          }
        }
      });
    } else if (typeof plan === 'object') {
      // Object format: keys like "2026-04-14_Breakfast"
      Object.entries(plan).forEach(([key, slot]) => {
        if (!key.startsWith(dateStr)) return;
        const mealId = slot?.mealId || slot;
        if (!mealId) return;

        // Extract mealTime from key: "2026-04-14_Breakfast" -> "Breakfast"
        const mealTime = key.replace(dateStr + '_', '');
        const fuelMealType = Object.entries(MEAL_TIME_MAP).find(
          ([, plannerTime]) => plannerTime === mealTime
        )?.[0];

        if (fuelMealType) {
          const meal = mealLookup[typeof mealId === 'string' ? mealId : mealId];
          if (meal) {
            result[fuelMealType] = { ...meal };
          }
        }
      });
    }

    return result;
  } catch (error) {
    console.error('Error fetching today plan:', error);
    return {};
  }
}

export default MEAL_PLANNER_MEALS;
