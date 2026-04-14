/**
 * Adaptive TDEE algorithm for calorie tracking
 * Blends formula-based TDEE with data-driven TDEE from user history
 * Pure module with zero UI dependencies
 * @module lib/algorithm
 */

import {
  EWMA_ALPHA,
  MIN_DAYS_FOR_TDEE,
  COLD_START_DAYS,
  KCAL_PER_LB,
  TRAINING_DAY_BONUS,
  MIN_CALORIES,
  ADJUSTMENT_STEP,
} from './constants.js';

/**
 * Update smoothed weight using Exponential Weighted Moving Average
 * @param {number} newWeight - New weight measurement in lbs
 * @param {number} previousSmoothed - Previous smoothed weight value
 * @param {number} [alpha=0.2] - EWMA alpha parameter (0-1, lower = more smoothing)
 * @returns {number} Updated smoothed weight
 * @example
 * const smoothed = updateSmoothedWeight(220, 219.5, 0.2)
 * // smoothed = 219.6
 */
export function updateSmoothedWeight(newWeight, previousSmoothed, alpha = EWMA_ALPHA) {
  if (previousSmoothed === null || previousSmoothed === undefined) {
    return newWeight;
  }
  return alpha * newWeight + (1 - alpha) * previousSmoothed;
}

/**
 * Calculate TDEE using Mifflin-St Jeor formula
 * @param {number} weightKg - Current weight in kilograms
 * @param {number} heightCm - Height in centimeters
 * @param {number} age - Age in years
 * @param {string} [sex='male'] - 'male' or 'female'
 * @param {number} [activityFactor=1.55] - Activity multiplier (1.2-1.9 typical range)
 * @returns {number} Estimated daily TDEE in calories
 * @example
 * const tdee = calculateFormulaTDEE(100, 178, 35, 'male', 1.55)
 * // Returns estimated TDEE around 2500-2600 calories
 */
export function calculateFormulaTDEE(weightKg, heightCm, age, sex = 'male', activityFactor = 1.55) {
  let bmr;

  if (sex.toLowerCase() === 'female') {
    // Mifflin-St Jeor for females
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  } else {
    // Mifflin-St Jeor for males
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }

  const tdee = bmr * activityFactor;
  return Math.round(tdee);
}

/**
 * Calculate adaptive TDEE from user data history
 * Back-calculates actual TDEE from weight changes and food intake
 * Returns null if insufficient data (<14 days)
 * @param {Array<{date: string, weight_lbs: number, smoothed_weight: number}>} weightEntries
 *   - Sorted by date ascending
 *   - date format: 'YYYY-MM-DD'
 * @param {Array<{date: string, calories: number}>} foodLogEntries
 *   - date format: 'YYYY-MM-DD'
 * @param {number} [days=28] - Window to analyze (defaults to 28 days)
 * @returns {number|null} Estimated TDEE in calories, or null if insufficient data
 * @example
 * const tdee = calculateAdaptiveTDEE(weightEntries, foodLogEntries, 28)
 * // Returns null if < 14 days of data
 */
export function calculateAdaptiveTDEE(weightEntries, foodLogEntries, days = 28) {
  if (!weightEntries || weightEntries.length === 0 || !foodLogEntries) {
    return null;
  }

  // Sort weight entries by date
  const sortedWeights = [...weightEntries].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Get date range for analysis
  const endDate = new Date(sortedWeights[sortedWeights.length - 1].date);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  // Filter entries within window
  const weightsInWindow = sortedWeights.filter(w => {
    const wDate = new Date(w.date);
    return wDate >= startDate && wDate <= endDate;
  });

  if (weightsInWindow.length < 2) {
    return null;
  }

  // Get logged days in window
  const loggedDays = foodLogEntries.filter(log => {
    const logDate = new Date(log.date);
    return logDate >= startDate && logDate <= endDate;
  });

  if (loggedDays.length < MIN_DAYS_FOR_TDEE) {
    return null;
  }

  // Calculate average daily calories from logged days
  const totalCalories = loggedDays.reduce((sum, log) => sum + (log.calories || 0), 0);
  const avgDailyCalories = totalCalories / loggedDays.length;

  // Calculate weight change (smoothed weights)
  const startWeight = weightsInWindow[0].smoothed_weight;
  const endWeight = weightsInWindow[weightsInWindow.length - 1].smoothed_weight;
  const weightChange = endWeight - startWeight; // Negative = weight loss

  // Calculate days elapsed
  const daysElapsed = daysBetween(
    new Date(weightsInWindow[0].date),
    new Date(weightsInWindow[weightsInWindow.length - 1].date)
  );

  if (daysElapsed === 0) {
    return null;
  }

  // Back-calculate TDEE from weight change
  // Weight change (lbs) * 3500 kcal/lb / days = daily deficit/surplus
  const calorieDeficit = (weightChange * KCAL_PER_LB) / daysElapsed;

  // TDEE = average intake - deficit (deficit is positive for weight loss)
  const estimatedTDEE = avgDailyCalories - calorieDeficit;

  return Math.round(Math.max(estimatedTDEE, MIN_CALORIES));
}

