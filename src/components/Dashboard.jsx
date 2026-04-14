import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getDailyTotals, getSetting, isTrainingDay as checkTrainingDay, setTrainingDay } from '../lib/db';
import ProgressRing from './ProgressRing';
import WeightChart from './WeightChart';
import FlameIcon from './FlameIcon';

const TODAY = () => new Date().toISOString().split('T')[0];

function formatDate(date) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function Dashboard({ onNavigate }) {
  const [todayStr] = useState(TODAY);
  const [trainingDay, setTrainingDay] = useState(false);
  const [calorieTarget, setCalorieTarget] = useState(2150);
  const [proteinTarget, setProteinTarget] = useState(200);
  const [totals, setTotals] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  // Load settings & training day status
  useEffect(() => {
    (async () => {
      const isTD = await checkTrainingDay(todayStr);
      setTrainingDay(isTD);

      const tdCal = await getSetting('trainingDayCalories');
      const rdCal = await getSetting('restDayCalories');
      const pTarget = await getSetting('dailyProteinTarget');

      if (isTD && tdCal) setCalorieTarget(Number(tdCal));
      else if (!isTD && rdCal) setCalorieTarget(Number(rdCal));
      else setCalorieTarget(isTD ? 2650 : 2150);

      if (pTarget) setProteinTarget(Number(pTarget));
    })();
  }, [todayStr]);

  // Live food log for today — recompute totals when entries change
  const foodEntries = useLiveQuery(
    () => db.foodLog.where('date').equals(todayStr).toArray(),
    [todayStr]
  );

  useEffect(() => {
    if (!foodEntries) return;
    const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    foodEntries.forEach(e => {
      t.calories += e.calories || 0;
      t.protein_g += e.protein_g || 0;
      t.carbs_g += e.carbs_g || 0;
      t.fat_g += e.fat_g || 0;
    });
    setTotals(t);
  }, [foodEntries]);

  // Weight entries for mini chart (last 14 days)
  const fourteenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  }, []);

  const weightEntries = useLiveQuery(
    () => db.weightEntries.where('date').between(fourteenDaysAgo, todayStr, true, true).sortBy('date'),
    [fourteenDaysAgo, todayStr]
  );

  // This week's stats
  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const weekFoodEntries = useLiveQuery(
    () => db.foodLog.where('date').between(sevenDaysAgo, todayStr, true, true).toArray(),
    [sevenDaysAgo, todayStr]
  );

  const weekStats = useMemo(() => {
    if (!weekFoodEntries || weekFoodEntries.length === 0) return null;
    const byDate = {};
    weekFoodEntries.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = 0;
      byDate[e.date] += e.calories || 0;
    });
    const days = Object.keys(byDate);
    const totalCals = Object.values(byDate).reduce((s, v) => s + v, 0);
    return {
      daysLogged: days.length,
      avgCalories: Math.round(totalCals / days.length),
    };
  }, [weekFoodEntries]);

  // Weight trend
  const weightTrend = useMemo(() => {
    if (!weightEntries || weightEntries.length < 2) return null;
    const first = weightEntries[0];
    const last = weightEntries[weightEntries.length - 1];
    const current = last.smoothed_weight || last.weight_lbs;
    const prev = first.smoothed_weight || first.weight_lbs;
    return {
      current: current,
      change: current - prev,
    };
  }, [weightEntries]);

  const hasLoggedToday = totals.calories > 0;
  const proteinPct = proteinTarget > 0 ? Math.min((totals.protein_g / proteinTarget) * 100, 100) : 0;

  const handleToggleTrainingDay = async () => {
    const newValue = !trainingDay;
    setTrainingDay(newValue);

    // Save to training days table
    await db.trainingDays.put({
      date: todayStr,
      trained: newValue,
      created_at: new Date().toISOString(),
      synced: 0,
    });

    // Recalculate calorie target
    const tdCal = await getSetting('trainingDayCalories');
    const rdCal = await getSetting('restDayCalories');
    const newTarget = newValue
      ? (Number(tdCal) || 2650)
      : (Number(rdCal) || 2150);
    setCalorieTarget(newTarget);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 safe-top" style={{
        backgroundColor: 'rgba(13, 17, 23, 0.95)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div className="px-6 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <FlameIcon size={26} simplified />
            <h1
              className="text-xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #F5B84A, #E07020)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '0.06em',
              }}
            >
              FUEL
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-500" style={{ color: 'var(--text-secondary)' }}>{formatDate(todayStr)}</span>
            <button
              onClick={handleToggleTrainingDay}
              className="px-3 py-1.5 rounded-full text-xs font-600 transition-all active:scale-95"
              style={{
                backgroundColor: trainingDay ? 'rgba(88, 166, 255, 0.12)' : 'rgba(139, 148, 158, 0.1)',
                color: trainingDay ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {trainingDay ? 'Training Day' : 'Rest Day'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-6 w-full">
        {/* Calorie Progress Ring */}
        <div className="flex justify-center py-4">
          <ProgressRing
            value={Math.round(totals.calories)}
            max={calorieTarget}
            size={200}
            strokeWidth={12}
            color="var(--accent-primary)"
            label="kcal"
          />
        </div>

        {/* Protein Bar */}
        <div className="card card-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-label" style={{ color: 'var(--text-secondary)' }}>Protein</span>
            <span className="text-sm font-600 mono" style={{ color: 'var(--macro-protein)', fontFamily: 'var(--font-mono)' }}>
              {Math.round(totals.protein_g)}g <span style={{ color: 'var(--text-tertiary)' }}>/ {proteinTarget}g</span>
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(165, 214, 255, 0.08)' }}>
            <div className="h-full rounded-full transition-all duration-500 ease-out" style={{
              width: `${proteinPct}%`,
              background: 'linear-gradient(90deg, var(--macro-protein), var(--accent-secondary))',
            }} />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card card-lg">
            <div className="text-label mb-3" style={{ color: 'var(--text-secondary)' }}>This Week</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-700 mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {weekStats?.avgCalories ?? '—'}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>kcal avg</span>
            </div>
            <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
              {weekStats?.daysLogged ?? 0} days logged
            </div>
          </div>

          <div className="card card-lg">
            <div className="text-label mb-3" style={{ color: 'var(--text-secondary)' }}>Weight Trend</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-700 mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {weightTrend ? weightTrend.current.toFixed(1) : '—'}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>lbs</span>
            </div>
            <div className="text-xs mt-2" style={{
              color: weightTrend?.change < 0 ? 'var(--accent-primary)' : 'var(--text-tertiary)',
            }}>
              {weightTrend ? `${weightTrend.change > 0 ? '+' : ''}${weightTrend.change.toFixed(1)} lbs` : '—'}
            </div>
          </div>
        </div>

        {/* Weight Mini Chart */}
        {weightEntries && weightEntries.length > 1 && (
          <div>
            <div className="text-label mb-4" style={{ color: 'var(--text-secondary)' }}>
              Weight Trend — 14 Days
            </div>
            <div className="card">
              <WeightChart entries={weightEntries} days={14} />
            </div>
          </div>
        )}

        {/* Macro Breakdown */}
        {hasLoggedToday && (
          <div className="card card-lg">
            <div className="text-label mb-4" style={{ color: 'var(--text-secondary)' }}>
              Today's Macros
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-700 mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--macro-protein)' }}>
                  {Math.round(totals.protein_g)}g
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Protein</div>
              </div>
              <div>
                <div className="text-xl font-700 mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--macro-carbs)' }}>
                  {Math.round(totals.carbs_g)}g
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Carbs</div>
              </div>
              <div>
                <div className="text-xl font-700 mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--macro-fat)' }}>
                  {Math.round(totals.fat_g)}g
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Fat</div>
              </div>
            </div>
          </div>
        )}

        {/* Gentle Prompt */}
        {!hasLoggedToday && (
          <div className="card card-lg text-center" style={{
            backgroundColor: 'rgba(240, 136, 62, 0.04)',
            borderColor: 'rgba(240, 136, 62, 0.12)',
          }}>
            <div style={{ padding: '8px 0 16px' }}>
              <FlameIcon size={48} opacity={0.15} simplified style={{ margin: '0 auto 20px' }} />
              <div className="text-sm font-500" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Ready to log today's meals?
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '28px' }}>
                Light the flame — start tracking your fuel
              </div>
              <button
                onClick={() => onNavigate?.('foodlog')}
                style={{
                  background: 'linear-gradient(135deg, #F0983E, #E07020)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 48px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'transform 150ms ease',
                  marginBottom: '8px',
                }}
              >
                Start Logging
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
