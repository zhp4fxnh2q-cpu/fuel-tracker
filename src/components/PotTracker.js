/**
 * PotTracker — whole-pot density bowl tracker.
 *
 * Flow: build the pot from raw ingredients → weigh the cooked pot → weigh
 * the bowl → FUEL scales pot macros by (bowl_g / pot_g) and logs that
 * bowl as a single food_log entry. Handles cook-down automatically because
 * macros stay constant while water evaporates.
 */
import { useEffect, useRef, useState } from 'react';
import { searchUsda, getUsdaFood, detailFromSearchHit, macrosAtGrams, pickDefaultPortionIdx } from '../lib/usda';
import { addEntry, todayIso } from '../lib/foodLog';
import { SOURCE } from '../lib/constants';

const DEBOUNCE_MS = 300;

export default function PotTracker({ open, mealSlot, onClose, onLogged }) {
  const [step, setStep] = useState('build');
  const [pot, setPot] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [finalPotG, setFinalPotG] = useState('');
  const [bowlG, setBowlG] = useState('');
  const [saving, setSaving] = useState(false);
  const [potName, setPotName] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (open) {
      setStep('build'); setPot([]); setQuery(''); setResults([]);
      setError(null); setFinalPotG(''); setBowlG(''); setPotName('');
    }
  }, [open]);

  useEffect(() => {
    if (step !== 'search') return;
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const r = await searchUsda(query);
        setResults(r); setError(null);
      } catch (e) {
        setError(e.message); setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, step]);

  useEffect(() => {
    if (step === 'search') setTimeout(() => searchRef.current && searchRef.current.focus(), 60);
  }, [step]);

  const onAddToPot = async (hit) => {
    try {
      let detail;
      try { detail = await getUsdaFood(hit.fdcId); }
      catch (err) {
        if (err.status === 404) detail = detailFromSearchHit(hit);
        else throw err;
      }
      const idx = pickDefaultPortionIdx(detail.portions);
      const portion = detail.portions[idx];
      const qty = 1;
      const grams = portion.grams * qty;
      const macros = macrosAtGrams(detail.per100g, grams);
      setPot((prev) => [...prev, { id: `${detail.fdcId}-${Date.now()}`, food: detail, qty, portion, macros }]);
      setStep('build'); setQuery(''); setResults([]);
    } catch (e) { setError(e.message); }
  };

  const updateQty = (id, qty) => {
    setPot((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const newQty = Math.max(0, qty);
        const grams = it.portion.grams * newQty;
        return { ...it, qty: newQty, macros: macrosAtGrams(it.food.per100g, grams) };
      })
    );
  };

  const removeItem = (id) => setPot((prev) => prev.filter((it) => it.id !== id));

  const potTotals = pot.reduce(
    (a, it) => ({
      kcal: a.kcal + (it.macros.kcal || 0),
      protein_g: a.protein_g + (it.macros.protein_g || 0),
      carbs_g: a.carbs_g + (it.macros.carbs_g || 0),
      fat_g: a.fat_g + (it.macros.fat_g || 0),
      fiber_g: a.fiber_g + (it.macros.fiber_g || 0),
      sodium_mg: a.sodium_mg + (it.macros.sodium_mg || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 }
  );

  const finalPotNum = Number(finalPotG);
  const bowlNum = Number(bowlG);
  const validWeights = finalPotNum > 0 && bowlNum > 0 && bowlNum <= finalPotNum * 3;
  const fraction = validWeights ? bowlNum / finalPotNum : 0;
  const bowlMacros = {
    kcal: Math.round(potTotals.kcal * fraction),
    protein_g: r1(potTotals.protein_g * fraction),
    carbs_g: r1(potTotals.carbs_g * fraction),
    fat_g: r1(potTotals.fat_g * fraction),
    fiber_g: r1(potTotals.fiber_g * fraction),
    sodium_mg: r1(potTotals.sodium_mg * fraction),
  };

  const logBowl = async () => {
    if (!validWeights || pot.length === 0) return;
    setSaving(true);
    const entry = {
      date: todayIso(),
      meal_slot: mealSlot,
      food_name: potName.trim() || `Pot bowl (${pot.length} ingredients)`,
      serving_qty: 1,
      serving_unit: `bowl (${Math.round(bowlNum)} g of ${Math.round(finalPotNum)} g pot)`,
      ...bowlMacros,
      source: SOURCE.MANUAL,
      source_id: null,
    };
    const res = await addEntry(entry);
    setSaving(false);
    if (res.ok) {
      if (onLogged) onLogged(entry);
      onClose();
    } else {
      setError((res.error && res.error.message) || 'Save failed');
    }
  };

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={sheet}>
        <div style={header}>
          {step === 'search' ? (
            <button onClick={() => setStep('build')} style={hbtn}>‹ Back</button>
          ) : (
            <button onClick={onClose} style={hbtn}>Cancel</button>
          )}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div className="fuel-page-title" style={{ margin: 0 }}>{step === 'search' ? 'Add ingredient' : 'Bowl from pot'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{mealSlot}</div>
          </div>
          <button onClick={onClose} style={hbtn}>×</button>
        </div>

        {step === 'build' && (
          <div style={{ padding: '0 16px 24px', overflowY: 'auto' }}>
            <div className="fuel-label" style={{ marginBottom: 6 }}>Pot ingredients</div>

            {pot.length === 0 && (
              <div style={hint}>
                Build the pot. Add raw ingredients with quantities, then weigh the cooked pot and your bowl.
              </div>
            )}

            {pot.map((it) => (
              <div key={it.id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{it.food.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {it.qty} × {it.portion.label} · {it.macros.kcal} kcal · {it.macros.protein_g}g P
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => updateQty(it.id, Number((it.qty - 0.25).toFixed(2)))} style={step1}>−</button>
                  <input type="number" value={it.qty} step="0.25" min="0"
                    onChange={(e) => updateQty(it.id, Number(e.target.value || 0))}
                    style={{ ...qtyInput, width: 56 }} />
                  <button onClick={() => updateQty(it.id, Number((it.qty + 0.25).toFixed(2)))} style={step1}>+</button>
                  <button onClick={() => removeItem(it.id)} style={del} title="Remove">×</button>
                </div>
              </div>
            ))}

            <button onClick={() => setStep('search')} className="fuel-btn"
              style={{ width: '100%', marginTop: 12, padding: '12px', fontSize: 14 }}>
              + Add ingredient
            </button>

            {pot.length > 0 && (
              <div>
                <div style={tot}>
                  <div className="fuel-label">Pot totals (raw)</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    <strong>{Math.round(potTotals.kcal)} kcal</strong>
                    {' · '}{r1(potTotals.protein_g)}g P
                    {' · '}{r1(potTotals.carbs_g)}g C
                    {' · '}{r1(potTotals.fat_g)}g F
                  </div>
                </div>

                <div className="fuel-label" style={{ marginTop: 18, marginBottom: 6 }}>Recipe name (optional)</div>
                <input type="text" value={potName}
                  onChange={(e) => setPotName(e.target.value)}
                  placeholder="e.g. Ropa Vieja"
                  style={txtInput} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                  <label>
                    <div className="fuel-label" style={{ marginBottom: 4 }}>Final pot (g)</div>
                    <input type="number" inputMode="numeric" value={finalPotG}
                      onChange={(e) => setFinalPotG(e.target.value)}
                      placeholder="3200" style={txtInput} />
                  </label>
                  <label>
                    <div className="fuel-label" style={{ marginBottom: 4 }}>Your bowl (g)</div>
                    <input type="number" inputMode="numeric" value={bowlG}
                      onChange={(e) => setBowlG(e.target.value)}
                      placeholder="450" style={txtInput} />
                  </label>
                </div>

                {validWeights && (
                  <div style={{ ...tot, marginTop: 14, borderColor: 'var(--accent-bright)', background: 'rgba(52,211,153,0.06)' }}>
                    <div className="fuel-label" style={{ color: 'var(--accent-bright)' }}>
                      Your bowl ({(fraction * 100).toFixed(1)}% of pot)
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600 }}>
                      {bowlMacros.kcal} kcal
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {bowlMacros.protein_g}g P · {bowlMacros.carbs_g}g C · {bowlMacros.fat_g}g F · {bowlMacros.fiber_g}g fiber
                    </div>
                  </div>
                )}

                {error && <div style={err}>{error}</div>}

                <button onClick={logBowl}
                  disabled={!validWeights || saving || pot.length === 0}
                  className="fuel-btn fuel-btn-primary"
                  style={{ width: '100%', marginTop: 14, padding: '14px', fontSize: 15 }}>
                  {saving ? 'Saving…' : `Log bowl to ${mealSlot}`}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'search' && (
          <div style={{ padding: '0 16px 24px', overflowY: 'auto' }}>
            <input ref={searchRef} type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search USDA — onion, chuck roast, black beans…"
              style={{ ...txtInput, padding: '12px 14px', fontSize: 15 }} />
            {error && <div style={err}>{error}</div>}
            {searching && <div style={hint}>Searching…</div>}
            {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
              <div style={hint}>No matches.</div>
            )}
            {!searching && query.trim().length < 2 && (
              <div style={hint}>Type at least 2 characters.</div>
            )}
            {results.map((hit) => (
              <button key={hit.fdcId} onClick={() => onAddToPot(hit)} style={hitRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{hit.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {hit.dataType} · {Math.round(hit.per100g.kcal || 0)} kcal · {Math.round(hit.per100g.protein_g || 0)}g P / 100g
                  </div>
                </div>
                <span style={{ color: 'var(--accent-bright)', fontSize: 20, fontWeight: 600 }}>+</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function r1(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

const overlay = { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const sheet = { width: '100%', maxWidth: '36rem', height: '92vh', background: 'var(--bg-elev-1)', borderTopLeftRadius: 18, borderTopRightRadius: 18, border: '1px solid var(--card-border)', borderBottom: 'none', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' };
const header = { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px 10px', borderBottom: '1px solid var(--card-border)' };
const hbtn = { background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', minWidth: 56 };
const hint = { padding: '20px 8px', color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 };
const row = { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' };
const step1 = { background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', width: 28, height: 28, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const qtyInput = { background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '4px 6px', borderRadius: 6, fontSize: 13, textAlign: 'center', outline: 'none' };
const del = { background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer', padding: '0 4px' };
const txtInput = { width: '100%', background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const tot = { marginTop: 12, padding: 12, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10 };
const hitRow = { width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 8px', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer' };
const err = { margin: '8px 0', padding: '8px 12px', background: 'var(--danger-fill)', border: '1px solid rgba(239,68,68,0.32)', color: 'var(--danger)', borderRadius: 8, fontSize: 12 };
