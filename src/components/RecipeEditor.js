/**
 * RecipeEditor — view + edit a saved recipe's ingredients and totals.
 *
 * Tap a saved meal → opens this. You can:
 *   • Edit the recipe name
 *   • Per ingredient: edit qty, swap to a different USDA food, delete
 *   • Add a new ingredient via USDA search
 *
 * Totals recompute live. On Save, the row in fuel_saved_meals is updated.
 */
import { useEffect, useState } from 'react';
import { searchUsda, getUsdaFood, detailFromSearchHit, pickDefaultPortionIdx } from '../lib/usda';
import { updateSavedMeal, recomputeIngredientFromFdc } from '../lib/recipeImport';
import { supabase, SHARED_USER_ID } from '../supabaseClient';

export default function RecipeEditor({ open, meal, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState(null); // index of ingredient to replace, or 'new' for add
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && meal) {
      setName(meal.name || '');
      setIngredients(Array.isArray(meal.ingredients) ? [...meal.ingredients] : []);
      setSearchOpen(false);
      setSearchTarget(null);
      setError(null);
    }
  }, [open, meal]);

  const totals = ingredients.reduce(
    (a, i) => ({
      kcal: a.kcal + (i.kcal || 0),
      protein_g: a.protein_g + (i.protein_g || 0),
      carbs_g: a.carbs_g + (i.carbs_g || 0),
      fat_g: a.fat_g + (i.fat_g || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const updateQty = (idx, qty) => {
    setIngredients((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const newQty = Math.max(0, Number(qty) || 0);
        const ratio = it.qty > 0 ? newQty / it.qty : 0;
        // Scale macros proportionally — simpler than re-fetching USDA per edit
        return {
          ...it,
          qty: newQty,
          grams: round1(it.grams * ratio),
          kcal: round1(it.kcal * ratio),
          protein_g: round1(it.protein_g * ratio),
          carbs_g: round1(it.carbs_g * ratio),
          fat_g: round1(it.fat_g * ratio),
          fiber_g: round1((it.fiber_g || 0) * ratio),
          sodium_mg: round1((it.sodium_mg || 0) * ratio),
        };
      })
    );
  };

  const removeIngredient = (idx) =>
    setIngredients((prev) => prev.filter((_, i) => i !== idx));

  const swapIngredient = async (hit, idx) => {
    try {
      let detail;
      try { detail = await getUsdaFood(hit.fdcId); }
      catch (err) {
        if (err.status === 404) detail = detailFromSearchHit(hit);
        else throw err;
      }
      const oldIng = idx === 'new' ? null : ingredients[idx];
      const portionIdx = pickDefaultPortionIdx(detail.portions);
      const portion = detail.portions[portionIdx];
      const qty = oldIng ? (oldIng.qty || 1) : 1;
      const replacement = recomputeIngredientFromFdc(detail, qty, portion);
      // Keep the meal-planner display name if we're swapping
      if (oldIng && oldIng.name) replacement.name = oldIng.name;
      if (idx === 'new') {
        setIngredients((prev) => [...prev, replacement]);
      } else {
        setIngredients((prev) => prev.map((it, i) => (i === idx ? replacement : it)));
      }
      setSearchOpen(false);
      setSearchTarget(null);
    } catch (e) { setError(e.message); }
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const r = await updateSavedMeal(meal.id, { name, ingredients });
    setSaving(false);
    if (r.ok) {
      if (onSaved) onSaved();
      onClose();
    } else {
      setError(r.error?.message || 'Save failed');
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    setSaving(true);
    const { error: err } = await supabase
      .from('fuel_saved_meals')
      .delete()
      .eq('id', meal.id)
      .eq('user_id', SHARED_USER_ID);
    setSaving(false);
    if (err) setError(err.message);
    else { if (onSaved) onSaved(); onClose(); }
  };

  if (!open || !meal) return null;

  return (
    <div style={overlay}>
      <div style={sheet}>
        <div style={header}>
          <button onClick={onClose} style={hbtn}>Cancel</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div className="fuel-page-title" style={{ margin: 0 }}>Edit recipe</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {Math.round(totals.kcal)} kcal · {r1(totals.protein_g)}g P
            </div>
          </div>
          <button onClick={onClose} style={hbtn}>×</button>
        </div>

        <div style={{ padding: '0 16px 24px', overflowY: 'auto' }}>
          <div className="fuel-label" style={{ marginBottom: 4 }}>Recipe name</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={txtInput}
          />

          {meal.description && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
              {meal.description}
            </div>
          )}

          <div className="fuel-label" style={{ marginTop: 16, marginBottom: 8 }}>
            Ingredients ({ingredients.length})
          </div>

          {ingredients.map((it, i) => (
            <div key={i} style={ingRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{it.name}</div>
                {it.usda_name && it.usda_name !== it.name && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    → {it.usda_name}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  <input
                    type="number"
                    value={it.qty}
                    step="0.25"
                    min="0"
                    onChange={(e) => updateQty(i, e.target.value)}
                    style={qtyInline}
                  />
                  {' '}{it.unit || it.portion_label || ''}
                  {' '}· {it.grams ? `${Math.round(it.grams)}g · ` : ''}{Math.round(it.kcal)} kcal
                  {it.unresolved && <span style={{ color: 'var(--warn)' }}> · NO MATCH</span>}
                </div>
              </div>
              <button
                onClick={() => { setSearchTarget(i); setSearchOpen(true); }}
                style={smallBtn}
                title="Swap USDA match"
              >Swap</button>
              <button
                onClick={() => removeIngredient(i)}
                style={delBtn}
                title="Remove"
              >×</button>
            </div>
          ))}

          <button
            onClick={() => { setSearchTarget('new'); setSearchOpen(true); }}
            className="fuel-btn"
            style={{ width: '100%', marginTop: 10, padding: '10px', fontSize: 13 }}
          >
            + Add ingredient
          </button>

          {error && <div style={errStyle}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
            <button
              onClick={onDelete}
              disabled={saving}
              className="fuel-btn fuel-btn-ghost"
              style={{ padding: '12px', fontSize: 13, color: 'var(--danger)' }}
            >
              Delete recipe
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="fuel-btn fuel-btn-primary"
              style={{ padding: '12px', fontSize: 13 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {searchOpen && (
          <SwapSearchSheet
            onClose={() => { setSearchOpen(false); setSearchTarget(null); }}
            onPick={(hit) => swapIngredient(hit, searchTarget)}
          />
        )}
      </div>
    </div>
  );
}

function SwapSearchSheet({ onClose, onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setBusy(true);
    const handle = setTimeout(async () => {
      try {
        const r = await searchUsda(q);
        setResults(r);
      } catch { setResults([]); }
      finally { setBusy(false); }
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div style={{ ...overlay, zIndex: 250 }}>
      <div style={sheet}>
        <div style={header}>
          <button onClick={onClose} style={hbtn}>Cancel</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div className="fuel-page-title" style={{ margin: 0 }}>Pick USDA match</div>
          </div>
          <button onClick={onClose} style={hbtn}>×</button>
        </div>
        <div style={{ padding: '0 16px 24px', overflowY: 'auto' }}>
          <input
            type="text"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search USDA…"
            style={{ ...txtInput, padding: '12px 14px', fontSize: 15 }}
          />
          {busy && <div style={{ padding: 16, color: 'var(--text-tertiary)', fontSize: 12 }}>Searching…</div>}
          {results.map((hit) => (
            <button key={hit.fdcId} onClick={() => onPick(hit)} style={resultRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{hit.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {hit.dataType} · {Math.round(hit.per100g.kcal || 0)} kcal/100g
                </div>
              </div>
              <span style={{ color: 'var(--accent-bright)', fontSize: 20, fontWeight: 600 }}>+</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function r1(n) { return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; }
function round1(n) { return r1(n); }

const overlay = { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const sheet = { width: '100%', maxWidth: '36rem', height: '92vh', background: 'var(--bg-elev-1)', borderTopLeftRadius: 18, borderTopRightRadius: 18, border: '1px solid var(--card-border)', borderBottom: 'none', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' };
const header = { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px 10px', borderBottom: '1px solid var(--card-border)' };
const hbtn = { background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', minWidth: 56 };
const txtInput = { width: '100%', background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const ingRow = { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' };
const qtyInline = { background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '1px 4px', borderRadius: 4, fontSize: 11, width: 56, textAlign: 'center', outline: 'none' };
const smallBtn = { background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', color: 'var(--accent-bright)', padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', letterSpacing: '0.06em', fontWeight: 600 };
const delBtn = { background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', padding: '0 4px' };
const errStyle = { margin: '10px 0', padding: '8px 12px', background: 'var(--danger-fill)', border: '1px solid rgba(239,68,68,0.32)', color: 'var(--danger)', borderRadius: 8, fontSize: 12 };
const resultRow = { width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 8px', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer' };
