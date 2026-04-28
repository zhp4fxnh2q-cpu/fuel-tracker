/**
 * FUEL — main authenticated shell.
 * Phase 1: bottom nav + 5 placeholder screens, settings boot-straps a row in fuel_settings.
 * Phases 3+: real food log, weight, trends, meal-planner pull-down.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { TABS, DEFAULT_PROFILE } from './lib/constants';
import { fetchSettings, saveSettings } from './lib/db';

export default function FuelTracker({ session, onSignOut }) {
  const [activeTab, setActiveTab] = useState('today');

  return (
    <div className="fuel-app">
      <main className="fuel-page">
        <Header session={session} onSignOut={onSignOut} />
        {activeTab === 'today' && <TodayScreen />}
        {activeTab === 'log' && <LogScreen />}
        {activeTab === 'weight' && <WeightScreen />}
        {activeTab === 'trends' && <TrendsScreen />}
        {activeTab === 'settings' && <SettingsScreen onSignOut={onSignOut} />}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

function Header({ session, onSignOut }) {
  const dateLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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

// ─────────────────────────────────────────────────────────────────────────────
// Today (placeholder rings)
// ─────────────────────────────────────────────────────────────────────────────

function TodayScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="fuel-card" style={{ textAlign: 'center', padding: '28px 16px' }}>
        <div className="fuel-label">Calories</div>
        <div className="fuel-stat" style={{ fontSize: 44, marginTop: 8 }}>0 / 2,650</div>
        <div style={{ marginTop: 6, color: 'var(--text-tertiary)', fontSize: 12, letterSpacing: '0.08em' }}>
          TRAINING DAY · REMAINING 2,650
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MacroCard label="Protein" current={0} target={220} unit="g" />
        <MacroCard label="Carbs" current={0} target={290} unit="g" />
        <MacroCard label="Fat" current={0} target={66} unit="g" />
      </div>

      <div className="empty">
        <div className="empty-title">Phase 1 shell live.</div>
        Food logging, planned meals, USDA search, and the adaptive algorithm ship in the next session.
        Run the SQL migration in Supabase first (link in Settings).
      </div>
    </div>
  );
}

function MacroCard({ label, current, target, unit }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="fuel-card" style={{ padding: 12 }}>
      <div className="fuel-label">{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
        {current}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 400 }}>{` / ${target}${unit}`}</span>
      </div>
      <div style={{ height: 4, marginTop: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gradient-fuel)' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Other tabs (placeholders for now)
// ─────────────────────────────────────────────────────────────────────────────

function LogScreen() {
  return (
    <PlaceholderScreen
      title="Log food"
      body="Phase 3 lands the search overlay (Recent · Favorites · Saved meals · Meal planner · USDA), the natural-serving quantity picker, and the per-meal logging flow."
    />
  );
}

function WeightScreen() {
  return (
    <PlaceholderScreen
      title="Weight"
      body="Phase 5 lands the daily weight input, EWMA trend line, 90-day chart, and the back-solve TDEE preview."
    />
  );
}

function TrendsScreen() {
  return (
    <PlaceholderScreen
      title="Trends"
      body="Phase 7 lands the energy-balance chart, weekly averages table, algorithm status card, and AI weekly summary."
    />
  );
}

function PlaceholderScreen({ title, body }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="fuel-page-title">{title}</div>
      <div className="empty"><div className="empty-title">Coming soon.</div>{body}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings — minimal Phase 1 surface, with graceful pre-migration handling
// ─────────────────────────────────────────────────────────────────────────────

function SettingsScreen({ onSignOut }) {
  const [status, setStatus] = useState({ kind: 'loading' }); // loading | missing_table | ready | error
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => { let cancelled = false;
    (async () => {
      const r = await fetchSettings();
      if (cancelled) return;
      if (r.ok) {
        setProfile(r.settings.profile || DEFAULT_PROFILE);
        setStatus({ kind: 'ready' });
      } else if (r.missingTable) {
        setStatus({ kind: 'missing_table' });
      } else {
        setStatus({ kind: 'error', error: r.error });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onChange = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    const r = await saveSettings({ profile });
    setSaving(false);
    if (r.ok) setSavedAt(new Date());
    else alert('Save failed: ' + (r.error?.message || 'unknown'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="fuel-page-title">Settings</div>

      {status.kind === 'loading' && <div className="empty">Loading settings…</div>}

      {status.kind === 'missing_table' && (
        <div className="fuel-card" style={{ borderColor: 'rgba(245,158,11,0.32)', background: 'var(--warn-fill)' }}>
          <div className="fuel-label" style={{ color: 'var(--warn)' }}>Database setup needed</div>
          <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
            FUEL is connected to Supabase, but the <code>fuel_*</code> tables haven't been created yet.
            Open the Supabase SQL editor and run the migration in <code>migrations/0001_fuel_initial.sql</code> (in the repo).
            Reload after that and the rest of the app comes online.
          </div>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="auth-error">Settings load failed: {status.error?.message || 'unknown error'}</div>
      )}

      {status.kind === 'ready' && (
        <>
          <div className="fuel-card">
            <div className="fuel-label" style={{ marginBottom: 8 }}>Profile</div>
            <SettingRow>
              <Field label="Weight (lbs)" value={profile.weight_lbs} onChange={(v) => onChange('weight_lbs', Number(v))} type="number" />
              <Field label="Height (in)" value={profile.height_in} onChange={(v) => onChange('height_in', Number(v))} type="number" />
            </SettingRow>
            <SettingRow>
              <Field label="Age" value={profile.age} onChange={(v) => onChange('age', Number(v))} type="number" />
              <Field label="Sex" value={profile.sex} onChange={(v) => onChange('sex', v)} options={['male', 'female']} />
            </SettingRow>
            <SettingRow>
              <Field label="Goal" value={profile.goal} onChange={(v) => onChange('goal', v)} options={['cut', 'maintain', 'gain']} />
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

          <div className="fuel-card">
            <div className="fuel-label">About this build</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              Phase 1 — auth + skeleton + settings. Adaptive algorithm and food logging arrive in subsequent sessions.
              Smart intra-day rebalance with floors is locked in: protein floor 1g/lb, fat floor 0.3g/lb, carb floor 100g on training days.
            </div>
          </div>
        </>
      )}

      <button className="fuel-btn fuel-btn-ghost" onClick={onSignOut}>Sign out</button>
    </div>
  );
}

function SettingRow({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>{children}</div>;
}

function Field({ label, value, onChange, type = 'text', options, step }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="fuel-label">{label}</span>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={fieldStyle}
        >
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
