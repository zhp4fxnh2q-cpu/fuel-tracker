import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getFoodLog, getFoodLogRange, getAlgorithmState } from '../lib/db';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import FlameIcon from './FlameIcon';

export default function Trends() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; }, []);

  const algorithmState = useLiveQuery(() => getAlgorithmState());
  const foodEntries = useLiveQuery(() => getFoodLogRange(thirtyDaysAgo, today), [thirtyDaysAgo, today]);
  const weightEntries = useLiveQuery(() => db.weightEntries.where('date').between(thirtyDaysAgo, today, true, true).sortBy('date'), [thirtyDaysAgo, today]);

  const tdee = algorithmState?.tdee || 2400;

  // Energy balance chart data
  const energyData = useMemo(() => {
    if (!foodEntries) return [];
    const byDate = {};
    foodEntries.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = 0;
      byDate[e.date] += e.calories || 0;
    });
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      data.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        calories: byDate[ds] || 0,
        logged: !!byDate[ds],
      });
    }
    return data;
  }, [foodEntries]);

  // Weekly summaries
  const weeklySummaries = useMemo(() => {
    if (!foodEntries || !weightEntries) return [];
    const weeks = [];
    for (let w = 7; w >= 0; w--) {
      const end = new Date(); end.setDate(end.getDate() - w * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const weekFood = foodEntries.filter(e => e.date >= startStr && e.date <= endStr);
      const weekWeight = weightEntries.filter(e => e.date >= startStr && e.date <= endStr);

      const byDate = {};
      weekFood.forEach(e => { if (!byDate[e.date]) byDate[e.date] = { cal: 0, pro: 0 }; byDate[e.date].cal += e.calories || 0; byDate[e.date].pro += e.protein_g || 0; });
      const daysLogged = Object.keys(byDate).length;
      const totalCal = Object.values(byDate).reduce((s, v) => s + v.cal, 0);
      const totalPro = Object.values(byDate).reduce((s, v) => s + v.pro, 0);

      const avgWeight = weekWeight.length > 0 ? weekWeight.reduce((s, e) => s + e.weight_lbs, 0) / weekWeight.length : null;

      weeks.push({
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        avgCalories: daysLogged > 0 ? Math.round(totalCal / daysLogged) : 0,
        avgProtein: daysLogged > 0 ? Math.round(totalPro / daysLogged) : 0,
        avgWeight: avgWeight ? Math.round(avgWeight * 10) / 10 : null,
        daysLogged,
      });
    }
    // Add week-over-week weight change
    for (let i = 1; i < weeks.length; i++) {
      if (weeks[i].avgWeight && weeks[i - 1].avgWeight) {
        weeks[i].weightChange = Math.round((weeks[i].avgWeight - weeks[i - 1].avgWeight) * 10) / 10;
      }
    }
    return weeks;
  }, [foodEntries, weightEntries]);

  // Phase info
  const phaseLabel = { cut: 'Cutting', maintenance: 'Maintenance', diet_break: 'Diet Break' };
  const daysInPhase = algorithmState?.phaseStartDate
    ? Math.round((Date.now() - new Date(algorithmState.phaseStartDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="safe-top" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="px-6 py-8 space-y-6 w-full">
        <h2 className="text-2xl font-700" style={{ color: 'var(--text-primary)' }}>Trends & Insights</h2>

        {/* Energy Balance Chart */}
        <div className="card card-lg">
          <div className="text-label mb-4" style={{ color: 'var(--text-secondary)' }}>
            Daily Calories — 30 Days
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={energyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(48,54,61,0.5)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#484F58' }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: '#484F58' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1C2128', border: '1px solid #30363D', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#F0F6FC' }}
                  itemStyle={{ color: '#F0883E' }}
                />
                <ReferenceLine y={tdee} stroke="#58A6FF" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: `TDEE ${tdee}`, fill: '#58A6FF', fontSize: 10, position: 'right' }} />
                <Bar dataKey="calories" fill="#F0883E" radius={[3, 3, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Averages */}
        <div className="card card-lg">
          <div className="text-label mb-4" style={{ color: 'var(--text-secondary)' }}>
            Weekly Averages
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--text-tertiary)' }}>
                  <th className="text-left py-2 pr-3 font-medium">Week</th>
                  <th className="text-right py-2 px-2 font-medium">Cals</th>
                  <th className="text-right py-2 px-2 font-medium">Protein</th>
                  <th className="text-right py-2 px-2 font-medium">Weight</th>
                  <th className="text-right py-2 px-2 font-medium">Δ</th>
                  <th className="text-right py-2 pl-2 font-medium">Days</th>
                </tr>
              </thead>
              <tbody>
                {weeklySummaries.map((w, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(48,54,61,0.5)' }}>
                    <td className="py-2 pr-3" style={{ color: 'var(--text-secondary)' }}>{w.label}</td>
                    <td className="text-right py-2 px-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{w.avgCalories || '—'}</td>
                    <td className="text-right py-2 px-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--macro-protein)' }}>{w.avgProtein || '—'}g</td>
                    <td className="text-right py-2 px-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{w.avgWeight || '—'}</td>
                    <td className="text-right py-2 px-2" style={{
                      fontFamily: 'var(--font-mono)',
                      color: w.weightChange < 0 ? 'var(--accent-primary)' : w.weightChange > 0 ? 'var(--accent-warm)' : 'var(--text-tertiary)'
                    }}>
                      {w.weightChange != null ? `${w.weightChange > 0 ? '+' : ''}${w.weightChange}` : '—'}
                    </td>
                    <td className="text-right py-2 pl-2" style={{ color: 'var(--text-tertiary)' }}>{w.daysLogged}/7</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Algorithm Status */}
        <div className="card card-lg">
          <div className="text-label mb-4" style={{ color: 'var(--text-secondary)' }}>
            Algorithm Status
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Estimated TDEE</span>
              <span className="font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>{tdee} kcal</span>
            </div>
            <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Phase</span>
              <span className="font-semibold">{phaseLabel[algorithmState?.phase] || 'Cutting'}</span>
            </div>
            <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Days in Phase</span>
              <span className="font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>{daysInPhase}</span>
            </div>
            <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Data Days</span>
              <span className="font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>{algorithmState?.daysOfData || 0}</span>
            </div>
          </div>
        </div>

        {/* Coaching Card */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(240, 136, 62, 0.2)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <FlameIcon size={16} simplified />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-warm)', letterSpacing: '0.04em' }}>
              Weekly Insight
            </span>
          </div>
          <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            Log at least 2-3 weeks of data for personalized weekly coaching insights powered by FUEL AI.
          </div>
          <button className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'linear-gradient(135deg, #F0983E, #E07020)', color: '#fff', border: 'none' }}>
            Generate Summary
          </button>
          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs" style={{ backgroundColor: 'rgba(240, 136, 62, 0.08)', color: 'var(--accent-warm)' }}>
              Powered by FUEL AI
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