/**
 * Blend formula-based and data-driven TDEE during cold start period
 * During first 30 days, progressively shift from formula to data-driven estimate
 * @param {number} formulaTDEE - TDEE from Mifflin-St Jeor formula
 * @param {number|null} dataDrivenTDEE - TDEE calculated from user data, or null
 * @param {number} daysOfData - Number of days of food/weight data available
 * @returns {number} Blended TDEE estimate
 * @example
 * const blended = getBlendedTDEE(2500, 2400, 10)
 * // Returns weighted average favoring formula during cold start
 */
export function getBlendedTDEE(formulaTDEE, dataDrivenTDEE, daysOfData) {
  // If no data-driven estimate available, use formula
  if (!dataDrivenTDEE || daysOfData === 0) {
    return formulaTDEE;
  }

  // If enough data accumulated, trust data-driven estimate
  if (daysOfData >= COLD_START_DAYS) {
    return dataDrivenTDEE;
  }

  // During cold start, blend based on data availability
  const dataWeight = daysOfData / COLD_START_DAYS;
  const formulaWeight = 1 - dataWeight;

  return Math.round(formulaTDEE * formulaWeight + dataDrivenTDEE * dataWeight);
}

/**
 * Generate daily calorie targets for training and rest days
 * @param {number} tdee - Total Daily Energy Expenditure
 * @param {number} [trainingDaysPerWeek=4] - Number of training days per week
 * @param {number} [trainingBonus=250] - Extra calories for training days
 * @returns {{trainingTarget: number, restTarget: number, avgDailyTarget: number}}
 * @example
 * const targets = generateTargets(2400, 4, 250)
 * // {
 * //   trainingTarget: 2400,
 * //   restTarget: 2150,
 * //   avgDailyTarget: 2275  // weighted average
 * // }
 */
export function generateTargets(tdee, trainingDaysPerWeek = 4, trainingBonus = TRAINING_DAY_BONUS) {
  const restDaysPerWeek = 7 - trainingDaysPerWeek;

  const trainingTarget = tdee + trainingBonus;
  const restTarget = tdee - (trainingBonus * trainingDaysPerWeek) / restDaysPerWeek;

  // Calculate weekly average
  const weeklyCalories = trainingTarget * trainingDaysPerWeek + restTarget * restDaysPerWeek;
  const avgDailyTarget = weeklyCalories / 7;

  return {
    trainingTarget: Math.round(trainingTarget),
    restTarget: Math.round(Math.max(restTarget, MIN_CALORIES)),
    avgDailyTarget: Math.round(avgDailyTarget),
  };
}

/**
 * Apply safety guardrails to calorie targets
 * Ensures targets don't drop too low or increase excessively
 * @param {{trainingTarget: number, restTarget: number, avgDailyTarget: number}} targets
 * @param {number} currentWeight - Current weight in lbs
 * @param {number} currentTDEE - Current estimated TDEE
 * @returns {{trainingTarget: number, restTarget: number, avgDailyTarget: number}} Clamped targets
 */
export function applyGuardrails(targets, currentWeight, currentTDEE) {
  // Ensure minimum calorie intake for health and sustainability
  const minCalories = Math.max(MIN_CALORIES, currentWeight * 10); // At least 10 cal/lb

  // Cap increases/decreases at reasonable rate (max 20% change)
  const maxIncrease = currentTDEE * 1.2;
  const minDecreaseFloor = currentTDEE * 0.8;

  return {
    trainingTarget: Math.round(
      Math.max(minCalories, Math.min(targets.trainingTarget, maxIncrease))
    ),
    restTarget: Math.round(
      Math.max(minCalories, Math.min(targets.restTarget, maxIncrease))
    ),
    avgDailyTarget: Math.round(
      Math.max(minCalories, Math.min(targets.avgDailyTarget, maxIncrease))
    ),
  };
}

/**
 * Perform weekly check and recommend calorie adjustments
 * Analyzes weight trend and adherence to determine if adjustment needed
 * @param {Object} algorithmState - Current algorithm state object
 *   - {tdee, lastAdjustmentDate, recentTrend, adherenceRate}
 * @param {Array<{date: string, smoothed_weight: number}>} recentWeightEntries - Last 7-14 days
 * @param {Array<{date: string, calories: number}>} recentFoodLog - Last 7 days
 * @returns {{action: string, amount: number, reason: string}}
 *   - action: 'increase', 'decrease', or 'maintain'
 *   - amount: calories to adjust by (positive or negative)
 *   - reason: explanation for the recommendation
 */
