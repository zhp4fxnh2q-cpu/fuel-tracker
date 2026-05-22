/**
 * FUEL — Adaptive TDEE algorithm.
 * Pure functions, zero UI deps. All inputs imperial (lbs).
 *
 * Building blocks:
 *   updateSmoothedWeight()    — EWMA weight smoothing
 *   formulaTDEE()             — Mifflin-St Jeor cold-start
 *   backSolveTDEE()           — actual TDEE from 14-day weight + intake history
 *   blendedTDEE()             — formula→data ramp during cold start
 *   confidenceScore()         — low | medium | high based on data quality
 *   makeDailyTargets()        — split TDEE into training/rest day kcal + macros
 *   weeklyReview()            — Sunday adjustment with ±200 kcal cap and floors
 *   intradayRebalance()       — smart rebalance with floors (David's choice)
 *   checkDietBreakNeeded()    — diet-break prompt after 8 weeks cutting
 */
import {
  EWMA_ALPHA,
  KCAL_PER_LB,
  REVIEW_WINDOW_DAYS,
  MIN_DAYS_FOR_TDEE,
  COLD_START_DAYS,
  TRAINING_DAY_BONUS,
  MAX_WEEKLY_KCAL_CHANGE,
  DIET_BREAK_AFTER_WEEKS,
  PHASE,
} from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// EWMA weight smoothing
// ─────────────────────────────────────────────────────────────────────────────

/** Exponentially weighted moving average for daily weight. */
export function updateSmoothedWeight(rawToday, smoothedYesterday, alpha = EWMA_ALPHA) {
  if (smoothedYesterday == null || Number.isNaN(smoothedYesterday)) return rawToday;
  return alpha * rawToday + (1 - alpha) * smoothedYesterday;
}

