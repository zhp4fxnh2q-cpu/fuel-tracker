/**
 * DescribeMealSheet — "I just ate X" → AI parses → resolves each item via
 * USDA → user reviews + confirms → log all in one batch.
 *
 * Calls /api/llm/parse-meal then /api/usda/search per item for resolution.
 */
import { useEffect, useRef, useState } from 'react';
import { searchUsda, getUsdaFood, detailFromSearchHit, macrosAtGrams } from '../lib/usda';
import { addEntry, todayIso } from '../lib/foodLog';
import { SOURCE } from '../lib/constants';

export default function DescribeMealSheet({ open, mealSlot, onClose, onLogged }) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [logging, setLogging] = useState(false);
  const [items, setItems] = useState([]); // [{ ingredient, qty, unit, resolution }]
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setText(''); setItems([]); setError(null);
      setParsing(false); setResolving(false); setLogging(false);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 80);
    }
  }, [open]);

  const onParse = async () => {
    if (!text.trim() || parsing) return;
    setParsing(true); setError(null); setItems([]);
    try {
      const r = await fetch('/api/llm/parse-meal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      const raw = await r.text();
      if (raw.trim().startsWith('<')) throw new Error('Function not deployed');
      const data = JSON.parse(raw);
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const initial = (data.items || []).map((it) => ({ ...it, resolution: null, picked: true }));
      setItems(initial);
      // Kick off resolution in the background
      resolveAll(initial);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setParsing(false);
    }
  };

  const resolveAll = async (its) => {
    setResolving(true);
    const next = [...its];
    for (let i = 0; i < next.length; i++) {
      const it = next[i];
      try {
        const results = await searchUsda(it.ingredient);
        if (!results || results.length === 0) { next[i] = { ...it, resolution: { error: 'no USDA hit' } }; continue; }
        const hit = results[0];
        let detail;
        try { detail = await getUsdaFood(hit.fdcId); }
        catch (e) {
          if (e.status === 404) detail = detailFromSearchHit(hit);
          else { next[i] = { ...it, resolution: { error: e.message } }; continue; }
        }
        const portion = pickPortionFor(it.unit, detail.portions);
        const grams = portion.grams * (Number(it.qty) || 1);
        const macros = macrosAtGrams(detail.per100g, grams);
        next[i] = { ...it, resolution: { detail, portion, grams, macros } };
      } catch (e) {
        next[i] = { ...it, resolution: { error: e.message } };
      }
      setItems([...next]);
    }
    setResolving(false);
  };

  const togglePick = (idx) =>
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, picked: !it.picked } : it));

  const editQty = (idx, qty) =>
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const newQty = Math.max(0, Number(qty) || 0);
      if (!it.resolution || !it.resolution.detail) return { ...it, qty: newQty };
      const grams = it.resolution.portion.grams * newQty;
      return {
        ...it,
        qty: newQty,
        resolution: {
          ...it.resolution,
          grams,
          macros: macrosAtGrams(it.resolution.detail.per100g, grams),
        },
      };
    }));

  const onLogAll = async () => {
    if (logging) return;
    const toLog = items.filter((it) => it.picked && it.resolution && it.resolution.detail);
    if (toLog.length === 0) return;
    setLogging(true);
    setError(null);
    let failures = 0;
    for (const it of toLog) {
      const entry = {
        date: todayIso(),
        meal_slot: mealSlot,
        food_name: it.resolution.detail.name,
        serving_qty: it.qty || 1,
        serving_unit: `${it.unit || 'serving'} (${Math.round(it.resolution.grams)} g)`,
        ...it.resolution.macros,
        source: SOURCE.AI_ESTIMATE,
        source_id: String(it.resolution.detail.fdcId),
      };
      const r = await addEntry(entry);
      if (!r.ok) failures++;
    }
    setLogging(false);
    if (failures === 0) {
      if (onLogged) onLogged();
      onClose();
    } else {
      setError(`Logged ${toLog.length - failures} of ${toLog.length}; ${failures} failed.`);
    }
  };

  const totals = items.filter((it) => it.picked && it.resolution && it.resolution.macros)
    .reduce(
      (a, it) => ({
        kcal: a.kcal + (it.resolution.macros.kcal || 0),
        protein_g: a.protein_g + (it.resolution.macros.protein_g || 0),
        carbs_g: a.carbs_g + (it.resolution.macros.carbs_g || 0),
        fat_g: a.fat_g + (it.resolution.macros.fat_g || 0),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={sheet}>
        <div style={header}>
          <button onClick={onClose} style={hbtn}>Cancel</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div className="fuel-page-title" style={{ margin: 0 }}>Describe a meal</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{mealSlot}</div>
          </div>
          <button onClick={onClose} style={hbtn}>×</button>
        </div>

        <div style={{ padding: '0 16px 24px', overflowY: 'auto' }}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="2 eggs and a banana with a tbsp of peanut butter"
            rows={3}
            style={taStyle}
            disabled={parsing || logging}
          />
          <button
            onClick={onParse}
            disabled={!text.trim() || parsing || logging}
            className="fuel-btn fuel-btn-primary"
            style={{ width: '100%', marginTop: 10, padding: '12px', fontSize: 14 }}
          >
            {parsing ? 'Parsing…' : 'Parse'}
          </button>

          {error && <div style={err}>{error}</div>}

          {items.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="fuel-label" style={{ marginBottom: 6 }}>
                Parsed items {resolving && <span style={{ color: 'var(--text-tertiary)' }}>· resolving…</span>}
              </div>
              {items.map((it, i) => (
                <div key={i} style={itemRow}>
                  <input
                    type="checkbox"
                    checked={!!it.picked}
                    onChange={() => togglePick(i)}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {it.resolution && it.resolution.detail ? it.resolution.detail.name : it.ingredient}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      <input
                        type="number"
                        value={it.qty}
                        step="0.25"
                        min="0"
                        onChange={(e) => editQty(i, e.target.value)}
                        style={qtyInline}
                      />
                      {' '}
                      {it.resolution && it.resolution.portion ? it.resolution.portion.label : it.unit}
                      {it.resolution && it.resolution.macros && (
                        <> · {it.resolution.macros.kcal} kcal · {it.resolution.macros.protein_g}g P</>
                      )}
                      {it.resolution && it.resolution.error && (
                        <span style={{ color: 'var(--warn)' }}> · {it.resolution.error}</span>
                      )}
                      {!it.resolution && <span style={{ color: 'var(--text-tertiary)' }}> · …</span>}
                    </div>
                  </div>
                </div>
              ))}

              {totals.kcal > 0 && (
                <div style={totBox}>
                  Selected: <strong>{Math.round(totals.kcal)} kcal</strong>
                  {' · '}{r1(totals.protein_g)}g P
                  {' · '}{r1(totals.carbs_g)}g C
                  {' · '}{r1(totals.fat_g)}g F
                </div>
              )}

              <button
                onClick={onLogAll}
                disabled={logging || resolving || items.every((it) => !(it.picked && it.resolution && it.resolution.detail))}
                className="fuel-btn fuel-btn-primary"
                style={{ width: '100%', marginTop: 14, padding: '12px', fontSize: 14 }}
              >
                {logging ? 'Logging…' : `Log selected to ${mealSlot}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function r1(n) { return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; }

function pickPortionFor(unit, portions) {
  if (!portions || portions.length === 0) return { label: '100 g', grams: 100 };
  const u = String(unit || '').toLowerCase().trim();
  if (!u || u === 'g' || u === 'gram' || u === 'grams') return portions[0];
  const base = u.replace(/s$/, '');
  for (const p of portions) if (p.label.toLowerCase().includes(base) && base.length >= 2) return p;
  // For "large/medium/small/slice/piece" prefer those keywords in portion labels
  for (const p of portions) if (p.label.toLowerCase().includes('large') && u === 'large') return p;
  return portions[Math.min(2, portions.length - 1)] || portions[0];
}

const overlay = { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const sheet = { width: '100%', maxWidth: '36rem', height: '92vh', background: 'var(--bg-elev-1)', borderTopLeftRadius: 18, borderTopRightRadius: 18, border: '1px solid var(--card-border)', borderBottom: 'none', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' };
const header = { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px 10px', borderBottom: '1px solid var(--card-border)' };
const hbtn = { background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', minWidth: 56 };
const taStyle = { width: '100%', background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' };
const itemRow = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' };
const qtyInline = { background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '1px 4px', borderRadius: 4, fontSize: 11, width: 50, textAlign: 'center', outline: 'none' };
const totBox = { marginTop: 12, padding: 10, background: 'var(--accent-fill)', border: '1px solid var(--accent-bright)', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)' };
const err = { margin: '10px 0', padding: '8px 12px', background: 'var(--danger-fill)', border: '1px solid rgba(239,68,68,0.32)', color: 'var(--danger)', borderRadius: 8, fontSize: 12 };
