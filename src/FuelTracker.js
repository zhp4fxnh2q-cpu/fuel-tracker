/**
 * FUEL — main authenticated shell.
 * Phase 3: live food logging. Today screen pulls fuel_food_log + fuel_settings
 * and renders a real calorie ring, real macro bars, per-meal-slot sections,
 * and an "Add food" flow that hits USDA via the Pages Function.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TABS, DEFAULT_PROFILE, DEFAULT_TARGETS, DEFAULT_PREFERENCES } from './lib/constants';
import { fetchSettings, saveSettings } from './lib/db';
import { getDayEntries, deleteEntry, sumDay, groupBySlot, todayIso } from './lib/foodLog';
import CalorieRing from './components/CalorieRing';
import AddFoodSheet from './components/AddFoodSheet';

export default function FuelTracker({ session, onSignOut }) {
  const [activeTab, setActiveTab] = useState('today');
  const [settings, setSettings] = useState(null);
  const [missingTable, setMissingTable] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addSlot, setAddSlot] = useState('Breakfast');

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
      if (s.ok) setSettings(s.settings);
      const d = await getDayEntries(todayIso());
      if (cancelled) return;
      if (d.ok) setEntries(d.entries);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const onAddFood = (slot) => {
    setAddSlot(slot);
    setAddOpen(true);
  };

  const onLogged = async () => {
    await refreshDay();
  };

  return (
    <div className="fuel-app">
      <main className="fuel-page">
        <Header session={session} onSignOut={onSignOut} />
        {missingTable && <MissingTableCard />}
        {!missingTable && activeTab === 'today' && (
          <TodayScreen
            settings={settings}
            entries={entries}
            loading={loading}
            onAddFood={onAddFood}
            onDelete={async (id) => {
              await deleteEntry(id);
              refreshDay();
            }}
          />
        )}
        {activeTab === 'log' && <LogScreen onAddFood={onAddFood} settings={settings} />}
        {activeTab === 'weight' && <WeightScreen />}
        {activeTab === 'trends' && <TrendsScreen />}
        {activeTab === 'settings' && (
          <SettingsScreen
            onSignOut={onSignOut}
            settings={settings}
            missingTable={missingTable}
            onSettingsSaved={(s) => setSettings(s)}
          />
        )}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      <AddFoodSheet
        open={addOpen}
        mealSlot={addSlot}
        onClose={() => setAddOpen(false)}
        onLogged={onLogged}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

function Header({ session, onSignOut }) {
  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginBottom: 16 }}>
      <div>
        <div className="fuel-page-title">{dateLabel}</div>
        <div className="fuel-mark" style={{ fontSize: 28, marginTop: 2 }}>FUEL</div>
      </div>
      <button
        onClick={onSignOut}
        className="fuel-btn fuel-btn-ghost"
        style={{ fontSize: 11, padding: '6px 10px', letterSpacing: '0.08em' }}
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

function TodayScreen({ settings, entries, loading, onAddFood, onDelete }) {
  const profile = settings?.profile || DEFAULT_PROFILE;
  const targets = settings?.targets || DEFAULT_TARGETS;
  const prefs = settings?.preferences || DEFAULT_PREFERENCES;

  // Phase 3 simplification: assume training day (use training_kcal target).
  // Phase 6 will plug FORGE / training_day_overrides into this.
  const dayTarget = targets.training_kcal ?? 2650;
  const proteinTarget = Math.round(profile.weight_lbs * (targets.protein_g_per_lb ?? 1));
  const fatTarget = Math.round(profile.weight_lbs * (targets.fat_g_per_lb ?? 0.3));
  const carbsTarget = Math.max(0, Math.round((dayTarget - proteinTarget * 4 - fatTarget * 9) / 4));

  const totals = sumDay(entries);
  const grouped = groupBySlot(entries, prefs.meal_slots);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="fuel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
        <CalorieRing current={totals.kcal} target={dayTarget} />
        <div style={{ marginTop: 6, fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
          TRAINING DAY · {Math.round(targets.training_kcal ?? 2650).toLocaleString()} TARGET
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MacroCard label="Protein" current={totals.protein_g} target={proteinTarget} unit="g" floor />
        <MacroCard label="Carbs" current={totals.carbs_g} target={carbsTarget} unit="g" />
        <MacroCard label="Fat" current={totals.fat_g} target={fatTarget} unit="g" floor />
      </div>

      {loading && <div className="empty">Loading today…</div>}

      {!loading && prefs.meal_slots.map((slot) => (
        <MealSection
          key={slot}
          slot={slot}
          items={grouped[slot] || []}
          onAdd={() => onAddFood(slot)}
          onDelete={onDelete}
        />
      ))}

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
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const remaining = Math.max(0, target - current);
  return (
    <div className="fuel-card" style={{ padding: 12 }}>
      <div className="fuel-label">{label}{floor && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>· floor</span>}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
        {Math.round(current)}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 400 }}>{` / ${target}${unit}`}</span>
      </div>
      <div style={{ height: 4, marginTop: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gradient-fuel)' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, letterSpacing: '0.06em' }}>
        {current > target ? `OVER ${Math.round(current - target)} ${unit}` : `${Math.round(remaining)} ${unit} LEFT`}
      </div>
    </div>
  );
}

function MealSection({ slot, items, onAdd, onDelete }) {
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
        <button onClick={onAdd} className="fuel-btn fuel-btn-primary" style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
          + Add food
        </button>
      </div>
      {items.map((e) => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{e.food_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {e.serving_qty} × {e.serving_unit} · {Math.round(e.kcal)} kcal · {Math.round(e.protein_g)}g P · {Math.round(e.carbs_g)}g C · {Math.round(e.fat_g)}g F
            </div>
          </div>
          <button
            onClick={() => onDelete(e.id)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', padding: 4 }}
            title="Remove"
          >×</button>
        </div>
      ))}
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

function WeightScreen() {
  return <Placeholder title="Weight" body="Phase 5: daily weight input, EWMA trend line, 90-day chart, back-solve TDEE preview." />;
}
function TrendsScreen() {
  return <Placeholder title="Trends" body="Phase 7: energy-balance chart, weekly averages table, algorithm status, AI weekly summary." />;
}
function Placeholder({ title, body }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="fuel-page-title">{title}</div>
      <div className="empty"><div className="empty-title">Coming soon.</div>{body}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings (kept from Phase 1, plus a pass-through for HeightInput)
// ─────────────────────────────────────────────────────────────────────────────

function SettingsScreen({ onSignOut, settings, missingTable, onSettingsSaved }) {
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
          <span className="fuel-nav-icon">{t.glyph}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
