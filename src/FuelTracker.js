/**
 * FUEL — main authenticated shell.
 * Phase 3: live food logging. Today screen pulls fuel_food_log + fuel_settings
 * and renders a real calorie ring, real macro bars, per-meal-slot sections,
 * and an "Add food" flow that hits USDA via the Pages Function.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TABS, DEFAULT_PROFILE, DEFAULT_TARGETS, DEFAULT_PREFERENCES } from './lib/constants';
import { fetchSettings, saveSettings, toggleFavorite, isFavorited } from './lib/db';
import { getDayEntries, deleteEntry, sumDay, groupBySlot, todayIso } from './lib/foodLog';
import CalorieRing from './components/CalorieRing';
import WeightChart from './components/WeightChart';
import { getWeightEntries, addOrUpdateWeight, computeStats, recomputeTrend } from './lib/weight';
import { saveMeal as saveMealApi } from './lib/savedMeals';
import WeeklyReviewModal from './components/WeeklyReviewModal';
import EnergyBalanceChart from './components/EnergyBalanceChart';
import { isReviewDue, getRecentReviews } from './lib/review';
import { checkDietBreakNeeded, deriveMacroTargets } from './lib/algorithm';
import { MACRO_PRESETS } from './lib/constants';
import { fetchMealPlannerRow, resolveTodaysSlots } from './lib/mealPlanner';
import AddFoodSheet from './components/AddFoodSheet';
import PotTracker from './components/PotTracker';
import PlannedMealBlock from './components/PlannedMealBlock';
import DescribeMealSheet from './components/DescribeMealSheet';

export default function FuelTracker({ session, onSignOut }) {
  const [activeTab, setActiveTab] = useState('today');
  const [settings, setSettings] = useState(null);
  const [missingTable, setMissingTable] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [potOpen, setPotOpen] = useState(false);
  const [potSlot, setPotSlot] = useState('Lunch');
  const [describeOpen, setDescribeOpen] = useState(false);
  const [describeSlot, setDescribeSlot] = useState('Lunch');
  const [addSlot, setAddSlot] = useState('Breakfast');
  const [addPrefill, setAddPrefill] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [planSlots, setPlanSlots] = useState([]);

  const refreshDay = useCallback(async () => {
    const r = await getDayEntries(todayIso());
    if (r.ok) setEntries(r.entries);
  }, []);

  // Initial load: settings + day entries
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const s = await fetchSettings();
      if (cancelled) return;
      if (s.missingTable) {
        setMissingTable(true);
        setLoading(false);
        return;
      }
      if (s.ok) {
        setSettings(s.settings);
        if (isReviewDue(s.settings)) setReviewOpen(true);
      }
      // Pull meal planner plan (best-effort; fails silently if the row is empty)
      const mp = await fetchMealPlannerRow();
      if (!cancelled && mp.ok) {
        setPlanSlots(resolveTodaysSlots(mp.plan, mp.custom_meals));
      }
      const d = await getDayEntries(todayIso());
      if (cancelled) return;
      if (d.ok) setEntries(d.entries);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const onAddFood = (slot, prefill = '') => {
    setAddSlot(slot);
    setAddPrefill(prefill);
    setAddOpen(true);
  };

  const onLogged = async () => {
    await refreshDay();
  };

  return (
    <div className="fuel-app">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="fuel-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>
      </svg>
      <main className="fuel-page">
        <Header session={session} onSignOut={onSignOut} settings={settings} />
        {missingTable && <MissingTableCard />}
        {!missingTable && activeTab === 'today' && (
          <TodayScreen
            settings={settings}
            entries={entries}
            loading={loading}
            planSlots={planSlots}
            onAddFood={onAddFood}
            onOpenPot={(slot) => { setPotSlot(slot || 'Lunch'); setPotOpen(true); }}
            onOpenDescribe={(slot) => { setDescribeSlot(slot || 'Lunch'); setDescribeOpen(true); }}
            onDelete={async (id) => {
              await deleteEntry(id);
              refreshDay();
            }}
            onToggleFavorite={async (sig) => {
              if (!settings) return;
              const r = await toggleFavorite(settings, sig);
              if (r.ok) {
                setSettings({
                  ...settings,
                  preferences: { ...(settings.preferences || {}), favorites: r.favorites },
                });
              }
            }}
            onAfterLogAll={refreshDay}
          />
        )}
        {activeTab === 'log' && <LogScreen onAddFood={onAddFood} settings={settings} />}
        {activeTab === 'weight' && <WeightScreen settings={settings} />}
        {activeTab === 'trends' && <TrendsScreen settings={settings} onOpenReview={() => setReviewOpen(true)} />}
        {activeTab === 'settings' && (
          <SettingsScreen
            onSignOut={onSignOut}
            settings={settings}
            missingTable={missingTable}
            onPrefChange={async (key, value) => {
              const next = {
                ...(settings || {}),
                preferences: { ...((settings || {}).preferences || {}), [key]: value },
              };
              const r = await saveSettings(next);
              if (r.ok) setSettings(next);
            }}
            onSettingsSaved={(s) => setSettings(s)}
          />
        )}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      <AddFoodSheet
        open={addOpen}
        mealSlot={addSlot}
        prefill={addPrefill}
        onClose={() => setAddOpen(false)}
        onLogged={onLogged}
        settings={settings}
      />
      <PotTracker
        open={potOpen}
        mealSlot={potSlot}
        onClose={() => setPotOpen(false)}
        onLogged={() => { setPotOpen(false); refreshDay(); }}
      />
      <DescribeMealSheet
        open={describeOpen}
        mealSlot={describeSlot}
        onClose={() => setDescribeOpen(false)}
        onLogged={() => { setDescribeOpen(false); refreshDay(); }}
      />
      <WeeklyReviewModal
        open={reviewOpen}
        settings={settings}
        onClose={() => setReviewOpen(false)}
        onCommitted={(s) => { setSettings(s); setReviewOpen(false); }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

function Header({ session, onSignOut, settings }) {
  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }, []);
  const profile = settings?.profile;
  const goal = profile?.goal;
  const presetKey = settings?.preferences?.macro_preset || 'balanced';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 12, marginBottom: 16, gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div className="fuel-page-title">{dateLabel}</div>
        <div className="fuel-mark" style={{ fontSize: 28, marginTop: 2 }}>FUEL</div>
        {profile && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {goal && <span className="fuel-chip">{goal.toUpperCase()}</span>}
            <span className="fuel-chip">{presetKey.replace('_',' ').toUpperCase()}</span>
            <span className="fuel-chip-muted">{profile.weight_lbs} lb</span>
          </div>
        )}
      </div>
      <button
        onClick={onSignOut}
        className="fuel-btn fuel-btn-ghost"
        style={{ fontSize: 11, padding: '6px 10px', letterSpacing: '0.08em', flexShrink: 0 }}
        title={session?.user?.email || ''}
      >
        SIGN OUT
      </button>
    </div>
  );
}

function MissingTableCard() {
  return (
    <div className="fuel-card" style={{ borderColor: 'rgba(245,158,11,0.32)', background: 'var(--warn-fill)' }}>
      <div className="fuel-label" style={{ color: 'var(--warn)' }}>Database setup needed</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
        FUEL is connected to Supabase but the <code>fuel_*</code> tables haven't been created yet.
        Run <code>migrations/0001_fuel_initial.sql</code> in the Supabase SQL editor, then reload.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Today (live)
// ─────────────────────────────────────────────────────────────────────────────

function TodayScreen({ settings, entries, loading, planSlots, onAddFood, onDelete, onToggleFavorite, onAfterLogAll, onOpenPot, onOpenDescribe }) {
  const profile = settings?.profile || DEFAULT_PROFILE;
  const targets = settings?.targets || DEFAULT_TARGETS;
  const prefs = settings?.preferences || DEFAULT_PREFERENCES;

  // Phase 3 simplification: assume training day (use training_kcal target).
  // Phase 6 will plug FORGE / training_day_overrides into this.
  const dayTarget = targets.training_kcal ?? 2650;
  const macroPreset = prefs.macro_preset || 'balanced';
  const customMacros = prefs.custom_macros || null;
  const macros = deriveMacroTargets(macroPreset, dayTarget, profile.weight_lbs, customMacros);
  const proteinTarget = macros.protein_g;
  const fatTarget = macros.fat_g;
  const carbsTarget = macros.carbs_g;

  const totals = sumDay(entries);
  const grouped = groupBySlot(entries, prefs.meal_slots);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="fuel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', backgroundImage: 'radial-gradient(ellipse at center, rgba(52,211,153,0.10), transparent 70%), var(--card-bg)' }}>
        <CalorieRing current={totals.kcal} target={dayTarget} />
        <div style={{ marginTop: 6, fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
          TRAINING DAY · {Math.round(targets.training_kcal ?? 2650).toLocaleString()} TARGET
        </div>
        <div style={{ marginTop: 4, fontSize: 10, letterSpacing: '0.10em', color: 'var(--accent-bright)', textTransform: 'uppercase' }}>
          {(MACRO_PRESETS[macroPreset] || MACRO_PRESETS.balanced).label}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MacroCard label="Protein" current={totals.protein_g} target={proteinTarget} unit="g" floor />
        <MacroCard label="Carbs" current={totals.carbs_g} target={carbsTarget} unit="g" />
        <MacroCard label="Fat" current={totals.fat_g} target={fatTarget} unit="g" floor />
      </div>



      {!loading && prefs.meal_slots.map((slot) => (
        <MealSection
          key={slot}
          slot={slot}
          items={grouped[slot] || []}
          onAdd={() => onAddFood(slot)}
          onAddPrefilled={(query) => onAddFood(slot, query)}
          onDelete={onDelete}
          settings={settings}
          onToggleFavorite={onToggleFavorite}
          plan={(planSlots || []).find((p) => p.mealTime === slot)}
          onAfterLogAll={onAfterLogAll}
        />
      ))}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => onOpenDescribe && onOpenDescribe('Lunch')}
            className="fuel-btn"
            style={{ padding: '12px', fontSize: 13, justifyContent: 'center' }}
          >
            Describe a meal
          </button>
          <button
            onClick={() => onOpenPot && onOpenPot('Lunch')}
            className="fuel-btn"
            style={{ padding: '12px', fontSize: 13, justifyContent: 'center' }}
          >
            Bowl from whole pot
          </button>
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="empty">
          <div className="empty-title">Empty day so far.</div>
          Tap "Add food" under a meal to start logging. The rings update as you go.
        </div>
      )}
    </div>
  );
}

function MacroCard({ label, current, target, unit, floor }) {
  const safeTarget = target > 0 ? target : 1;
  const ratio = current / safeTarget;
  const ringSize = 56;
  const stroke = 5;
  const radius = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const displayPct = Math.max(0, Math.min(ratio, 1.5));
  const dashOffset = circ * (1 - Math.min(displayPct, 1));
  const remaining = Math.max(0, target - current);
  const over = current > target;
  return (
    <div className="fuel-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: ringSize, height: ringSize, flexShrink: 0 }}>
        <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={ringSize/2} cy={ringSize/2} r={radius}
            stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} fill="none" />
          <circle cx={ringSize/2} cy={ringSize/2} r={radius}
            stroke={over ? '#f59e0b' : 'url(#fuel-ring)'} strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 400ms ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: over ? 'var(--warn)' : 'var(--text-primary)' }}>
          {Math.round(displayPct * 100)}%
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="fuel-label">{label}{floor && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>· min</span>}</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, lineHeight: 1.1 }}>
          {Math.round(current)}<span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 400 }}>{` / ${target}${unit}`}</span>
        </div>
        <div style={{ fontSize: 10, color: over ? 'var(--warn)' : 'var(--text-tertiary)', marginTop: 4, letterSpacing: '0.06em' }}>
          {over ? `OVER ${Math.round(current - target)}${unit}` : `${Math.round(remaining)}${unit} LEFT`}
        </div>
      </div>
    </div>
  );
}

function MealSection({ slot, items, onAdd, onAddPrefilled, onDelete, settings, onToggleFavorite, plan, onAfterLogAll }) {
  const slotKcal = items.reduce((s, e) => s + (e.kcal || 0), 0);
  return (
    <div className="fuel-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: items.length ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>{slot}</div>
          {items.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {items.length} item{items.length === 1 ? '' : 's'} · {Math.round(slotKcal)} kcal
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {items.length > 0 && (
            <button
              onClick={async () => {
                const name = window.prompt(`Save these ${items.length} item${items.length === 1 ? '' : 's'} as a saved meal?\n\nName:`, slot === 'Breakfast' ? 'My usual breakfast' : `${slot} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
                if (!name || !name.trim()) return;
                const r = await saveMealApi({ name: name.trim(), entries: items });
                if (!r.ok) alert('Save failed: ' + (r.error?.message || 'unknown'));
              }}
              className="fuel-btn fuel-btn-ghost"
              style={{ padding: '6px 10px', fontSize: 11, letterSpacing: '0.06em' }}
              title="Save as meal"
            >SAVE</button>
          )}
          <button onClick={onAdd} className="fuel-btn fuel-btn-primary" style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
            + Add food
          </button>
        </div>
      </div>
      {plan && (
        <PlannedMealBlock
          plan={plan}
          slot={slot}
          onAddPrefilled={onAddPrefilled}
          onAfterLogAll={onAfterLogAll}
        />
      )}
      {items.map((e) => {
        const sig = { source: e.source, source_id: e.source_id, food_name: e.food_name };
        const fav = isFavorited(settings, sig);
        return (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{e.food_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {e.serving_qty} × {e.serving_unit} · {Math.round(e.kcal)} kcal · {Math.round(e.protein_g)}g P · {Math.round(e.carbs_g)}g C · {Math.round(e.fat_g)}g F
              </div>
            </div>
            <button
              onClick={() => onToggleFavorite(sig)}
              style={{ background: 'transparent', border: 'none', color: fav ? 'var(--accent-bright)' : 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', padding: 4 }}
              title={fav ? 'Unfavorite' : 'Favorite'}
            >{fav ? '★' : '☆'}</button>
            <button
              onClick={() => onDelete(e.id)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', padding: 4 }}
              title="Remove"
            >×</button>
          </div>
        );
      })}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// Other tabs
// ─────────────────────────────────────────────────────────────────────────────

function LogScreen({ onAddFood, settings }) {
  const slots = settings?.preferences?.meal_slots || DEFAULT_PREFERENCES.meal_slots;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="fuel-page-title">Log food to a meal</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {slots.map((s) => (
          <button
            key={s}
            onClick={() => onAddFood(s)}
            className="fuel-btn"
            style={{ padding: '14px 12px', justifyContent: 'flex-start' }}
          >
            <span style={{ fontWeight: 600 }}>{s}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 12 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WeightScreen({ settings }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [draftDate, setDraftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const goalWeight = null; // future: settings.profile.goal_weight_lbs

  const refresh = async () => {
    const r = await getWeightEntries(90);
    if (r.ok) {
      setEntries(recomputeTrend(r.entries));
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const onLog = async () => {
    const w = Number(draft);
    if (!Number.isFinite(w) || w < 50 || w > 600) {
      setError('Enter a weight between 50 and 600 lbs.');
      return;
    }
    setError(null);
    setSaving(true);
    const r = await addOrUpdateWeight({ date: draftDate, weight_lbs: w });
    setSaving(false);
    if (r.ok) {
      setDraft('');
      refresh();
    } else {
      setError(r.error?.message || 'Save failed');
    }
  };

  const stats = computeStats(entries);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="fuel-page-title">Weight</div>

      <div className="fuel-card">
        <div className="fuel-label" style={{ marginBottom: 8 }}>Log weight</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number" inputMode="decimal" step="0.1" min="50" max="600"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={stats ? String(stats.raw_today) : 'lbs'}
            style={{ ...fieldStyle, flex: 1, fontSize: 16, padding: '12px 14px' }}
          />
          <input
            type="date"
            value={draftDate}
            max={today}
            onChange={(e) => setDraftDate(e.target.value)}
            style={{ ...fieldStyle, padding: '12px 10px' }}
          />
          <button
            onClick={onLog}
            disabled={saving || !draft}
            className="fuel-btn fuel-btn-primary"
            style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13 }}
          >
            {saving ? '…' : 'Log'}
          </button>
        </div>
        {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {stats && (
        <div className="fuel-card">
          <div className="fuel-label">Trend</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <div className="fuel-stat" style={{ fontSize: 36 }}>{stats.trended_today.toFixed(1)}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              lbs (raw {stats.raw_today.toFixed(1)})
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
            <Stat label="Last 7 days" value={stats.week_change == null ? '—' : `${stats.week_change > 0 ? '+' : ''}${stats.week_change.toFixed(1)} lbs`} />
            <Stat label="Rate" value={stats.rate_lbs_per_week == null ? '—' : `${stats.rate_lbs_per_week > 0 ? '+' : ''}${stats.rate_lbs_per_week.toFixed(2)} lb/wk`} />
            <Stat label="Since start" value={`${stats.total_change > 0 ? '+' : ''}${stats.total_change.toFixed(1)} lbs`} />
          </div>
        </div>
      )}

      {!loading && entries.length > 0 && <WeightChart entries={entries} goalWeight={goalWeight} />}
      {!loading && entries.length === 0 && (
        <div className="empty">
          <div className="empty-title">No weight history yet.</div>
          Log a weight above. After 14 days the algorithm starts back-solving your TDEE.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}
function TrendsScreen({ settings, onOpenReview }) {
  const [days, setDays] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const algo = settings?.algo_state || {};
  const phase = algo.phase || 'cutting';
  const tdee = algo.tdee_estimate || 0;
  const dietBreak = checkDietBreakNeeded(phase, algo.phase_start_date);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Pull last 30 days of daily kcal totals
      const today = new Date();
      const out = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const r = await getDayEntries(iso);
        const kcal = r.ok ? r.entries.reduce((s, e) => s + (e.kcal || 0), 0) : 0;
        out.push({ date: iso, kcal });
      }
      if (cancelled) return;
      setDays(out);
      const rr = await getRecentReviews(8);
      if (!cancelled && rr.ok) setReviews(rr.reviews);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="empty">Loading…</div>;

  const totalLogged = days.filter((d) => d.kcal > 0).length;
  const avgKcal = totalLogged > 0 ? Math.round(days.reduce((s, d) => s + d.kcal, 0) / totalLogged) : 0;

  const goal = settings?.profile?.goal || 'cut';
  const presetKey = settings?.preferences?.macro_preset || 'balanced';
  const weight = settings?.profile?.weight_lbs;
  const phaseLabel = phase === 'cutting' ? 'CUTTING' : phase === 'maintenance' ? 'MAINTENANCE' : phase === 'diet_break' ? 'DIET BREAK' : phase === 'reverse' ? 'REVERSE' : phase.toUpperCase();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="fuel-page-title">Coach</div>

      {/* Hero phase banner */}
      <div className="fuel-card" style={{ padding: 18, backgroundImage: 'radial-gradient(ellipse at top right, rgba(52,211,153,0.12), transparent 60%), var(--card-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--accent-bright)', fontWeight: 600, textTransform: 'uppercase' }}>{phaseLabel}</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, lineHeight: 1.1 }}>
              {tdee ? `${tdee.toLocaleString()} kcal/day` : 'No TDEE yet'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {tdee ? `Algorithm's 14-day TDEE estimate` : 'Log weights for 14 days to enable adaptive targets'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <span className="fuel-chip">{goal.toUpperCase()}</span>
            <span className="fuel-chip-muted">{presetKey.replace('_',' ').toUpperCase()}</span>
            {weight && <span className="fuel-chip-muted">{weight} lb</span>}
          </div>
        </div>
        {dietBreak.weeks > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'var(--text-secondary)' }}>
            Week {dietBreak.weeks} of phase · last review {algo.last_review_date || 'never'}
          </div>
        )}
      </div>

      <div className="fuel-card">
        <div className="fuel-label">Algorithm status</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 10 }}>
          <Stat label="TDEE estimate" value={tdee ? `${tdee.toLocaleString()} kcal` : '—'} />
          <Stat label="Phase" value={phase.replace('_', ' ')} />
          <Stat label="Days in phase" value={dietBreak.weeks ? `${dietBreak.weeks * 7} d (${dietBreak.weeks} wk)` : '—'} />
          <Stat label="Last review" value={algo.last_review_date || 'never'} />
        </div>
        <button onClick={onOpenReview} className="fuel-btn fuel-btn-primary" style={{ marginTop: 14, padding: '10px 14px', fontSize: 13 }}>
          Run weekly review now
        </button>
      </div>

      {dietBreak.needed && (
        <div className="fuel-card" style={{ borderColor: 'rgba(245,158,11,0.32)', background: 'var(--warn-fill)' }}>
          <div className="fuel-label" style={{ color: 'var(--warn)' }}>Diet break recommended</div>
          <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>{dietBreak.message}</div>
        </div>
      )}

      <div className="fuel-card">
        <div className="fuel-label">Energy balance — last 30 days</div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
          {totalLogged} days logged · avg {avgKcal.toLocaleString()} kcal on logged days
        </div>
      </div>
      <EnergyBalanceChart days={days} tdee={tdee} />

      {reviews.length > 0 && (
        <div className="fuel-card">
          <div className="fuel-label" style={{ marginBottom: 8 }}>Recent reviews</div>
          {reviews.map((r) => (
            <div key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '10px 0', fontSize: 13, lineHeight: 1.45 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {new Date(r.review_date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{r.reasoning}</div>
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                TDEE {Math.round(r.prior_tdee || 0)} → {Math.round(r.estimated_tdee || 0)} ·
                training {Math.round(r.prior_training_kcal || 0)} → {Math.round(r.new_training_kcal || 0)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings (kept from Phase 1, plus a pass-through for HeightInput)
// ─────────────────────────────────────────────────────────────────────────────

function SettingsScreen({ onSignOut, settings, missingTable, onSettingsSaved, onPrefChange }) {
  const [profile, setProfile] = useState(settings?.profile || DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  // If settings arrive later, hydrate
  useEffect(() => {
    if (settings?.profile) setProfile(settings.profile);
  }, [settings]);

  const onChange = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    const r = await saveSettings({ profile });
    setSaving(false);
    if (r.ok) {
      setSavedAt(new Date());
      onSettingsSaved?.({ ...(settings || {}), profile });
    } else {
      alert('Save failed: ' + (r.error?.message || 'unknown'));
    }
  };

  if (missingTable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="fuel-page-title">Settings</div>
        <MissingTableCard />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="fuel-page-title">Settings</div>
      <div className="fuel-card">
        <div className="fuel-label" style={{ marginBottom: 8 }}>Profile</div>
        <SettingRow>
          <Field label="Weight (lbs)" value={profile.weight_lbs} onChange={(v) => onChange('weight_lbs', Number(v))} type="number" />
          <HeightInput totalInches={profile.height_in} onChange={(v) => onChange('height_in', v)} />
        </SettingRow>
        <SettingRow>
          <Field label="Age" value={profile.age} onChange={(v) => onChange('age', Number(v))} type="number" />
          <Field label="Sex" value={profile.sex} onChange={(v) => onChange('sex', v)} options={['male','female']} />
        </SettingRow>
        <SettingRow>
          <Field label="Goal" value={profile.goal} onChange={(v) => onChange('goal', v)} options={['cut','maintain','gain']} />
          <Field label="Training days/wk" value={profile.training_days_per_week} onChange={(v) => onChange('training_days_per_week', Number(v))} type="number" />
        </SettingRow>
        <SettingRow>
          <Field
            label="Macro preset"
            value={settings?.preferences?.macro_preset || 'balanced'}
            onChange={(v) => onPrefChange && onPrefChange('macro_preset', v)}
            options={Object.keys(MACRO_PRESETS)}
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'end', lineHeight: 1.4 }}>
            {(MACRO_PRESETS[settings?.preferences?.macro_preset || 'balanced'] || MACRO_PRESETS.balanced).description}
          </div>
        </SettingRow>
        <SettingRow>
          <Field label="Goal rate (% bw/wk)" value={profile.target_rate_pct} onChange={(v) => onChange('target_rate_pct', Number(v))} type="number" step="0.05" />
          <Field label="Activity level" value={profile.activity_level} onChange={(v) => onChange('activity_level', v)} options={['sedentary','light','moderate','very','extreme']} />
        </SettingRow>
        <button className="fuel-btn fuel-btn-primary" onClick={onSave} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {savedAt && (
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--accent)' }}>
            Saved {savedAt.toLocaleTimeString()}
          </span>
        )}
      </div>
      <button className="fuel-btn fuel-btn-ghost" onClick={onSignOut}>Sign out</button>
    </div>
  );
}

function SettingRow({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>{children}</div>;
}

function HeightInput({ totalInches, onChange }) {
  const safe = Number.isFinite(totalInches) ? totalInches : 0;
  const ft = Math.floor(safe / 12);
  const inches = Math.round(safe - ft * 12);
  const update = (newFt, newIn) => onChange(newFt * 12 + newIn);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="fuel-label">Height</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number" min="0" max="9" inputMode="numeric"
            value={ft}
            onChange={(e) => update(Math.max(0, Number(e.target.value || 0)), inches)}
            style={{ ...fieldStyle, width: '100%' }}
          />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12, letterSpacing: '0.06em' }}>ft</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number" min="0" max="11" inputMode="numeric"
            value={inches}
            onChange={(e) => update(ft, Math.min(11, Math.max(0, Number(e.target.value || 0))))}
            style={{ ...fieldStyle, width: '100%' }}
          />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12, letterSpacing: '0.06em' }}>in</span>
        </div>
      </div>
    </label>
  );
}

function Field({ label, value, onChange, type = 'text', options, step }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="fuel-label">{label}</span>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={fieldStyle}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={value ?? ''}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          style={fieldStyle}
        />
      )}
    </label>
  );
}

const fieldStyle = {
  background: 'var(--bg-elev-1)',
  border: '1px solid var(--card-border)',
  color: 'var(--text-primary)',
  padding: '8px 10px',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
};

// ─────────────────────────────────────────────────────────────────────────────
// Bottom nav
// ─────────────────────────────────────────────────────────────────────────────

function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="fuel-nav">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`fuel-nav-item ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => onTabChange(t.id)}
        >
          <svg className="fuel-nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={t.icon} />
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