export function weeklyCheck(algorithmState, recentWeightEntries, recentFoodLog) {
  if (!algorithmState || recentWeightEntries.length < 3) {
    return {
      action: 'maintain',
      amount: 0,
      reason: 'Insufficient data for adjustment recommendation',
    };
  }

  // Calculate weight trend (comparing last 3 days to previous 3 days)
  if (recentWeightEntries.length >= 6) {
    const recent3 = recentWeightEntries.slice(-3);
    const previous3 = recentWeightEntries.slice(-6, -3);

    const recentAvg =
      recent3.reduce((sum, w) => sum + w.smoothed_weight, 0) / recent3.length;
    const previousAvg =
      previous3.reduce((sum, w) => sum + w.smoothed_weight, 0) / previous3.length;

    const trend = previousAvg - recentAvg; // Positive = losing weight
    const adherenceRate =
      recentFoodLog.length > 0
        ? recentFoodLog.length / Math.min(7, recentWeightEntries.length)
        : 0;

    // If losing weight faster than expected (>0.75 lbs/week), increase calories
    if (trend > 0.75 && adherenceRate > 0.7) {
      return {
        action: 'increase',
        amount: ADJUSTMENT_STEP,
        reason: 'Weight loss exceeding target rate, calories increased for sustainability',
      };
    }

    // If not losing weight but adherent to plan, decrease calories slightly
    if (trend < 0.25 && trend >= 0 && adherenceRate > 0.8) {
      return {
        action: 'decrease',
        amount: ADJUSTMENT_STEP,
        reason: 'Insufficient weight loss despite good adherence, calories decreased',
      };
    }

    // If gaining weight despite deficit expectations, decrease calories
    if (trend < 0 && adherenceRate > 0.8) {
      return {
        action: 'decrease',
        amount: ADJUSTMENT_STEP * 1.5,
        reason: 'Weight gain despite adherence, TDEE reassessment needed',
      };
    }

    if (trend > 0 && trend <= 0.75) {
      return {
        action: 'maintain',
        amount: 0,
        reason: `Excellent progress: ${trend.toFixed(2)} lbs/week, maintaining current targets`,
      };
    }
  }

  return {
    action: 'maintain',
    amount: 0,
    reason: 'Weight trend within optimal range',
  };
}

/**
 * Check if diet break is needed after extended cutting phase
 * @param {string} phaseStartDate - When current phase began (YYYY-MM-DD format)
 * @param {string} phase - Current phase ('cut', 'maintenance', or 'diet_break')
 * @returns {{needed: boolean, message: string, weeksElapsed: number}}
 */
export function checkDietBreakNeeded(phaseStartDate, phase) {
  if (phase !== 'cut') {
    return {
      needed: false,
      message: 'Diet break only needed during cut phase',
      weeksElapsed: 0,
    };
  }

  const startDate = new Date(phaseStartDate);
  const today = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.floor((today - startDate) / msPerWeek);

  const DIET_BREAK_INTERVAL = 8; // 8 weeks before suggesting break

  if (weeksElapsed >= DIET_BREAK_INTERVAL) {
    return {
      needed: true,
      message: `${weeksElapsed} weeks in cut phase. Consider a 1-2 week diet break to reset hormones and maintain adherence.`,
      weeksElapsed,
    };
  }

  return {
    needed: false,
    message: `${weeksElapsed} weeks into cut (${DIET_BREAK_INTERVAL - weeksElapsed} weeks until break recommended)`,
    weeksElapsed,
  };
}

/**
 * Compute weekly summary statistics
 * Aggregates weight and food data for the given week
 * @param {Array<{date: string, smoothed_weight: number}>} weightEntries
 * @param {Array<{date: string, calories: number, protein_g?: number}>} foodLogEntries
 * @param {Array<string>} trainingDays - Array of dates (YYYY-MM-DD) that were training days
 * @param {string} weekStartDate - Start of week (YYYY-MM-DD format)
 * @returns {{
 *   weekStart: string,
 *   weekEnd: string,
 *   startWeight: number,
 *   endWeight: number,
 *   weeklyChange: number,
 *   avgDailyCalories: number,
 *   avgDailyProtein: number,
 *   daysLogged: number,
 *   trainingDaysCount: number,
 *   adherencePercent: number
 * }}
 */
