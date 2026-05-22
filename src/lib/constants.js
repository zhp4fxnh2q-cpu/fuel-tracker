/**
 * FUEL — Constants, defaults, and tuning knobs.
 * All units imperial (lbs, inches) per David's preference.
 */

// Auth gate
export const ALLOWED_EMAILS = ['rogersdna15@gmail.com', 'david@providenceswfl.com'];
export const GOOGLE_CLIENT_ID = '891453787242-vblf8lv91g5eamr9u6252aukhii5fpk4.apps.googleusercontent.com';

// Default profile (David's actual stats — bootstraps fuel_settings on first run)
export const DEFAULT_PROFILE = {
  weight_lbs: 220,
  height_in: 78,
  age: 36,
  sex: 'male',
  activity_level: 'moderate', // sedentary | light | moderate | very | extreme
  goal: 'cut',                 // cut | maintain | gain
  target_rate_pct: 0.625,      // % bodyweight per week (loss when cutting)
  training_days_per_week: 4,
};

// Default macro/calorie targets — overridden by algorithm once it has data
export const DEFAULT_TARGETS = {
  protein_g_per_lb: 1.0,        // floor: 1 g/lb body weight (220 g for David)
  fat_g_per_lb: 0.3,            // floor: 0.3 g/lb (66 g for David)
  training_kcal: 2650,
  rest_kcal: 2150,
  calorie_floor: 2200,          // hard stop on training days
  training_carb_floor_g: 100,   // never recommend below this on training days
  weekly_cal_budget: null,      // computed: training*N + rest*(7-N)
};

// Algorithm tuning
export const EWMA_ALPHA = 0.12;          // weight trend smoothing (spec value)
export const KCAL_PER_LB = 3500;          // conventional energy density
export const REVIEW_WINDOW_DAYS = 14;     // back-solve window
export const MIN_DAYS_FOR_TDEE = 14;      // before first algorithmic adjustment
export const COLD_START_DAYS = 30;        // formula→data blend ramp
export const TRAINING_DAY_BONUS = 250;    // training day kcal vs base
export const MAX_WEEKLY_KCAL_CHANGE = 200; // ±200 kcal per week cap
export const DIET_BREAK_AFTER_WEEKS = 8;  // surface diet break prompt

// Phase enum
export const PHASE = {
  CUT: 'cutting',
  MAINTAIN: 'maintenance',
  DIET_BREAK: 'diet_break',
  REVERSE: 'reverse',
};

// Meal slot defaults (user can edit in settings)
export const DEFAULT_MEAL_SLOTS = ['Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner', 'Snack 3'];

// Source enum for fuel_food_log entries
export const SOURCE = {
  USDA: 'usda',
  MEAL_PLANNER: 'meal_planner',
  SAVED_MEAL: 'saved_meal',
  AI_ESTIMATE: 'ai_estimate',
  MANUAL: 'manual',
};

// Default user preferences
export const DEFAULT_PREFERENCES = {
  meal_slots: DEFAULT_MEAL_SLOTS,
  training_day_overrides: {},        // { 'YYYY-MM-DD': true|false }
  theme: 'dark',
  units: 'imperial',
  intraday_rebalance: true,          // smart rebalance with floors (David's call)
  macro_preset: 'balanced',          // balanced | low_carb | keto | custom
  custom_macros: { protein_g: null, fat_g: null, carbs_g: null }, // used when macro_preset='custom'
};

// Tab definitions for bottom nav
export const TABS = [
  { id: 'today', label: 'Today', glyph: 'TD' },
  { id: 'log', label: 'Log', glyph: 'LG' },
  { id: 'weight', label: 'Weight', glyph: 'WT' },
  { id: 'trends', label: 'Trends', glyph: 'TR' },
  { id: 'settings', label: 'Settings', glyph: 'ST' },
];


// ─────────────────────────────────────────────────────────────────────────────
// Phase H — macro presets
// ─────────────────────────────────────────────────────────────────────────────
//
// Each preset reshapes protein/fat/carb targets while still hitting the
// day's calorie target. See lib/algorithm.js deriveMacroTargets().

export const MACRO_PRESETS = {
  balanced: {
    label: 'Balanced',
    description: '1.0 g/lb protein, 0.3 g/lb fat, carbs fill the rest.',
  },
  low_carb: {
    label: 'Low carb',
    description: 'Carbs capped near 100 g; fat picks up the slack.',
  },
  keto: {
    label: 'Keto',
    description: 'Carbs ~30 g, fat ~70% of kcal, protein 0.8 g/lb.',
  },
  custom: {
    label: 'Custom',
    description: 'Set your own protein/fat/carb grams.',
  },
};
