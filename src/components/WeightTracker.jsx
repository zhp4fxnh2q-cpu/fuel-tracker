import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWeightEntry, getSetting } from '../lib/db';
import WeightChart from './WeightChart';
import FlameIcon from './FlameIcon';

export default function WeightTracker() {
  const [showModal, setShowModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Last 30 days of weight data
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);

  const weightEntries = useLiveQuery(
    () => db.weightEntries.where('date').between(thirtyDaysAgo, today, true, true).sortBy('date'),
    [thirtyDaysAgo, today]
  );

  const startingWeight = useLiveQuery(() => getSetting('startingWeight'));
  const goalWeight = useLiveQuery(() => getSetting('goalWeight'));

  const todayEntry = useMemo(() => {
    return (weightEntries || []).find(w => w.date === today);
  }, [weightEntries, today]);

  // Current smoothed weight (latest entry's smoothed_weight)
  const currentSmoothed = useMemo(() => {
    if (!weightEntries || weightEntries.length === 0) return null;
    const last = weightEntries[weightEntries.length - 1];
    return last.smoothed_weight || last.weight_lbs;
  }, [weightEntries]);

  // Weekly stats
  const stats = useMemo(() => {
    if (!weightEntries || weightEntries.length < 2) return {};
    const entries = weightEntries;

    // This week avg vs last week
    const last7 = entries.slice(-7);
    const prev7 = entries.slice(-14, -7);
    const thisWeekAvg = last7.reduce((s, w) => s + w.weight_lbs, 0) / last7.length;
    const lastWeekAvg = prev7.length > 0 ? prev7.reduce((s, w) => s + w.weight_lbs, 0) / prev7.length : null;

    // Rate from 14-day trend
    const first = entries.length >= 14 ? entries[entries.length - 14] : entries[0];
    const last = entries[entries.length - 1];
    const daysBetween = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24);
    const weightChange = (last.smoothed_weight || last.weight_lbs) - (first.smoothed_weight || first.weight_lbs);
    const weeklyRate = daysBetween > 0 ? (weightChange / daysBetween) * 7 : 0;

    // Total lost
    const sw = Number(startingWeight) || 220;
    const totalLost = sw - (currentSmoothed || sw);

    // Days to goal
    const gw = Number(goalWeight);
    let daysToGoal = null;
    if (gw && weeklyRate < 0 && currentSmoothed) {
      const lbsToGo = currentSmoothed - gw;
      if (lbsToGo > 0) daysToGoal = Math.round((lbsToGo / Math.abs(weeklyRate)) * 7);
    }

    return {
      thisWeekAvg: Math.round(thisWeekAvg * 10) / 10,
      lastWeekAvg: lastWeekAvg ? Math.round(lastWeekAvg * 10) / 10 : null,
      weeklyRate: Math.round(weeklyRate * 100) / 100,
      totalLost: Math.round(totalLost * 10) / 10,
      daysToGoal,
    };
  }, [weightEntries, startingWeight, goalWeight, currentSmoothed]);

  const handleSave = async (e) => {
    e.preventDefault();
    const val = parseFloat(weightInput);
    if (!val || val < 50 || val > 500) return;
    setSaving(true);
    try {
      // If already logged today, delete old entry first
      if (todayEntry) {
        await db.weightEntries.delete(todayEntry.id);
      }
      await addWeightEntry({ date: today, weight_lbs: val });
      setWeightInput('');
      setShowModal(false);
    } catch (err) {
      console.error('Error saving weight:', err);
    }
    setSaving(false);
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 safe-top" style={{
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'rgba(13, 17, 23, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div className="px-6 py-6 text-center w-full">
          <div className="text-label" style={{ color: 'var(--text-secondary)' }}>
            Smoothed Trend
          </div>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {currentSmoothed ? currentSmoothed.toFixed(1) : '—'}
            </span>
            <span className="text-xl font-500" style={{ color: 'var(--text-secondary)' }}>lbs</span>
          </div>
          {todayEntry && (
            <div className="text-xs mt-2 font-500" style={{ color: 'var(--text-tertiary)' }}>
              Today: {todayEntry.weight_lbs} lbs (raw)
            </div>
          )}
        </div>
      </div>

      {/* Log Weight Button */}
      <div className="px-6 py-5 w-full flex justify-center">
        <button
          onClick={() => {
            if (todayEntry) setWeightInput(String(todayEntry.weight_lbs));
            setShowModal(true);
          }}
          className="px-10 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #F0983E, #E07020)',
            color: '#fff',
            border: 'none',
          }}
        >
          {todayEntry ? "Edit Today's Weight" : "Log Today's Weight"}
        </button>
      </div>

      {/* Chart */}
      <div className="px-6 py-6 w-full">
        {weightEntries && weightEntries.length > 1 ? (
          <div className="card">
            <WeightChart entries={weightEntries} days={30} />
          </div>
        ) : (
          <div className="text-center py-16">
            <FlameIcon size={48} opacity={0.15} simplified style={{ margin: '0 auto 16px' }} />
            <div className="text-sm font-500" style={{ color: 'var(--text-secondary)' }}>Log at least 2 days to see your trend chart</div>
            <div className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>Track the burn — watch your progress unfold</div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="px-6 pb-8 grid grid-cols-2 gap-4 w-full">
        <StatCard label="This Week vs Last"
          value={stats.lastWeekAvg ? `${(stats.thisWeekAvg - stats.lastWeekAvg) > 0 ? '+' : ''}${(stats.thisWeekAvg - stats.lastWeekAvg).toFixed(1)} lbs` : '—'}
          sub={stats.lastWeekAvg ? `${stats.lastWeekAvg} → ${stats.thisWeekAvg}` : 'Need more data'} />
        <StatCard label="Total Lost"
          value={stats.totalLost ? `${stats.totalLost > 0 ? '' : '+'}${(-stats.totalLost).toFixed(1)} lbs` : '—'}
          sub={`From ${Number(startingWeight) || 220} lbs`} />
        <StatCard label="Current Rate"
          value={stats.weeklyRate ? `${stats.weeklyRate.toFixed(2)} lbs/wk` : '—'}
          sub="14-day trend" />
        <StatCard label="Time to Goal"
          value={stats.daysToGoal ? `${Math.round(stats.daysToGoal / 7)} weeks` : '—'}
          sub={stats.daysToGoal ? `~${stats.daysToGoal} days` : (goalWeight ? 'Keep going' : 'Set goal in Settings')} />
      </div>

      {/* Log Modal */}
      {showModal && (
        <>
          <div onClick={() => { setShowModal(false); setWeightInput(''); }} className="fixed inset-0 z-40" style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }} />
          <div className="fixed bottom-0 left-0 right-0 rounded-t-3xl z-50 safe-bottom animate-slide-up" style={{
            backgroundColor: 'var(--bg-card)',
            boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4)',
          }}>
            <div className="flex justify-center pt-3 pb-2">
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--border)' }} />
            </div>
            <div className="px-6 py-4">
              <h3 className="text-lg font-600 mb-6" style={{ color: 'var(--text-primary)' }}>Log Weight</h3>
              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="text-label block mb-3" style={{ color: 'var(--text-secondary)' }}>Weight (lbs)</label>
                  <input type="number" value={weightInput} onChange={e => setWeightInput(e.target.value)}
                    placeholder="220.0" step="0.1" autoFocus
                    className="w-full py-3 text-center text-3xl mono"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', borderRadius: '0.75rem' }} />
                </div>
                <div className="flex gap-3 pb-4">
                  <button type="submit" disabled={saving || !weightInput}
                    className="flex-1 btn-primary disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => { setShowModal(false); setWeightInput(''); }}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card card-lg">
      <div className="text-label mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div className="text-lg font-700 mono mb-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-xs font-500" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>
    </div>
  );
}
