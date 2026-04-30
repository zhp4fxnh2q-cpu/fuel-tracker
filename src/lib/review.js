/**
 * FUEL — Weekly review orchestration.
 *
 * Runs the back-solve-TDEE algorithm against the last 14 days of weight +
 * food log, computes the proposed adjustment with the ±200 kcal/week cap
 * and the macro hierarchy floors, and persists three things on accept:
 *   1. fuel_weekly_reviews — audit row with prior + new + reasoning
 *   2. fuel_settings.algo_state — new tdee_estimate, last_review_date
 *   3. fuel_settings.targets — new training_kcal + rest_kcal + macros
 */
import { supabase, SHARED_USER_ID } from '../supabaseClient';
import { weeklyReview, confidenceScore } from './algorithm';
import { getDayEntries, sumDay } from './foodLog';
import { getAllWeightEntries, recomputeTrend } from './weight';
import { REVIEW_WINDOW_DAYS, MIN_DAYS_FOR_TDEE, KCAL_PER_LB } from './constants';

const REVIEWS_TABLE = 'fuel_weekly_reviews';
const SETTINGS_TABLE = 'fuel_settings';

/**
 * Build the review preview without persisting. Returns:
 *   { eligible, reason, preview: { trendChange, avgKcal, newTDEE, priorTDEE, newTargets, reasoning, confidence } }
 *
 * Eligible = enough data to run a real adjustment; otherwise the UI shows the
 * cold-start state with a count of days remaining.
 */
export async function previewReview(settings) {
  if (!settings) return { eligible: false, reason: 'No settings loaded.' };

  const { ok: w_ok, entries: weights } = await getAllWeightEntries();
  if (!w_ok) return { eligible: false, reason: 'Could not load weight history.' };

  const trended = recomputeTrend(weights || []);

  // Pull last 14 days of food logs (one query per day kept simple — could
  // be a single date-range query, but per-day caching is cheap).
  const today = new Date();
  const dailyKcal = [];
  let daysLogged = 0;
  for (let i = REVIEW_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const r = await getDayEntries(iso);
    if (r.ok && r.entries.length > 0) {
      const t = sumDay(r.entries);
      dailyKcal.push({ date: iso, kcal: t.kcal });
      daysLogged += 1;
    } else {
      dailyKcal.push({ date: iso, kcal: 0 });
    }
  }

  if (daysLogged < MIN_DAYS_FOR_TDEE) {
    return {
      eligible: false,
      reason: `Need ${MIN_DAYS_FOR_TDEE} days of logged food in the last ${REVIEW_WINDOW_DAYS} days. Have ${daysLogged}.`,
      daysLogged,
    };
  }
  if (!trended || trended.length < 2) {
    return { eligible: false, reason: 'Need at least two weight entries.' };
  }

  // Trim trended to entries within the window
  const startIso = dailyKcal[0].date;
  const endIso = dailyKcal[dailyKcal.length - 1].date;
  const weightTrend = trended
    .filter((w) => w.date >= startIso && w.date <= endIso)
    .map((w) => ({ date: w.date, trended_lbs: w.trended_lbs }));
  if (weightTrend.length < 2) {
    return { eligible: false, reason: 'Need weight readings spanning the review window.' };
  }

  const algo = settings.algo_state || {};
  const profile = settings.profile || {};
  const targets = settings.targets || {};

  const result = weeklyReview(
    {
      tdee_estimate: algo.tdee_estimate || 2400,
      training_kcal: targets.training_kcal || 2650,
      rest_kcal: targets.rest_kcal || 2150,
      phase: algo.phase || 'cutting',
      phase_start_date: algo.phase_start_date,
    },
    {
      weightTrend,
      dailyKcal: dailyKcal.filter((d) => d.kcal > 0),
      target_rate_pct: profile.target_rate_pct || 0.625,
      profile,
      targets,
    }
  );

  // Compliance + confidence
  const complianceRate = daysLogged / REVIEW_WINDOW_DAYS;
  const variance = stddev(weightTrend.map((w) => w.trended_lbs));
  const confidence = confidenceScore({
    daysOfData: trended.length,
    complianceRate,
    weeklyVarianceLbs: variance,
  });

  return {
    eligible: true,
    daysLogged,
    complianceRate,
    confidence,
    preview: {
      trendChange: result.trendChange,
      avgKcal: result.avgKcal,
      newTDEE: result.newTDEE,
      priorTDEE: algo.tdee_estimate || 2400,
      priorTrainingKcal: targets.training_kcal || 2650,
      priorRestKcal: targets.rest_kcal || 2150,
      newTargets: result.newTargets,
      reasoning: result.reason,
      adjusted: result.adjusted,
    },
  };
}

/**
 * Persist the proposed review. Three actions:
 *   accept — apply newTargets, advance algo_state.tdee_estimate, write audit row
 *   skip   — write audit row with reasoning '(skipped)', no targets change
 *   diet_break — flip phase to diet_break, set targets to maintenance
 */
export async function commitReview({ settings, preview, action, aiSummary = null }) {
  const today = new Date().toISOString().slice(0, 10);
  const newAlgoState = { ...(settings.algo_state || {}), last_review_date: today };
  let newTargets = { ...(settings.targets || {}) };
  let reasoning = preview.reasoning;

  if (action === 'accept') {
    newTargets.training_kcal = preview.newTargets.training.kcal;
    newTargets.rest_kcal = preview.newTargets.rest.kcal;
    newTargets.weekly_cal_budget = preview.newTargets.weekly_avg_kcal * 7;
    newAlgoState.tdee_estimate = preview.newTDEE;
  } else if (action === 'skip') {
    reasoning = '(skipped) ' + reasoning;
  } else if (action === 'diet_break') {
    newAlgoState.phase = 'diet_break';
    newAlgoState.phase_start_date = today;
    newTargets.training_kcal = preview.newTDEE; // maintenance
    newTargets.rest_kcal = preview.newTDEE - 200;
    reasoning = '(diet break started) ' + reasoning;
  }

  // 1. Audit row
  await supabase.from(REVIEWS_TABLE).insert({
    user_id: SHARED_USER_ID,
    review_date: today,
    trended_weight_change_lbs: preview.trendChange,
    avg_daily_kcal: preview.avgKcal,
    estimated_tdee: preview.newTDEE,
    prior_tdee: preview.priorTDEE,
    prior_training_kcal: preview.priorTrainingKcal,
    prior_rest_kcal: preview.priorRestKcal,
    new_training_kcal: newTargets.training_kcal,
    new_rest_kcal: newTargets.rest_kcal,
    reasoning,
    ai_coaching_summary: aiSummary,
  });

  // 2. Update settings
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .update({
      targets: newTargets,
      algo_state: newAlgoState,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', SHARED_USER_ID);

  return {
    ok: !error,
    error,
    settings: { ...settings, targets: newTargets, algo_state: newAlgoState },
  };
}

/**
 * Should we auto-prompt the review? True if:
 *   - It's Sunday in the user's local time AND
 *   - last_review_date is null or older than today
 */
export function isReviewDue(settings) {
  if (!settings) return false;
  const algo = settings.algo_state || {};
  const today = new Date();
  if (today.getDay() !== 0) return false;
  const todayIso = today.toISOString().slice(0, 10);
  return !algo.last_review_date || algo.last_review_date < todayIso;
}

/** Recent reviews for the Trends tab. */
export async function getRecentReviews(limit = 8) {
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .eq('user_id', SHARED_USER_ID)
    .order('review_date', { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error, reviews: [] };
  return { ok: true, reviews: data || [] };
}

function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}
