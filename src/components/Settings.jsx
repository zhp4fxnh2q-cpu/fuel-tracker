import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting, getSetting } from '../lib/db';
import RecipeImport from './RecipeImport';
import FlameIcon from './FlameIcon';

export default function Settings() {
  const [showRecipeImport, setShowRecipeImport] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [settings, setSettings] = useState({});

  const importedRecipes = useLiveQuery(() => db.importedRecipes.toArray());

  // Load all settings into a flat object
  const allSettings = useLiveQuery(() => db.userSettings.toArray());
  useEffect(() => {
    if (!allSettings) return;
    const map = {};
    allSettings.forEach(s => { map[s.key] = s.value; });
    setSettings(map);
  }, [allSettings]);

  const updateSetting = async (key, value) => {
    await setSetting(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleClearData = async () => {
    await db.foodLog.clear();
    await db.weightEntries.clear();
    await db.trainingDays.clear();
    await db.weeklySummaries.clear();
    setShowClearConfirm(false);
  };

  const handleExportData = async () => {
    const data = {
      exported_at: new Date().toISOString(),
      foodLog: await db.foodLog.toArray(),
      weightEntries: await db.weightEntries.toArray(),
      importedRecipes: await db.importedRecipes.toArray(),
      customFoods: await db.customFoods.toArray(),
      userSettings: await db.userSettings.toArray(),
      trainingDays: await db.trainingDays.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuel-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parse training days (stored as JSON array of day-of-week indices, Mon=1..Sun=0)
  const trainingDaysArr = (() => {
    try { return JSON.parse(settings.defaultTrainingDaysOfWeek || '[]'); } catch { return [1, 2, 3, 4]; }
  })();

  if (showRecipeImport) {
    return <RecipeImport onClose={() => setShowRecipeImport(false)} />;
  }

  return (
    <div className="safe-top" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="px-6 py-8 space-y-6 w-full">
        <h2 className="text-2xl font-700" style={{ color: 'var(--text-primary)' }}>Settings</h2>

        {/* Profile */}
        <Section title="Profile">
          <Row label="Height">
            <NumInput value={settings.heightInches} onChange={v => updateSetting('heightInches', v)} placeholder="78" suffix="in" />
          </Row>
          <Row label="Age">
            <NumInput value={settings.age} onChange={v => updateSetting('age', v)} placeholder="35" />
          </Row>
          <Row label="Sex">
            <select value={settings.sex || 'male'} onChange={e => updateSetting('sex', e.target.value)}
              className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Row>
          <Row label="Starting Weight">
            <NumInput value={settings.startingWeight} onChange={v => updateSetting('startingWeight', v)} placeholder="220" suffix="lbs" />
          </Row>
        </Section>

        {/* Goals */}
        <Section title="Goals">
          <Row label="Goal Weight">
            <NumInput value={settings.goalWeight} onChange={v => updateSetting('goalWeight', v)} placeholder="200" suffix="lbs" />
          </Row>
          <Row label="Target Loss Rate">
            <div className="flex items-center gap-2">
              <input type="range" min="0.5" max="1.0" step="0.05"
                value={settings.targetLossRatePercent || 0.625}
                onChange={e => updateSetting('targetLossRatePercent', parseFloat(e.target.value))}
                style={{ accentColor: 'var(--accent-primary)' }} className="flex-1" />
              <span className="text-sm w-14 text-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {((settings.targetLossRatePercent || 0.625) * 100).toFixed(1)}%
              </span>
            </div>
          </Row>
        </Section>

        {/* Calorie Cycling */}
        <Section title="Calorie Cycling">
          <Row label="Training Day Cals">
            <NumInput value={settings.trainingDayCalories} onChange={v => updateSetting('trainingDayCalories', v)} placeholder="2650" suffix="kcal" width="w-24" />
          </Row>
          <Row label="Rest Day Cals">
            <NumInput value={settings.restDayCalories} onChange={v => updateSetting('restDayCalories', v)} placeholder="2150" suffix="kcal" width="w-24" />
          </Row>
          <div>
            <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Default Training Days</div>
            <div className="flex flex-wrap gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                <button key={day} onClick={() => {
                  const newDays = trainingDaysArr.includes(idx)
                    ? trainingDaysArr.filter(d => d !== idx)
                    : [...trainingDaysArr, idx];
                  updateSetting('defaultTrainingDaysOfWeek', JSON.stringify(newDays));
                }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: trainingDaysArr.includes(idx) ? 'rgba(88,166,255,0.15)' : 'var(--bg-elevated)',
                    color: trainingDaysArr.includes(idx) ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                    border: `1px solid ${trainingDaysArr.includes(idx) ? 'var(--accent-primary)' : 'var(--border)'}`,
                  }}>
                  {day}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Nutrition */}
        <Section title="Nutrition">
          <Row label="Protein Target">
            <NumInput value={settings.dailyProteinTarget} onChange={v => updateSetting('dailyProteinTarget', v)} placeholder="200" suffix="g" />
          </Row>
        </Section>

        {/* Phase */}
        <Section title="Phase">
          <div className="space-y-2">
            {[
              { value: 'cut', label: 'Cut', desc: 'Calorie deficit to lose fat' },
              { value: 'maintenance', label: 'Maintenance', desc: 'Eating at TDEE' },
              { value: 'diet_break', label: 'Diet Break', desc: '1-2 week recovery at maintenance' },
            ].map(p => (
              <label key={p.value} className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer" style={{
                backgroundColor: settings.phase === p.value ? 'rgba(88,166,255,0.06)' : 'transparent',
              }}>
                <input type="radio" name="phase" value={p.value}
                  checked={(settings.phase || 'cut') === p.value}
                  onChange={e => updateSetting('phase', e.target.value)}
                  style={{ accentColor: 'var(--accent-primary)' }} className="mt-0.5" />
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* Meal Plans */}
        <Section title="Meal Plan Import">
          <button onClick={() => setShowRecipeImport(true)}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>
            Import Recipes from Meal Planner
          </button>
          {importedRecipes && importedRecipes.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {importedRecipes.slice(0, 5).map(r => (
                <div key={r.id} className="text-xs p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                  <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>{Math.round(r.per_serving_calories || 0)} kcal/serving</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Data */}
        <Section title="Data">
          <button onClick={handleExportData}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors mb-2"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Export All Data (JSON)
          </button>
          <button onClick={() => setShowClearConfirm(true)}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ border: '1px solid #f85149', color: '#f85149' }}>
            Clear All Data
          </button>
          {showClearConfirm && (
            <div className="mt-3 p-3.5 rounded-lg" style={{ backgroundColor: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#f85149' }}>Are you sure?</div>
              <div className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>This permanently deletes all food logs, weight entries, and training data.</div>
              <div className="flex gap-2">
                <button onClick={handleClearData} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#f85149', color: 'white' }}>Delete</button>
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
              </div>
            </div>
          )}
        </Section>

        {/* About / Brand Footer */}
        <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FlameIcon size={40} opacity={0.7} style={{ margin: '0 auto 12px' }} />
          <div
            className="text-base font-bold mb-1"
            style={{
              background: 'linear-gradient(135deg, #F5B84A, #E07020)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.1em',
            }}
          >
            FUEL
          </div>
          <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
            ADAPTIVE CALORIE TRACKING
          </div>
          <div className="mx-auto mb-3" style={{ width: 40, height: 1, backgroundColor: 'var(--border)' }} />
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Version 1.0.0</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Personal Edition · Built for David</div>
        </div>

        <div className="h-20" />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function NumInput({ value, onChange, placeholder, suffix, width = 'w-20' }) {
  return (
    <div className="flex items-center gap-2">
      <input type="number" value={value || ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        placeholder={placeholder}
        className={`${width} px-3 py-2 rounded-lg text-sm text-right`}
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }} />
      {suffix && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{suffix}</span>}
    </div>
  );
}
