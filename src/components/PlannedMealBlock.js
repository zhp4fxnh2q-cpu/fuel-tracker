/**
 * PlannedMealBlock — Today screen card that shows a meal-planner-scheduled
 * meal with pre-portioned ingredients and a one-tap "Log this meal" button.
 *
 * Phase F adds the AI recipe-edit agent: a small text input at the bottom of
 * the card. The user types a free-form change ("swap chicken for tilapia",
 * "skip the avocado", "double the rice"), and the LLM converts that into
 * structured operations (swap / adjust / remove / add) that we apply to the
 * local ingredient list. Macros recompute live.
 *
 * Scope is tracked but persistence ('always') is not wired yet — the seed
 * map is bundled in the build. The AI applies in-memory edits to "today"
 * scope only at this phase.
 */
import { useState } from 'react';
import {
  resolveIngredientMacros,
  slotTotalMacros,
  buildLogEntriesForSlot,
} from '../lib/mealPlanner';
import { addEntry, todayIso } from '../lib/foodLog';
import { supabase, SHARED_USER_ID } from '../supabaseClient';

export default function PlannedMealBlock({ plan, slot, onAddPrefilled, onAfterLogAll }) {
  // Local edit state — if non-null, supersedes plan.ingredients for display
  // and for the log builder. Reset to null when plan changes.
  const [editedIngredients, setEditedIngredients] = useState(null);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [logging, setLogging] = useState(false);
  const [logErr, setLogErr] = useState(null);
  const [locking, setLocking] = useState(false);
  const [lockMsg, setLockMsg] = useState(null);

  // Build the effective plan — possibly with overridden ingredients.
  const effectiveIngredients = editedIngredients || plan.ingredients;
  const effectivePlan = { ...plan, ingredients: effectiveIngredients };
  const totals = slotTotalMacros(effectivePlan);

  const allIngredients = [
    ...effectiveIngredients.map((ing) => ({ ing, sideName: null })),
    ...(plan.sides || []).flatMap((side) =>
      (side.ingredients || []).map((ing) => ({ ing, sideName: side.name }))
    ),
  ];

  const onLogAll = async () => {
    if (logging) return;
    setLogging(true);
    setLogErr(null);
    const rows = buildLogEntriesForSlot(effectivePlan, todayIso(), slot);
    let failures = 0;
    for (const row of rows) {
      const r = await addEntry(row);
      if (!r.ok) failures++;
    }
    setLogging(false);
    if (failures > 0) {
      setLogErr(`Logged ${rows.length - failures} of ${rows.length}; ${failures} failed.`);
    }
    if (onAfterLogAll) onAfterLogAll();
  };

  const onAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiText.trim() || aiBusy) return;
    setAiBusy(true);
    setAiErr(null);
    setAiSummary(null);
    try {
      const res = await fetch('/api/llm/recipe-edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mealId: plan.mealId,
          mealName: plan.name,
          servings: plan.servings,
          ingredients: effectiveIngredients,
          userText: aiText.trim(),
        }),
      });
      const raw = await res.text();
      if (raw.trim().startsWith('<')) throw new Error('Function not deployed');
      const data = JSON.parse(raw);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const next = applyOperations(effectiveIngredients, data.operations || []);
      setEditedIngredients(next);
      setAiSummary(data.summary || 'Applied.');
      setAiText('');
    } catch (err) {
      setAiErr(err.message || String(err));
    } finally {
      setAiBusy(false);
    }
  };

  // Persist AI edits to the corresponding fuel_saved_meals row.
  // Matches by recipe name (case-insensitive). If no match exists, tells
  // the user to run the recipe import first.
  const lockInEdits = async () => {
    if (locking || !editedIngredients) return;
    setLocking(true);
    setLockMsg(null);
    try {
      const name = plan.name || '';
      const { data, error: findErr } = await supabase
        .from('fuel_saved_meals')
        .select('id, ingredients')
        .eq('user_id', SHARED_USER_ID)
        .ilike('name', name);
      if (findErr) throw findErr;
      if (!data || data.length === 0) {
        setLockMsg('No saved recipe matches this name. Run "Import meal-planner recipes" in Settings first.');
        return;
      }
      // Convert the edited per-recipe ingredients (qty already per-serving)
      // into the saved-meal format. Recompute macros via per100g/grams later
      // if needed; for now, write the {n,q,u} edits as-is.
      const target = data[0];
      const merged = (target.ingredients || []).map((it) => {
        const match = editedIngredients.find((e) => (e.n || '').toLowerCase() === (it.name || '').toLowerCase());
        if (!match) return it;
        return { ...it, name: match.n, qty: match.q, unit: match.u };
      });
      // Also append any ingredients the AI added that weren't in the original
      const existingNames = new Set((target.ingredients || []).map((i) => (i.name || '').toLowerCase()));
      for (const e of editedIngredients) {
        if (!existingNames.has((e.n || '').toLowerCase())) {
          merged.push({ name: e.n, qty: e.q, unit: e.u, fdcId: null, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0, source: 'ai_added' });
        }
      }
      const { error: updateErr } = await supabase
        .from('fuel_saved_meals')
        .update({ ingredients: merged })
        .eq('id', target.id);
      if (updateErr) throw updateErr;
      setLockMsg('Locked into your saved recipe. Edit any per-ingredient details in Settings → Saved tab.');
    } catch (e) {
      setLockMsg('Save failed: ' + (e.message || String(e)));
    } finally {
      setLocking(false);
    }
  };

  const onResetEdits = () => {
    setEditedIngredients(null);
    setAiSummary(null);
    setAiErr(null);
  };

  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(52,211,153,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--accent-bright)', textTransform: 'uppercase', fontWeight: 600 }}>Planned</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>· {plan.name}</span>
        {plan.cuisine && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {plan.cuisine}</span>}
        {editedIngredients && (
          <span style={{ fontSize: 10, color: 'var(--accent-bright)', marginLeft: 'auto' }}>EDITED</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
        <strong style={{ color: 'var(--text-primary)' }}>{totals.kcal} kcal</strong>
        {' · '}{totals.protein_g}g P · {totals.carbs_g}g C · {totals.fat_g}g F
        <span style={{ color: 'var(--text-tertiary)' }}> · 1 serving (of {plan.servings})</span>
        {totals.unresolved > 0 && (
          <span style={{ color: 'var(--warn)' }}> · {totals.unresolved} unresolved</span>
        )}
      </div>
      {plan.notes && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4, fontStyle: 'italic' }}>
          {plan.notes}
        </div>
      )}

      <button
        onClick={onLogAll}
        disabled={logging}
        className="fuel-btn fuel-btn-primary"
        style={{ width: '100%', padding: '10px 14px', marginBottom: 8, fontSize: 13 }}
      >
        {logging ? 'Logging…' : `Log this meal (${totals.kcal} kcal)`}
      </button>
      {logErr && <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 8 }}>{logErr}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {allIngredients.map(({ ing, sideName }, i) => {
          const macro = resolveIngredientMacros(ing, plan.servings || 1);
          return (
            <button
              key={`${ing.n}-${i}`}
              onClick={() => onAddPrefilled(ing.n)}
              style={{
                background: macro.resolved ? 'rgba(255,255,255,0.04)' : 'rgba(245,158,11,0.10)',
                border: '1px solid var(--card-border)',
                borderRadius: 8, padding: '4px 8px',
                fontSize: 11, color: 'var(--text-primary)',
                cursor: 'pointer', textAlign: 'left',
              }}
              title={macro.resolved
                ? `${ing.q} ${ing.u} ÷ ${plan.servings} = ${Math.round(macro.grams)}g · ${macro.kcal} kcal`
                : `${ing.n} — not in USDA seed map`}
            >
              {sideName && <span style={{ color: 'var(--text-tertiary)' }}>[{sideName}] </span>}
              {ing.n}
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>{ing.q} {ing.u}</span>
              {macro.resolved && (
                <span style={{ color: 'var(--accent-bright)', marginLeft: 4 }}>{macro.kcal}k</span>
              )}
            </button>
          );
        })}
      </div>

      {/* AI recipe-edit chat */}
      <form onSubmit={onAiSubmit} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <input
          type="text"
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          placeholder="Change something? e.g. swap chicken for tilapia"
          disabled={aiBusy}
          style={{
            flex: 1,
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-primary)',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={aiBusy || !aiText.trim()}
          className="fuel-btn"
          style={{ padding: '6px 12px', fontSize: 12 }}
        >
          {aiBusy ? '…' : 'Apply'}
        </button>
        {editedIngredients && !aiBusy && (
          <>
            <button
              type="button"
              onClick={lockInEdits}
              disabled={locking}
              className="fuel-btn"
              style={{ padding: '6px 10px', fontSize: 12, color: 'var(--accent-bright)' }}
              title="Save these edits to the saved recipe"
            >
              {locking ? 'Saving…' : 'Lock in'}
            </button>
            <button
              type="button"
              onClick={onResetEdits}
              className="fuel-btn fuel-btn-ghost"
              style={{ padding: '6px 10px', fontSize: 12 }}
              title="Reset to planner's version"
            >
              Reset
            </button>
          </>
        )}
      </form>
      {aiSummary && (
        <div style={{ fontSize: 11, color: 'var(--accent-bright)', marginTop: 6 }}>
          {aiSummary}
        </div>
      )}
      {lockMsg && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
          {lockMsg}
        </div>
      )}
      {aiErr && (
        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>
          {aiErr}
        </div>
      )}
    </div>
  );
}

/** Apply the LLM's operations to a list of ingredients. Pure function. */
function applyOperations(ingredients, operations) {
  let next = ingredients.map((i) => ({ ...i }));
  for (const op of operations || []) {
    if (!op || typeof op.action !== 'string') continue;
    const action = op.action.toLowerCase();
    if (action === 'remove') {
      next = next.filter((i) => !nameMatches(i.n, op.target));
    } else if (action === 'swap') {
      next = next.map((i) =>
        nameMatches(i.n, op.from)
          ? { ...i, n: op.to || i.n, q: op.q ?? i.q, u: op.u || i.u }
          : i
      );
    } else if (action === 'adjust') {
      next = next.map((i) =>
        nameMatches(i.n, op.target)
          ? { ...i, q: op.q ?? i.q, u: op.u || i.u }
          : i
      );
    } else if (action === 'add') {
      if (op.n) next.push({ n: op.n, q: op.q ?? 1, u: op.u || 'each', c: 'AI-added' });
    }
  }
  return next;
}

function nameMatches(a, b) {
  if (!a || !b) return false;
  const aa = String(a).toLowerCase();
  const bb = String(b).toLowerCase();
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}
