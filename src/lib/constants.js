/**
 * Constants and default configuration for the FUEL calorie tracking app
 * @module lib/constants
 */

/**
 * Default user profile settings
 * @type {Object}
 */
export const DEFAULT_PROFILE = {
  name: 'David',
  heightInches: 78,
  startingWeight: 220,
  sex: 'male',
  trainingDaysPerWeek: 4,
  trainingDayCalories: 2650,
  restDayCalories: 2150,
  dailyProteinTarget: 200,
  goal: 'cut',
  targetLossRatePercent: 0.625, // midpoint of 0.5-0.75%
};

/**
 * Meal categories for food logging
 * @type {string[]}
 */
export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Training phases for adaptive TDEE
 * @type {Object}
 */
export const PHASE = {
  CUT: 'cut',
  MAINTENANCE: 'maintenance',
  DIET_BREAK: 'diet_break',
};

/**
 * Confidence levels for user input
 * @type {Object}
 */
export const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/**
 * Minimum daily calorie intake (safety guard)
 * @type {number}
 */
export const MIN_CALORIES = 1700;

/**
 * Calories per pound of body weight (used for weekly loss calculations)
 * @type {number}
 */
export const KCAL_PER_LB = 3500;

/**
 * Exponential Weighted Moving Average alpha for weight smoothing
 * @type {number}
 */
export const EWMA_ALPHA = 0.2;

/**
 * Minimum days of data required for adaptive TDEE calculation
 * @type {number}
 */
export const MIN_DAYS_FOR_TDEE = 14;

/**
 * Cold start period in days (blend between formula and data-driven TDEE)
 * @type {number}
 */
export const COLD_START_DAYS = 30;

/**
 * Extra calories to add for training days
 * @type {number}
 */
export const TRAINING_DAY_BONUS = 250;

/**
 * Duration of diet break phase in weeks before suggesting maintenance
 * @type {number}
 */
export const DIET_BREAK_WEEKS = 8;

/**
 * Standard increment/decrement for calorie adjustments
 * @type {number}
 */
export const ADJUSTMENT_STEP = 150;

/**
 * Tab navigation configuration
 * @type {Array<{id: string, label: string, icon: string}>}
 */
export const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'food', label: 'Food Log', icon: 'utensils' },
  { id: 'weight', label: 'Weight', icon: 'scale' },
  { id: 'trends', label: 'Trends', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];
