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
import { searchUsda, getUsdaFood, macrosAtGrams, detailFromSearchHit } from '../lib/usda';
import { addEntry, todayIso } from '../lib/foodLog';
import { SOURCE } from '../lib/constants';

const DEBOUNCE_MS = 300;
const TABS = [
  { id: 'usda', label: 'USDA', enabled: true },
  { id: 'recent', label: 'Recent', enabled: false },
  { id: 'favorites', label: 'Favorites', enabled: false },
  { id: 'saved', label: 'Saved meals', enabled: false },
  { id: 'meal_planner', label: 'Meal planner', enabled: false },
];

export default function AddFoodSheet({ open, mealSlot, onClose, onLogged }) {
  const [tab, setTab] = useState('usda');
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

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep('search');
      setQuery('');
      setResults([]);
      setError(null);
      setFoodDetail(null);
      setPortionIdx(0);
      setAmount(1);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Debounced search
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
      setPortionIdx(detail.portions.length > 2 ? 2 : 0); // prefer first natural portion
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

            <div style={{ padding: '0 16px 12px' }}>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search USDA — eggs, chicken breast, oatmeal…"
                style={searchInputStyle}
              />
            </div>

            <div style={listScrollStyle}>
              {error && <div style={errorBoxStyle}>{error}</div>}
              {searching && <div style={hintStyle}>Searching…</div>}
              {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
                <div style={hintStyle}>No matches. Try a different term.</div>
              )}
              {!searching && query.trim().length < 2 && (
                <div style={hintStyle}>Type at least 2 characters to search USDA's food database.</div>
              )}
              {results.map((hit) => (
                <button key={hit.fdcId} onClick={() => onPick(hit)} style={hitStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={hitNameStyle}>{hit.name}</div>
                    <div style={hitMetaStyle}>
                      <span style={dataTypeBadge(hit.dataType)}>{hit.dataType}</span>
                      {hit.brand && <span> · {hit.brand}</span>}
                      <span> · {Math.round(hit.per100g.kcal || 0)} kcal · {Math.round(hit.per100g.protein_g || 0)}g P / 100g</span>
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>›</span>
                </button>
              ))}
            </div>
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

const stepBtn = {
  background: 'var(--bg-elev-2)',
  border: '1px solid var(--card-border)',
  color: 'var(--text-primary)',
  width: 38, height: 38,
  borderRadius: 10,
  fontSize: 18, fontWeight: 600,
  cursor: 'pointer',
};
