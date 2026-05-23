/**
 * AddFoodSheet — full-screen modal for logging a food.
 * Phase 3 ships the USDA tab only. Recent / Favorites / Saved Meals / Meal Planner
 * tabs are scaffolded but disabled until later phases.
 *
 * Flow:
 *   1) Search step: typeahead (debounced) → results list
 *   2) Quantity step: portion picker + amount + live macro preview
 *   3) "Log" → insert into fuel_food_log → onLogged(entry) → parent refreshes
 */
import React, { useEffect, useRef, useState } from 'react';
import { searchUsda, getUsdaFood, macrosAtGrams, detailFromSearchHit, lookupBarcode, pickDefaultPortionIdx } from '../lib/usda';
import { getRecentFoods, per100gFromEntry, entryGrams } from '../lib/foodLog';
import BarcodeScanner from './BarcodeScanner';
import { getSavedMeals, logSavedMeal, deleteSavedMeal } from '../lib/savedMeals';
import { fetchMealPlannerRow, resolveTodaysSlots, buildLogEntriesForSlot, resolveIngredientMacros } from '../lib/mealPlanner';
import RecipeEditor from './RecipeEditor';
import { addEntry, todayIso } from '../lib/foodLog';
import { SOURCE } from '../lib/constants';

const DEBOUNCE_MS = 300;
const TABS = [
  { id: 'meal_planner', label: 'Meal planner', enabled: true },
  { id: 'usda', label: 'USDA', enabled: true },
  { id: 'recent', label: 'Recent', enabled: true },
  { id: 'saved', label: 'Saved', enabled: true },
  { id: 'favorites', label: 'Favorites', enabled: true },
];

