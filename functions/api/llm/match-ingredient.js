/**
 * POST /api/llm/match-ingredient
 *
 * Replace the heuristic ingredient → USDA resolver with Claude.
 * Given a recipe context + an ingredient line + the top USDA candidates,
 * Claude picks the best food match. Portion is then chosen deterministically
 * by unit matching.
 *
 * Required env: ANTHROPIC_API_KEY, USDA_API_KEY.
 *
 * Request:
 *   {
 *     ingredient: "Chuck Roast",
 *     qty: 6,
 *     unit: "lbs",
 *     recipe_name: "Birria de Res",          // optional context
 *     recipe_cuisine: "Mexican",             // optional context
 *     servings: 10                            // optional context
 *   }
 *
 * Response:
 *   {
 *     fdcId: 2706183,
 *     name: "Beef, chuck roast, raw",
 *     dataType: "Survey (FNDDS)",
 *     per100g: {...},
 *     portion: { label: "100 g", grams: 100 },
 *     reasoning: "raw chuck is the right cut for slow-braised birria"
 *   }
 */

const MODEL = 'claude-sonnet-4-6';

const MASS_TO_GRAMS = {
  g: 1, gram: 1, grams: 1, kg: 1000,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
};

function pickPortion(unit, portions) {
  if (!portions || portions.length === 0) return { label: '100 g', grams: 100 };
  const u = String(unit || '').toLowerCase().trim();
  // Mass units → always grams (the qty will be converted to grams downstream)
  if (MASS_TO_GRAMS[u]) return portions[0];
  // Try direct match
  const base = u.replace(/s$/, '').split(/\s+/)[0];
  for (const p of portions) {
    if (p.label.toLowerCase().includes(base) && base.length >= 2) return p;
  }
  const syn = {
    tbsp: ['tablespoon','tbsp'], tsp: ['teaspoon','tsp'],
    each: ['large','medium','small','piece','1 '], pack: ['package','serving'],
    slice: ['slice'], can: ['can'], jar: ['jar'], bottle: ['bottle'],
    pinch: ['pinch'], bunch: ['bunch'], head: ['head'], bag: ['bag','package'],
    box: ['box','package'],
  };
  for (const s of syn[base] || []) {
    for (const p of portions) if (p.label.toLowerCase().includes(s)) return p;
  }
  return portions[0];
}

async function searchUsda(query, env) {
  // Re-use the same proxy logic via the live endpoint
  const url = new URL('https://rdnafuel.pages.dev/api/usda/search');
  url.searchParams.set('q', query);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`usda search ${r.status}`);
  const data = await r.json();
  return data.results || [];
}

async function getUsdaFood(fdcId) {
  const r = await fetch(`https://rdnafuel.pages.dev/api/usda/food/${encodeURIComponent(fdcId)}`);
  if (!r.ok) throw new Error(`usda food ${r.status}`);
  return await r.json();
}

const SYSTEM_PROMPT = `You are picking the single best USDA food entry for a recipe ingredient.

You will be given:
- The ingredient name as written in the recipe
- Recipe context (name, cuisine)
- A numbered list of USDA candidates (fdcId, name, dataType, kcal/100g)

Output ONLY this JSON:
{ "fdcId": <integer fdcId from the candidates>, "reasoning": "<one short sentence>" }

Pick rules:
- Prefer raw / uncooked unless the recipe context implies cooked (e.g. "cooked rice" → cooked).
- Prefer FNDDS over SR Legacy if both are present and otherwise equivalent.
- Prefer generic, ingredient-form entries over branded products.
- If the ingredient is a cut of meat, pick the matching cut (chuck → chuck roast; thigh → thigh).
- If nothing fits well, pick the closest candidate anyway. Never invent fdcIds.`;

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return j({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  let body;
  try { body = await request.json(); } catch { return j({ error: 'invalid JSON' }, 400); }

  const ingredient = String(body.ingredient || '').trim();
  if (!ingredient) return j({ error: 'missing ingredient' }, 400);
  const unit = body.unit || '';
  const recipe_name = body.recipe_name || '';
  const recipe_cuisine = body.recipe_cuisine || '';

  // 1. USDA candidates
  let candidates;
  try {
    candidates = await searchUsda(ingredient, env);
  } catch (e) {
    return j({ error: 'usda search failed', detail: String(e) }, 502);
  }
  if (candidates.length === 0) {
    return j({ error: 'no usda hits for ingredient', ingredient }, 404);
  }
  const top = candidates.slice(0, 8);

  // 2. Claude picks
  const userPrompt = [
    `Ingredient: ${ingredient}`,
    unit ? `Sample unit: ${unit}` : null,
    recipe_name ? `Recipe: ${recipe_name}` : null,
    recipe_cuisine ? `Cuisine: ${recipe_cuisine}` : null,
    ``,
    `USDA candidates:`,
    ...top.map((c, i) => `${i + 1}. fdcId ${c.fdcId} — ${c.name} — ${c.dataType} — ${Math.round((c.per100g && c.per100g.kcal) || 0)} kcal/100g`),
  ].filter(Boolean).join('\n');

  let llmRes;
  try {
    llmRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
  } catch (e) {
    return j({ error: 'anthropic fetch failed', detail: String(e) }, 502);
  }
  if (!llmRes.ok) {
    const t = await llmRes.text().catch(() => '');
    return j({ error: `anthropic ${llmRes.status}`, detail: t.slice(0, 300) }, 502);
  }
  const data = await llmRes.json();
  const raw = (data.content || []).map((c) => c.text || '').join('').trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  let parsed;
  try { parsed = JSON.parse(m ? m[0] : cleaned); }
  catch (e) { return j({ error: 'non-JSON from model', raw: raw.slice(0, 300) }, 502); }

  const pickedId = parsed.fdcId;
  const picked = top.find((c) => Number(c.fdcId) === Number(pickedId));
  if (!picked) {
    // Fallback to top hit if Claude picked an invalid id
    const fallback = top[0];
    return j({
      fdcId: fallback.fdcId,
      name: fallback.name,
      dataType: fallback.dataType,
      per100g: fallback.per100g,
      portion: { label: '100 g', grams: 100 },
      reasoning: 'fallback (model picked unknown fdcId)',
      candidates: top.length,
    });
  }

  // 3. Fetch portions, pick by unit
  let detail;
  try { detail = await getUsdaFood(picked.fdcId); }
  catch (e) {
    return j({
      fdcId: picked.fdcId,
      name: picked.name,
      dataType: picked.dataType,
      per100g: picked.per100g,
      portion: { label: '100 g', grams: 100 },
      reasoning: parsed.reasoning || '',
      portionFallback: String(e),
    });
  }
  const portion = pickPortion(unit, detail.portions);
  return j({
    fdcId: detail.fdcId,
    name: detail.name,
    dataType: detail.dataType,
    per100g: detail.per100g,
    portion,
    reasoning: parsed.reasoning || '',
  });
}

function j(b, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