/** Initialize the EWMA series from the first ≤7 raw weights using a simple mean. */
export function seedSmoothedSeries(rawWeights) {
  if (!rawWeights || rawWeights.length === 0) return [];
  const sorted = [...rawWeights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const out = [];
  const seedWindow = Math.min(7, sorted.length);
  const seedMean = sorted.slice(0, seedWindow).reduce((s, w) => s + w.weight_lbs, 0) / seedWindow;
  let prev = seedMean;
  for (const w of sorted) {
    const trended = updateSmoothedWeight(w.weight_lbs, prev);
    out.push({ ...w, trended_lbs: round1(trended) });
    prev = trended;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formula TDEE (Mifflin-St Jeor) — cold start before back-solve has enough data
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extreme: 1.9,
};

export function formulaTDEE({ weight_lbs, height_in, age, sex = 'male', activity_level = 'moderate' }) {
  const wKg = weight_lbs * 0.453592;
  const hCm = height_in * 2.54;
  const bmr =
    sex.toLowerCase() === 'female'
      ? 10 * wKg + 6.25 * hCm - 5 * age - 161
      : 10 * wKg + 6.25 * hCm - 5 * age + 5;
  const factor = ACTIVITY_FACTORS[activity_level] ?? ACTIVITY_FACTORS.moderate;
  return Math.round(bmr * factor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Back-solve TDEE from real history
//   estimated_tdee = avg_daily_kcal − (Δtrended_lbs × 3500 / days)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param weightTrend  [{date, trended_lbs}]  — sorted ascending, must span ≥REVIEW_WINDOW_DAYS
 * @param dailyKcal    [{date, kcal}]         — daily totals
 * @param windowDays   default 14
 */
export function backSolveTDEE(weightTrend, dailyKcal, windowDays = REVIEW_WINDOW_DAYS) {
  if (!weightTrend || weightTrend.length < 2) return null;
  if (!dailyKcal) return null;
  const sortedTrend = [...weightTrend].sort((a, b) => (a.date < b.date ? -1 : 1));

  const endDate = sortedTrend[sortedTrend.length - 1].date;
  const startDate = isoDaysAgo(endDate, windowDays);

  const trendInWindow = sortedTrend.filter((w) => w.date >= startDate && w.date <= endDate);
  if (trendInWindow.length < 2) return null;

  const kcalInWindow = dailyKcal.filter((k) => k.date >= startDate && k.date <= endDate);
  if (kcalInWindow.length < MIN_DAYS_FOR_TDEE) return null;

  const startTrend = trendInWindow[0].trended_lbs;
  const endTrend = trendInWindow[trendInWindow.length - 1].trended_lbs;
  const daysElapsed = daysBetween(trendInWindow[0].date, trendInWindow[trendInWindow.length - 1].date) || 1;

  const totalKcal = kcalInWindow.reduce((s, k) => s + (k.kcal || 0), 0);
  const avgDailyKcal = totalKcal / kcalInWindow.length;

  const deltaLbs = endTrend - startTrend;
  const dailyEnergyBalance = (deltaLbs * KCAL_PER_LB) / daysElapsed; // +500 = surplus

  return Math.round(avgDailyKcal - dailyEnergyBalance);
}

/** Cold-start blend between formula and data-driven estimates. */
export function blendedTDEE(formula, dataDriven, daysOfData) {
  if (!dataDriven) return formula;
  if (daysOfData >= COLD_START_DAYS) return dataDriven;
  const w = daysOfData / COLD_START_DAYS;
  return Math.round(formula * (1 - w) + dataDriven * w);
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence: low | medium | high
// ─────────────────────────────────────────────────────────────────────────────

export function confidenceScore({ daysOfData, complianceRate, weeklyVarianceLbs }) {
  if (daysOfData < 14 || complianceRate < 0.8) return 'low';
  if (daysOfData < 28 || complianceRate < 0.95) return 'medium';
  if (weeklyVarianceLbs != null && weeklyVarianceLbs > 1.0) return 'medium';
  return 'high';
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily targets — split TDEE into training/rest with floors and macro hierarchy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param tdee            estimated TDEE (kcal/day average)
 * @param goalDeficitKcal positive number; subtracted to set base
 * @param trainingDays    days/week (default 4)
 * @param targets         settings.targets — has floors + protein/fat per-lb
 * @param weight_lbs      current bodyweight
 */
export function makeDailyTargets({ tdee, goalDeficitKcal = 0, trainingDays = 4, targets, weight_lbs }) {
  const base = tdee - goalDeficitKcal;
  let trainingKcal = base + TRAINING_DAY_BONUS;
  let restKcal = base - (TRAINING_DAY_BONUS * trainingDays) / Math.max(1, 7 - trainingDays);

  // Calorie floor on training days
  trainingKcal = Math.max(trainingKcal, targets.calorie_floor);
  restKcal = Math.max(restKcal, targets.calorie_floor - 400); // rest day floor: 400 below training

  // Macro hierarchy: protein floor → fat floor → carbs absorb the rest
  const proteinG = Math.round(weight_lbs * targets.protein_g_per_lb);
  const fatG = Math.round(weight_lbs * targets.fat_g_per_lb);
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;

  const carbsTrainingKcal = trainingKcal - proteinKcal - fatKcal;
  const carbsRestKcal = restKcal - proteinKcal - fatKcal;

  let trainingCarbsG = Math.max(0, Math.round(carbsTrainingKcal / 4));
  let restCarbsG = Math.max(0, Math.round(carbsRestKcal / 4));

  // Carb floor warning on training days
  const carbWarning = trainingCarbsG < targets.training_carb_floor_g;

  return {
    training: {
      kcal: Math.round(trainingKcal),
      protein_g: proteinG,
      fat_g: fatG,
      carbs_g: trainingCarbsG,
    },
    rest: {
      kcal: Math.round(restKcal),
      protein_g: proteinG,
      fat_g: fatG,
      carbs_g: restCarbsG,
    },
    weekly_avg_kcal: Math.round(
      (trainingKcal * trainingDays + restKcal * (7 - trainingDays)) / 7
    ),
    carb_warning: carbWarning,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly review — runs Sunday morning, returns recommended new targets + reason
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param prev      { tdee_estimate, training_kcal, rest_kcal, phase, phase_start_date }
 * @param window    { weightTrend, dailyKcal, days_logged, target_rate_pct, profile, targets }
 */
export function weeklyReview(prev, window) {
  const { weightTrend, dailyKcal, target_rate_pct, profile, targets } = window;

  const newTDEE = backSolveTDEE(weightTrend, dailyKcal, REVIEW_WINDOW_DAYS);
  if (!newTDEE) {
    return {
      adjusted: false,
      reason: 'Not enough data yet — need at least 14 days of weight + food logging.',
      newTargets: null,
      newTDEE: prev.tdee_estimate,
    };
  }

  // Goal deficit derived from target rate (% bodyweight per week)
  const weeklyKcalDeficit = profile.weight_lbs * (target_rate_pct / 100) * KCAL_PER_LB;
  const dailyDeficit = profile.goal === 'cut' ? weeklyKcalDeficit / 7 : 0;

  const recommended = makeDailyTargets({
    tdee: newTDEE,
    goalDeficitKcal: dailyDeficit,
    trainingDays: profile.training_days_per_week,
    targets,
    weight_lbs: profile.weight_lbs,
  });

  // Cap weekly kcal change at ±200
  const cappedTraining = clampToCap(recommended.training.kcal, prev.training_kcal, MAX_WEEKLY_KCAL_CHANGE);
  const cappedRest = clampToCap(recommended.rest.kcal, prev.rest_kcal, MAX_WEEKLY_KCAL_CHANGE);

  const trainingDelta = cappedTraining - prev.training_kcal;
  const restDelta = cappedRest - prev.rest_kcal;

  const trendChange = round1(
    weightTrend[weightTrend.length - 1].trended_lbs - weightTrend[0].trended_lbs
  );
  const avgKcal = Math.round(dailyKcal.reduce((s, d) => s + (d.kcal || 0), 0) / dailyKcal.length);

  const reason = composeReasoning({
    trendChange,
    avgKcal,
    newTDEE,
    priorTDEE: prev.tdee_estimate,
    trainingDelta,
    restDelta,
    cap: MAX_WEEKLY_KCAL_CHANGE,
    carb_warning: recommended.carb_warning,
  });

  return {
    adjusted: trainingDelta !== 0 || restDelta !== 0,
    reason,
    trendChange,
    avgKcal,
    newTDEE,
    priorTDEE: prev.tdee_estimate,
    newTargets: {
      ...recommended,
      training: { ...recommended.training, kcal: cappedTraining },
      rest: { ...recommended.rest, kcal: cappedRest },
    },
  };
}

function composeReasoning({ trendChange, avgKcal, newTDEE, priorTDEE, trainingDelta, restDelta, cap, carb_warning }) {
  const dir = trendChange < 0 ? 'down' : trendChange > 0 ? 'up' : 'flat';
  const magnitude = Math.abs(trendChange);
  const tdeeShift = newTDEE - priorTDEE;
  const sentences = [];

  sentences.push(
    `Trended weight is ${dir}${dir === 'flat' ? '' : ` ${magnitude.toFixed(1)} lbs`} over the last 14 days, on an average intake of ${avgKcal} kcal/day.`
  );
  sentences.push(
    `That back-solves to a TDEE of ~${newTDEE} kcal (was ${priorTDEE}, shift of ${tdeeShift > 0 ? '+' : ''}${tdeeShift}).`
  );
  if (trainingDelta === 0 && restDelta === 0) {
    sentences.push('No adjustment recommended — current targets line up with your goal rate.');
  } else {
    const trainingPart = trainingDelta === 0 ? null : `training day ${trainingDelta > 0 ? '+' : ''}${trainingDelta} kcal`;
    const restPart = restDelta === 0 ? null : `rest day ${restDelta > 0 ? '+' : ''}${restDelta} kcal`;
    sentences.push(`Recommended adjustment: ${[trainingPart, restPart].filter(Boolean).join(', ')}.`);
    if (Math.abs(trainingDelta) === cap || Math.abs(restDelta) === cap) {
      sentences.push(`(Capped at ±${cap} kcal/week to keep things stable.)`);
    }
  }
  if (carb_warning) {
    sentences.push('Heads up: at this calorie level, training-day carbs would land below 100g. Consider a diet break before continuing the cut.');
  }
  return sentences.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Intra-day rebalance — David's choice: smart rebalance with floors
// If lunch overshoots by 200, dinner's recommended portions shrink by 200,
// but never below protein/fat/carb floors. If floors would break, no rebalance —
// surface the overshoot honestly and roll it into the weekly review.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param dayBudget    { kcal, protein_g, carbs_g, fat_g }  (today's training or rest target)
 * @param loggedSoFar  { kcal, protein_g, carbs_g, fat_g }  (sum of logged entries)
 * @param plannedRemaining  { kcal, protein_g, carbs_g, fat_g }  (sum of planned-but-unlogged)
 * @param floors       { protein_g_remaining, fat_g_remaining, carbs_g_remaining }
 * @returns { mode: 'rebalanced'|'unchanged'|'floor_violation', delta: kcal, recommended: {...} | null, reason }
 */
export function intradayRebalance({ dayBudget, loggedSoFar, plannedRemaining, floors }) {
  const remaining = {
    kcal: dayBudget.kcal - loggedSoFar.kcal,
    protein_g: dayBudget.protein_g - loggedSoFar.protein_g,
    carbs_g: dayBudget.carbs_g - loggedSoFar.carbs_g,
    fat_g: dayBudget.fat_g - loggedSoFar.fat_g,
  };

  const delta = remaining.kcal - plannedRemaining.kcal;
  if (Math.abs(delta) < 50) {
    return { mode: 'unchanged', delta, recommended: plannedRemaining, reason: 'On track — within ±50 kcal of plan.' };
  }

  // Scale carbs down/up first to absorb delta. Protein and fat held steady.
  // delta < 0 = overshoot; delta > 0 = undershoot
  const recommended = { ...plannedRemaining };
  const carbDeltaG = delta / 4;
  recommended.carbs_g = Math.max(0, Math.round(plannedRemaining.carbs_g + carbDeltaG));
  recommended.kcal = Math.round(
    recommended.protein_g * 4 + recommended.fat_g * 9 + recommended.carbs_g * 4
  );

  // Floor check on remaining macros after rebalance
  const wouldViolateProtein = remaining.protein_g - plannedRemaining.protein_g < 0 && plannedRemaining.protein_g < (floors?.protein_g_remaining || 0);
  const wouldViolateFat = remaining.fat_g - plannedRemaining.fat_g < 0 && plannedRemaining.fat_g < (floors?.fat_g_remaining || 0);
  const wouldViolateCarbs = recommended.carbs_g < (floors?.carbs_g_remaining || 0);

  if (wouldViolateProtein || wouldViolateFat || wouldViolateCarbs) {
    return {
      mode: 'floor_violation',
      delta,
      recommended: null,
      reason:
        delta < 0
          ? `You're ${Math.abs(Math.round(delta))} kcal over today. Eat the planned dinner — we'll absorb this in the weekly review.`
          : `You're ${Math.round(delta)} kcal under. Add a snack rather than oversize dinner past the floor.`,
    };
  }

  return {
    mode: 'rebalanced',
    delta,
    recommended,
    reason:
      delta < 0
        ? `Rebalanced: ${Math.abs(Math.round(delta))} kcal over earlier — dinner carbs reduced by ${Math.abs(Math.round(carbDeltaG))} g.`
        : `Rebalanced: ${Math.round(delta)} kcal under earlier — dinner carbs raised by ${Math.round(carbDeltaG)} g.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Diet break prompt
// ─────────────────────────────────────────────────────────────────────────────

export function checkDietBreakNeeded(phase, phaseStartDate) {
  if (phase !== PHASE.CUT) return { needed: false, weeks: 0 };
  const weeks = Math.floor(daysBetween(phaseStartDate, isoToday()) / 7);
  return {
    needed: weeks >= DIET_BREAK_AFTER_WEEKS,
    weeks,
    message:
      weeks >= DIET_BREAK_AFTER_WEEKS
        ? `${weeks} weeks in cut — consider a 7–14 day diet break to restore hormones and adherence.`
        : `${weeks} weeks into cut (${DIET_BREAK_AFTER_WEEKS - weeks} until break recommended).`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clampToCap(target, prior, cap) {
  if (target > prior + cap) return prior + cap;
  if (target < prior - cap) return prior - cap;
  return Math.round(target);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00Z');
  const b = new Date(isoB + 'T00:00:00Z');
  return Math.round(Math.abs(b - a) / 86400000);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}


// ─────────────────────────────────────────────────────────────────────────────
// Phase H — macro target derivation from preset
// ─────────────────────────────────────────────────────────────────────────────
//
// Given a daily calorie target and a preset, return {protein_g, fat_g, carbs_g}.
// Always respects the protein/fat floors that the algorithm uses elsewhere.
// 'custom' uses the explicit grams in customMacros; missing fields fall back
// to balanced rules so the user can edit one number at a time.

export function deriveMacroTargets(preset, kcal, weight_lbs, customMacros = null) {
  const P_per_lb_balanced = 1.0;
  const F_per_lb_balanced = 0.3;

  if (preset === 'keto') {
    const protein_g = Math.round(weight_lbs * 0.8);
    const carbs_g = 30;
    const remaining = kcal - protein_g * 4 - carbs_g * 4;
    const fat_g = Math.max(0, Math.round(remaining / 9));
    return { protein_g, fat_g, carbs_g, source: 'keto' };
  }
  if (preset === 'low_carb') {
    const protein_g = Math.round(weight_lbs * P_per_lb_balanced);
    // Carbs at ~20% kcal but capped at 100 g
    const carbs_g = Math.min(100, Math.round((kcal * 0.20) / 4));
    const remaining = kcal - protein_g * 4 - carbs_g * 4;
    const fat_g = Math.max(0, Math.round(remaining / 9));
    return { protein_g, fat_g, carbs_g, source: 'low_carb' };
  }
  if (preset === 'custom' && customMacros) {
    const protein_g = Number(customMacros.protein_g) || Math.round(weight_lbs * P_per_lb_balanced);
    const fat_g = Number(customMacros.fat_g) || Math.round(weight_lbs * F_per_lb_balanced);
    const carbs_g = Number(customMacros.carbs_g) || Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
    return { protein_g, fat_g, carbs_g, source: 'custom' };
  }
  // balanced (default)
  const protein_g = Math.round(weight_lbs * P_per_lb_balanced);
  const fat_g = Math.round(weight_lbs * F_per_lb_balanced);
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  return { protein_g, fat_g, carbs_g, source: 'balanced' };
}