export default function AddFoodSheet({ open, mealSlot, prefill, onClose, onLogged, settings }) {
  const [tab, setTab] = useState('meal_planner');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [recents, setRecents] = useState([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const [savedMeals, setSavedMeals] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [plannerSlots, setPlannerSlots] = useState([]);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [step, setStep] = useState('search'); // 'search' | 'quantity'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  // Quantity step state
  const [foodDetail, setFoodDetail] = useState(null);
  const [portionIdx, setPortionIdx] = useState(0);
  const [amount, setAmount] = useState(1);
  const [saving, setSaving] = useState(false);

  const inputRef = useRef(null);

  // Reset on open/close. If a prefill query is supplied, auto-switch to USDA
  // tab and seed the search box.
  useEffect(() => {
    if (open) {
      setStep('search');
      setError(null);
      setFoodDetail(null);
      setPortionIdx(0);
      setAmount(1);
      if (prefill) {
        setTab('usda');
        setQuery(prefill);
      } else {
        setQuery('');
        setResults([]);
      }
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, prefill]);

  // Load recents when the tab is shown
  useEffect(() => {
    if (!open) return;
    if (tab !== 'recent' && tab !== 'favorites') return;
    let cancelled = false;
    setRecentsLoading(true);
    (async () => {
      const r = await getRecentFoods(60);
      if (cancelled) return;
      setRecents(r.recents || []);
      setRecentsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, tab]);

  // Load saved meals
  useEffect(() => {
    if (!open || tab !== 'saved') return;
    let cancelled = false;
    setSavedLoading(true);
    (async () => {
      const r = await getSavedMeals();
      if (cancelled) return;
      setSavedMeals(r.meals || []);
      setSavedLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, tab]);

  // Load today's meal-planner slots
  useEffect(() => {
    if (!open || tab !== 'meal_planner') return;
    let cancelled = false;
    setPlannerLoading(true);
    (async () => {
      const r = await fetchMealPlannerRow();
      if (cancelled) return;
      if (r.ok) {
        setPlannerSlots(resolveTodaysSlots(r.plan, r.custom_meals));
      } else {
        setPlannerSlots([]);
      }
      setPlannerLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, tab]);

  // Debounced USDA search
  useEffect(() => {
    if (!open || tab !== 'usda') return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const r = await searchUsda(query);
        setResults(r);
        setError(null);
      } catch (e) {
        setError(e.message);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, open, tab]);

  const onPick = async (hit) => {
    setStep('quantity');
    setFoodDetail({ loading: true, name: hit.name, fdcId: hit.fdcId });
    try {
      const detail = await getUsdaFood(hit.fdcId);
      setFoodDetail(detail);
      setPortionIdx(pickDefaultPortionIdx(detail.portions));
      setAmount(1);
    } catch (e) {
      // USDA's /food/{fdcId} 404s on some Foundation entries even though search
      // returned them. Fall back to per-100g macros from the search hit + plain
      // gram portions. User can still log accurately by weight.
      if (e.status === 404) {
        const detail = detailFromSearchHit(hit);
        setFoodDetail(detail);
        setPortionIdx(0);
        setAmount(100); // sensible default for gram-only — 100 g
        setError(null);
      } else {
        setError(e.message);
        setFoodDetail(null);
        setStep('search');
      }
    }
  };

  // One-tap log from search result: resolve the food, pick the default
  // portion, set amount=1, log, close. No quantity step. Used by the
  // "+" button on USDA search rows.
  const quickLogFromHit = async (hit, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    try {
      let detail;
      try {
        detail = await getUsdaFood(hit.fdcId);
      } catch (err) {
        if (err.status === 404) detail = detailFromSearchHit(hit);
        else throw err;
      }
      const idx = pickDefaultPortionIdx(detail.portions);
      const portion = detail.portions[idx];
      const grams = portion.grams * 1;
      const macros = macrosAtGrams(detail.per100g, grams);
      const entry = {
        date: todayIso(),
        meal_slot: mealSlot,
        food_name: detail.name,
        serving_qty: 1,
        serving_unit: portion.label,
        ...macros,
        source: SOURCE.USDA,
        source_id: String(detail.fdcId),
      };
      const r = await addEntry(entry);
      if (r.ok) {
        onLogged?.(entry);
        onClose();
      } else {
        setError(r.error?.message || 'Quick-log failed');
      }
    } catch (err) {
      setError(err.message || 'Quick-log failed');
    }
  };

  const onPickRecent = (entry) => {
    // Build a synthetic detail from the recent entry — gives us per-100g + plain gram portions.
    const per100g = per100gFromEntry(entry);
    const grams = entryGrams(entry);
    const detail = {
      fdcId: entry.source_id || `recent:${entry.id}`,
      name: entry.food_name,
      brand: null,
      dataType: entry.source === 'usda' ? 'SR Legacy' : 'Branded',
      per100g: per100g || { kcal: entry.kcal, protein_g: entry.protein_g, carbs_g: entry.carbs_g, fat_g: entry.fat_g, fiber_g: entry.fiber_g || 0, sodium_mg: entry.sodium_mg || 0 },
      portions: [
        { label: entry.serving_unit, grams: grams || 100 },
        { label: '100 g', grams: 100 },
        { label: '1 oz (28 g)', grams: 28.3495 },
        { label: '1 g', grams: 1 },
      ],
      _fromRecent: true,
    };
    setFoodDetail(detail);
    setPortionIdx(0);
    setAmount(entry.serving_qty || 1);
    setStep('quantity');
  };

    const portion = foodDetail?.portions?.[portionIdx];
  const grams = portion ? portion.grams * amount : 0;
  const macros = foodDetail && portion ? macrosAtGrams(foodDetail.per100g, grams) : null;

  const onLog = async () => {
    if (!foodDetail || !portion || !macros) return;
    setSaving(true);
    const entry = {
      date: todayIso(),
      meal_slot: mealSlot,
      food_name: foodDetail.name,
      serving_qty: amount,
      serving_unit: portion.label,
      ...macros,
      source: SOURCE.USDA,
      source_id: String(foodDetail.fdcId),
    };
    const r = await addEntry(entry);
    setSaving(false);
    if (r.ok) {
      onLogged?.(entry);
      onClose();
    } else {
      setError(r.error?.message || 'save failed');
    }
  };

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <Header
          mealSlot={mealSlot}
          onClose={onClose}
          step={step}
          onBack={step === 'quantity' ? () => setStep('search') : null}
        />

        {step === 'search' && (
          <>
            <div style={{ display: 'flex', gap: 4, padding: '0 16px 8px', overflowX: 'auto' }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  disabled={!t.enabled}
                  onClick={() => setTab(t.id)}
                  style={{
                    ...tabStyle,
                    color: tab === t.id ? 'var(--accent-bright)' : t.enabled ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    background: tab === t.id ? 'var(--accent-fill)' : 'transparent',
                    opacity: t.enabled ? 1 : 0.45,
                    cursor: t.enabled ? 'pointer' : 'not-allowed',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'usda' && (
              <>
                <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search USDA — eggs, chicken breast, oatmeal…"
                    style={{ ...searchInputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => setScannerOpen(true)}
                    title="Scan barcode"
                    style={scanBtnStyle}
                  >
                    📷
                  </button>
                </div>

                <div style={listScrollStyle}>
                  {error && <div style={errorBoxStyle}>{error}</div>}
                  {searching && <div style={hintStyle}>Searching…</div>}
                  {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
                    <div style={hintStyle}>No matches. Try a different term.</div>
                  )}
                  {!searching && query.trim().length < 2 && (
                    <div style={hintStyle}>Type at least 2 characters to search USDA, or tap the camera icon to scan a barcode.</div>
                  )}
                  {results.map((hit) => (
                    <div key={hit.fdcId} style={hitRowStyle}>
                      <button onClick={() => onPick(hit)} style={hitBodyStyle}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={hitNameStyle}>{hit.name}</div>
                          <div style={hitMetaStyle}>
                            <span style={dataTypeBadge(hit.dataType)}>{hit.dataType}</span>
                            {hit.brand && <span> · {hit.brand}</span>}
                            <span> · {Math.round(hit.per100g.kcal || 0)} kcal · {Math.round(hit.per100g.protein_g || 0)}g P / 100g</span>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => quickLogFromHit(hit, e)}
                        title="Quick-log 1 default serving"
                        style={quickAddBtnStyle}
                      >+</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(tab === 'recent' || tab === 'favorites') && (
              <RecentList
                recents={recents}
                loading={recentsLoading}
                tab={tab}
                favorites={settings?.preferences?.favorites || []}
                onPick={onPickRecent}
                onSwitchToUsda={() => setTab('usda')}
              />
            )}

            {tab === 'saved' && (
              <SavedMealsList
                meals={savedMeals}
                loading={savedLoading}
                mealSlot={mealSlot}
                onLog={async (id) => {
                  const r = await logSavedMeal(id, mealSlot);
                  if (r.ok) {
                    onLogged?.();
                    onClose();
                  } else {
                    setError(r.error?.message || 'Log failed');
                  }
                }}
                onDelete={async (id) => {
                  if (!window.confirm('Delete this saved meal?')) return;
                  await deleteSavedMeal(id);
                  setSavedMeals(savedMeals.filter((m) => m.id !== id));
                }}
                onEdit={(m) => setEditingMeal(m)}
              />
            )}

            {tab === 'meal_planner' && (
              <PlannerSlotsList
                slots={plannerSlots}
                loading={plannerLoading}
                mealSlot={mealSlot}
                onLogSlot={async (slot) => {
                  const rows = buildLogEntriesForSlot(slot, todayIso(), mealSlot);
                  let failures = 0;
                  for (const row of rows) {
                    const r = await addEntry(row);
                    if (!r.ok) failures++;
                  }
                  if (failures === 0) {
                    onLogged?.();
                    onClose();
                  } else {
                    setError(`Logged ${rows.length - failures} of ${rows.length}; ${failures} failed.`);
                  }
                }}
              />
            )}
          </>
        )}

        {step === 'quantity' && foodDetail && (
          <QuantityStep
            foodDetail={foodDetail}
            portionIdx={portionIdx}
            amount={amount}
            macros={macros}
            grams={grams}
            saving={saving}
            mealSlot={mealSlot}
            error={error}
            onPortionChange={setPortionIdx}
            onAmountChange={setAmount}
            onLog={onLog}
          />
        )}
      </div>
    {editingMeal && (
      <RecipeEditor
        open={!!editingMeal}
        meal={editingMeal}
        onClose={() => setEditingMeal(null)}
        onSaved={async () => {
          const r = await getSavedMeals();
          setSavedMeals(r.meals || []);
        }}
      />
    )}
    {scannerOpen && (
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={async (code) => {
          setScannerOpen(false);
          setStep('quantity');
          setFoodDetail({ loading: true, name: `Barcode ${code}`, fdcId: code });
          try {
            const detail = await lookupBarcode(code);
            setFoodDetail(detail);
            setPortionIdx(0); // brand serving is first if available, else 100g
            setAmount(1);
          } catch (err) {
            setError(err.status === 404 ? `Barcode ${code} not found in USDA or Open Food Facts. Try searching by name.` : err.message);
            setFoodDetail(null);
            setStep('search');
          }
        }}
      />
    )}
    </div>
  );
}

function Header({ mealSlot, onClose, step, onBack }) {
  return (
    <div style={headerStyle}>
      {onBack ? (
        <button onClick={onBack} style={headerBtn}>‹ Back</button>
      ) : (
        <button onClick={onClose} style={headerBtn}>Cancel</button>
      )}
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div className="fuel-page-title" style={{ margin: 0 }}>{step === 'search' ? 'Add food' : 'Quantity'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{mealSlot}</div>
      </div>
      <button onClick={onClose} style={headerBtn}>×</button>
    </div>
  );
}

function QuantityStep({ foodDetail, portionIdx, amount, macros, grams, saving, mealSlot, error, onPortionChange, onAmountChange, onLog }) {
  if (foodDetail.loading) {
    return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading food details…</div>;
  }
  return (
    <div style={{ padding: '0 16px 24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{foodDetail.name}</div>
        {foodDetail.brand && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{foodDetail.brand}</div>}
        <div style={{ marginTop: 6, fontSize: 11, letterSpacing: '0.06em' }}>
          <span style={dataTypeBadge(foodDetail.dataType)}>{foodDetail.dataType}</span>
        </div>
      </div>

      {foodDetail.fallbackFromSearch && (
        <div style={{
          marginBottom: 12, padding: '8px 12px',
          background: 'var(--warn-fill)',
          border: '1px solid rgba(245,158,11,0.32)',
          borderRadius: 10, fontSize: 12, color: 'var(--warn)', lineHeight: 1.4,
        }}>
          USDA didn't have a detailed serving list for this entry. Macros are
          accurate per 100g — pick a gram amount below.
        </div>
      )}
      <div className="fuel-label" style={{ marginBottom: 8 }}>Serving</div>
      <select
        value={portionIdx}
        onChange={(e) => onPortionChange(Number(e.target.value))}
        style={selectStyle}
      >
        {foodDetail.portions.map((p, i) => (
          <option key={i} value={i}>{p.label}</option>
        ))}
      </select>

      <div className="fuel-label" style={{ marginTop: 16, marginBottom: 8 }}>Amount</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => onAmountChange(Math.max(0.25, +(amount - 0.25).toFixed(2)))} style={stepBtn}>−</button>
        <input
          type="number"
          step="0.25"
          min="0"
          value={amount}
          onChange={(e) => onAmountChange(Math.max(0, Number(e.target.value || 0)))}
          style={{ ...selectStyle, textAlign: 'center', width: 100 }}
        />
        <button onClick={() => onAmountChange(+(amount + 0.25).toFixed(2))} style={stepBtn}>+</button>
        <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 13 }}>{Math.round(grams)} g total</span>
      </div>

      {macros && (
        <div className="fuel-card" style={{ marginTop: 18 }}>
          <div className="fuel-label">Macros at this amount</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 10 }}>
            <Stat label="Calories" value={`${macros.kcal} kcal`} />
            <Stat label="Protein" value={`${macros.protein_g} g`} />
            <Stat label="Carbs" value={`${macros.carbs_g} g`} />
            <Stat label="Fat" value={`${macros.fat_g} g`} />
            <Stat label="Fiber" value={`${macros.fiber_g} g`} />
            <Stat label="Sodium" value={`${Math.round(macros.sodium_mg)} mg`} />
          </div>
        </div>
      )}

      {error && <div style={{ ...errorBoxStyle, marginTop: 14 }}>{error}</div>}

      <button
        onClick={onLog}
        disabled={saving}
        className="fuel-btn fuel-btn-primary"
        style={{ width: '100%', marginTop: 18, padding: '14px 18px', fontSize: 15 }}
      >
        {saving ? 'Saving…' : `Log to ${mealSlot}`}
      </button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function dataTypeBadge(dt) {
  const palette = {
    Foundation: { bg: 'rgba(52,211,153,0.18)', fg: '#6ee7b7' },
    'SR Legacy': { bg: 'rgba(96,165,250,0.18)', fg: '#93c5fd' },
    Branded: { bg: 'rgba(251,191,36,0.18)', fg: '#fcd34d' },
    'Survey (FNDDS)': { bg: 'rgba(167,139,250,0.18)', fg: '#c4b5fd' },
  };
  const c = palette[dt] || { bg: 'rgba(255,255,255,0.06)', fg: 'var(--text-secondary)' };
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 500,
    marginRight: 6,
  };
}

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};

const sheetStyle = {
  width: '100%', maxWidth: '36rem',
  height: '92vh',
  background: 'var(--bg-elev-1)',
  borderTopLeftRadius: 18, borderTopRightRadius: 18,
  border: '1px solid var(--card-border)',
  borderBottom: 'none',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};

const headerStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '14px 12px 10px',
  borderBottom: '1px solid var(--card-border)',
};

const headerBtn = {
  background: 'transparent', border: 'none',
  color: 'var(--text-secondary)',
  fontSize: 14, fontWeight: 500,
  padding: '6px 10px', borderRadius: 8,
  cursor: 'pointer', minWidth: 56,
};

const tabStyle = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: 999,
  fontSize: 12, fontWeight: 500,
  letterSpacing: '0.04em',
  flexShrink: 0,
};

const searchInputStyle = {
  width: '100%',
  background: 'var(--bg-elev-2)',
  border: '1px solid var(--card-border)',
  color: 'var(--text-primary)',
  padding: '12px 14px',
  borderRadius: 12,
  fontSize: 15,
  outline: 'none',
};

const listScrollStyle = { flex: 1, overflowY: 'auto', padding: '0 8px 24px' };

const hitStyle = {
  width: '100%',
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  padding: '12px 8px',
  textAlign: 'left',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

const hitNameStyle = { fontSize: 14, fontWeight: 500, lineHeight: 1.35 };
const hitMetaStyle = { marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap' };

const hintStyle = { padding: '24px 16px', color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center' };
const errorBoxStyle = {
  margin: '8px 16px', padding: '10px 12px',
  background: 'var(--danger-fill)',
  border: '1px solid rgba(239,68,68,0.32)',
  color: 'var(--danger)',
  borderRadius: 10, fontSize: 13,
};

const selectStyle = {
  background: 'var(--bg-elev-2)',
  border: '1px solid var(--card-border)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
  borderRadius: 10,
  fontSize: 14,
  width: '100%',
  outline: 'none',
};

const scanBtnStyle = {
  background: 'var(--bg-elev-2)',
  border: '1px solid var(--card-border)',
  color: 'var(--accent-bright)',
  width: 48, height: 48,
  borderRadius: 12,
  fontSize: 22,
  cursor: 'pointer',
  flexShrink: 0,
};

function SavedMealsList({ meals, loading, mealSlot, onLog, onDelete, onEdit }) {
  return (
    <div style={listScrollStyle}>
      {loading && <div style={hintStyle}>Loading…</div>}
      {!loading && meals.length === 0 && (
        <div style={hintStyle}>
          No saved meals yet. After you log a meal slot, tap "SAVE" on its header to snapshot it for one-tap reuse.
        </div>
      )}
      {meals.map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => onLog(m.id)} style={{ ...hitStyle, flex: 1, padding: 0, borderBottom: 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={hitNameStyle}>{m.name}</div>
              <div style={hitMetaStyle}>
                <span>{(m.ingredients || []).length} item{(m.ingredients||[]).length === 1 ? '' : 's'}</span>
                <span> · {Math.round(m.total_kcal)} kcal</span>
                <span> · {Math.round(m.total_protein_g)}g P</span>
                {m.last_used_at && <span> · last used {new Date(m.last_used_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
              </div>
            </div>
            <span style={{ color: 'var(--accent-bright)', fontSize: 11, letterSpacing: '0.06em' }}>LOG → {mealSlot.toUpperCase()}</span>
          </button>
          <button
            onClick={() => onEdit && onEdit(m)}
            style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', color: 'var(--accent-bright)', fontSize: 10, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.06em', fontWeight: 600 }}
            title="Edit recipe"
          >EDIT</button>
          <button
            onClick={() => onDelete(m.id)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', padding: 4 }}
            title="Delete"
          >×</button>
        </div>
      ))}
    </div>
  );
}

function PlannerSlotsList({ slots, loading, mealSlot, onLogSlot }) {
  if (loading) return <div style={hintStyle}>Loading…</div>;
  if (!slots || slots.length === 0) {
    return (
      <div style={hintStyle}>
        Nothing on today's plan. Open your meal planner app to schedule meals — they'll appear here when you do.
      </div>
    );
  }
  return (
    <div style={listScrollStyle}>
      {slots.map((slot, i) => (
        <div key={i} style={{ padding: '12px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{slot.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {slot.mealTime} · {slot.cuisine || '—'} · serves {slot.servings}
              </div>
            </div>
            <button onClick={() => onLogSlot(slot)} className="fuel-btn fuel-btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
              Log 1 serving →
            </button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {slot.ingredients.map((ing, j) => {
              const m = resolveIngredientMacros(ing, slot.servings || 1);
              return (
                <span
                  key={j}
                  style={{
                    fontSize: 10, color: 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 6, padding: '2px 6px',
                  }}
                  title={m.resolved ? `${m.kcal} kcal/serving` : 'not in seed map'}
                >
                  {ing.n} <span style={{ color: 'var(--text-tertiary)' }}>{ing.q}{ing.u}</span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
        Logging into <strong>{mealSlot}</strong>.
      </div>
    </div>
  );
}

function RecentList({ recents, loading, tab, favorites, onPick, onSwitchToUsda }) {
  const filtered = tab === 'favorites'
    ? recents.filter((e) => favorites.some((f) => f.source === e.source && f.source_id === (e.source_id || null) && f.food_name === e.food_name))
    : recents;
  return (
    <div style={listScrollStyle}>
      {loading && <div style={hintStyle}>Loading…</div>}
      {!loading && filtered.length === 0 && tab === 'recent' && (
        <div style={hintStyle}>
          Nothing logged yet. <button onClick={onSwitchToUsda} style={{ background: 'transparent', border: 'none', color: 'var(--accent-bright)', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, padding: 0 }}>Search USDA</button> to add your first food.
        </div>
      )}
      {!loading && filtered.length === 0 && tab === 'favorites' && (
        <div style={hintStyle}>No favorites yet. Tap the star next to a logged food on the Today screen to favorite it.</div>
      )}
      {filtered.map((e) => (
        <button key={e.id} onClick={() => onPick(e)} style={hitStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={hitNameStyle}>{e.food_name}</div>
            <div style={hitMetaStyle}>
              <span>{e.serving_qty} × {e.serving_unit}</span>
              <span> · {Math.round(e.kcal)} kcal</span>
              <span> · {Math.round(e.protein_g)}g P</span>
            </div>
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>›</span>
        </button>
      ))}
    </div>
  );
}


const hitRowStyle = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 6,
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

const hitBodyStyle = {
  ...hitStyle,
  border: 'none',
  borderBottom: 'none',
  flex: 1,
};

const quickAddBtnStyle = {
  background: 'var(--accent-fill)',
  border: '1px solid var(--card-border)',
  color: 'var(--accent-bright)',
  width: 44,
  borderRadius: 10,
  fontSize: 22,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
  alignSelf: 'center',
  marginRight: 4,
};

const stepBtn = {
  background: 'var(--bg-elev-2)',
  border: '1px solid var(--card-border)',
  color: 'var(--text-primary)',
  width: 38, height: 38,
  borderRadius: 10,
  fontSize: 18, fontWeight: 600,
  cursor: 'pointer',
};