export function computeWeeklySummary(
  weightEntries,
  foodLogEntries,
  trainingDays,
  weekStartDate
) {
  const weekStart = new Date(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Filter entries for this week
  const weekWeights = (weightEntries || []).filter(w => {
    const wDate = new Date(w.date);
    return wDate >= weekStart && wDate <= weekEnd;
  });

  const weekFood = (foodLogEntries || []).filter(f => {
    const fDate = new Date(f.date);
    return fDate >= weekStart && fDate <= weekEnd;
  });

  const weekTrainingDays = (trainingDays || []).filter(d => {
    const dDate = new Date(d);
    return dDate >= weekStart && dDate <= weekEnd;
  });

  // Calculate weight change
  let startWeight = 0;
  let endWeight = 0;
  if (weekWeights.length > 0) {
    startWeight = weekWeights[0].smoothed_weight;
    endWeight = weekWeights[weekWeights.length - 1].smoothed_weight;
  }

  // Calculate calorie and protein stats
  const totalCalories = weekFood.reduce((sum, f) => sum + (f.calories || 0), 0);
  const totalProtein = weekFood.reduce((sum, f) => sum + (f.protein_g || 0), 0);
  const daysLogged = new Set(weekFood.map(f => f.date)).size;

  const avgDailyCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0;
  const avgDailyProtein = daysLogged > 0 ? Math.round(totalProtein / daysLogged) : 0;

  return {
    weekStart: weekStartDate,
    weekEnd: weekEnd.toISOString().split('T')[0],
    startWeight: Math.round(startWeight * 10) / 10,
    endWeight: Math.round(endWeight * 10) / 10,
    weeklyChange: Math.round((endWeight - startWeight) * 10) / 10,
    avgDailyCalories,
    avgDailyProtein,
    daysLogged,
    trainingDaysCount: weekTrainingDays.length,
    adherencePercent: Math.round((daysLogged / 7) * 100),
  };
}

/**
 * Get smoothed weight at a specific date, interpolating if needed
 * @param {Array<{date: string, smoothed_weight: number}>} entries - Sorted by date
 * @param {string} date - Target date (YYYY-MM-DD)
 * @returns {number|null} Smoothed weight, or null if no nearby data
 */
export function getSmoothedWeightAt(entries, date) {
  if (!entries || entries.length === 0) return null;

  const targetDate = new Date(date);
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Find exact match
  const exact = sorted.find(e => e.date === date);
  if (exact) return exact.smoothed_weight;

  // Find surrounding entries for interpolation
  let before = null;
  let after = null;

  for (let i = 0; i < sorted.length; i++) {
    const entryDate = new Date(sorted[i].date);
    if (entryDate < targetDate) {
      before = sorted[i];
    } else if (entryDate > targetDate && !after) {
      after = sorted[i];
      break;
    }
  }

  // Linear interpolation between before and after
  if (before && after) {
    const beforeDate = new Date(before.date);
    const afterDate = new Date(after.date);
    const totalMs = afterDate - beforeDate;
    const elapsedMs = targetDate - beforeDate;
    const ratio = elapsedMs / totalMs;

    const beforeWeight = before.smoothed_weight;
    const afterWeight = after.smoothed_weight;

    return beforeWeight + (afterWeight - beforeWeight) * ratio;
  }

  // Return nearest if interpolation not possible
  if (before) return before.smoothed_weight;
  if (after) return after.smoothed_weight;

  return null;
}

/**
 * Sum calories across a date range
 * @param {Array<{date: string, calories: number}>} entries
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date inclusive (YYYY-MM-DD)
 * @returns {number} Total calories
 */
export function sumCalories(entries, startDate, endDate) {
  if (!entries) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setDate(end.getDate() + 1); // Make inclusive

  return entries
    .filter(e => {
      const eDate = new Date(e.date);
      return eDate >= start && eDate < end;
    })
    .reduce((sum, e) => sum + (e.calories || 0), 0);
}

/**
 * Count number of logged days in date range
 * @param {Array<{date: string}>} entries
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {number} Number of unique dates with entries
 */
export function countLoggedDays(entries, startDate, endDate) {
  if (!entries) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setDate(end.getDate() + 1); // Make inclusive

  const uniqueDates = new Set();

  entries.forEach(e => {
    const eDate = new Date(e.date);
    if (eDate >= start && eDate < end) {
      uniqueDates.add(e.date);
    }
  });

  return uniqueDates.size;
}

/**
 * Calculate number of days between two dates
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {number} Number of days difference
 */
export function daysBetween(date1, date2) {
  const d1 = typeof date1 === 'string' ? new Date(date1) : new Date(date1);
  const d2 = typeof date2 === 'string' ? new Date(date2) : new Date(date2);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = Math.abs(d2 - d1);

  return Math.round(diffMs / msPerDay);
}
