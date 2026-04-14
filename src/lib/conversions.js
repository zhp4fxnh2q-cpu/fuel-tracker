/**
 * Unit conversion utilities and cooking yield factors
 * Handles raw-to-cooked weight conversions and volume-to-weight conversions
 * @module lib/conversions
 */

/**
 * Cooking yield factors: raw weight to cooked weight ratio
 * Factor > 1 means food expands (e.g., rice absorbs water)
 * Factor < 1 means food shrinks (e.g., meat loses moisture)
 * @type {Object<string, number>}
 */
export const COOKING_YIELD_FACTORS = {
  'chicken breast': 0.75,
  'ground beef': 0.70,
  'ground turkey': 0.72,
  'pork chop': 0.75,
  'salmon': 0.80,
  'shrimp': 0.80,
  'bacon': 0.35,
  'steak': 0.75,
  'white rice': 3.0,
  'brown rice': 2.8,
  'pasta': 2.25,
  'oatmeal': 3.5,
  'quinoa': 2.75,
  'spinach': 0.30,
  'broccoli': 0.80,
  'onion': 0.75,
  'mushrooms': 0.50,
  'bell pepper': 0.80,
  'zucchini': 0.75,
  'sweet potato': 0.85,
  'dried beans': 2.5,
  'lentils': 2.5,
  'default_protein': 0.75,
  'default_vegetable': 0.75,
  'default_grain': 2.5,
};

/**
 * Common volume-to-gram conversions for cooking
 * Maps volume units to ingredient-specific weights
 * @type {Object}
 */
export const VOLUME_TO_GRAMS = {
  'cup': {
    flour: 120,
    sugar: 200,
    rice: 185,
    oats: 90,
    milk: 240,
    oil: 218,
    cheese_shredded: 113,
    beans: 180,
  },
  'tbsp': {
    butter: 14,
    oil: 14,
    sugar: 12,
    flour: 8,
  },
  'tsp': {
    salt: 6,
    sugar: 4,
    oil: 5,
  },
  'oz': 28.35,
  'lb': 453.6,
};

/**
 * Get the cooked weight factor for an ingredient name
 * Matches ingredient name against known factors and ingredient categories
 * @param {string} ingredientName - The name of the ingredient
 * @returns {number} Cooking yield factor (ratio of cooked to raw weight)
 * @example
 * getCookingYieldFactor('chicken breast') // returns 0.75
 * getCookingYieldFactor('brown rice') // returns 2.8
 * getCookingYieldFactor('unknown protein') // returns 0.75 (default for proteins)
 */
export function getCookingYieldFactor(ingredientName) {
  const lower = ingredientName.toLowerCase().trim();

  // First, check for exact or substring matches in the lookup table
  for (const [key, factor] of Object.entries(COOKING_YIELD_FACTORS)) {
    if (lower.includes(key)) {
      return factor;
    }
  }

  // If no direct match, categorize by common ingredient keywords
  if (/chicken|beef|pork|turkey|fish|shrimp|lamb|steak|meat|veal|duck/.test(lower)) {
    return 0.75;
  }
  if (/rice|pasta|noodle|grain|quinoa|oat|barley|couscous|millet/.test(lower)) {
    return 2.5;
  }
  if (/spinach|kale|greens|arugula|lettuce/.test(lower)) {
    return 0.30;
  }
  if (/pepper|tomato|carrot|celery|cucumber|mushroom|zucchini|squash|broccoli|cauliflower|cabbage|brussels|bean|pea/.test(lower)) {
    return 0.75;
  }
  if (/potato|yam|root vegetable/.test(lower)) {
    return 0.85;
  }

  // Default: no cooking loss/gain
  return 1.0;
}

/**
 * Convert pounds to kilograms
 * @param {number} lbs - Weight in pounds
 * @returns {number} Weight in kilograms
 */
export function lbsToKg(lbs) {
  return lbs * 0.453592;
}

/**
 * Convert inches to centimeters
 * @param {number} inches - Length in inches
 * @returns {number} Length in centimeters
 */
export function inchesToCm(inches) {
  return inches * 2.54;
}

/**
 * Convert kilograms to pounds
 * @param {number} kg - Weight in kilograms
 * @returns {number} Weight in pounds
 */
export function kgToLbs(kg) {
  return kg / 0.453592;
}

/**
 * Convert centimeters to inches
 * @param {number} cm - Length in centimeters
 * @returns {number} Length in inches
 */
export function cmToInches(cm) {
  return cm / 2.54;
}
