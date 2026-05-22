/**
 * POST /api/llm/recipe-edit
 *
 * Takes the current planned meal's ingredients + a free-text edit request
 * from the user, and returns a list of operations to apply.
 *
 * Request:
 *   {
 *     mealId: "D008",
 *     mealName: "Birria de Res",
 *     servings: 10,
 *     ingredients: [{ n: "Chuck Roast", q: 6, u: "lbs" }, ...],
 *     userText: "swap the chuck for short ribs",
 *   }
 *
 * Response:
 *   {
 *     scope: "today" | "always",
 *     operations: [
 *       { action: "swap",   from: "Chuck Roast", to: "Short Ribs", q: 6, u: "lbs" },
 *       { action: "adjust", target: "Onion", q: 3 },
 *       { action: "remove", target: "Avocado" },
 *       { action: "add",    n: "Lime",  q: 2, u: "each" }
 *     ],
 *     summary: "Swapped 6 lbs chuck roast for short ribs."
 *   }
 *
 * Required env: ANTHROPIC_API_KEY.
 */

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You convert a user's free-text edit request into a JSON list of operations on a recipe's ingredient list.

Output ONLY valid JSON in this exact shape:
{
  "scope": "today" | "always",
  "operations": [ { "action": "swap"|"adjust"|"remove"|"add", ... } ],
  "summary": "one-sentence English description of what changed"
}

Operation shapes:
  swap:   { "action": "swap", "from": "<existing ingredient name>", "to": "<new ingredient name>", "q": <number>, "u": "<unit>" }
  adjust: { "action": "adjust", "target": "<existing ingredient name>", "q": <number>, "u": "<unit>" }
  remove: { "action": "remove", "target": "<existing ingredient name>" }
  add:    { "action": "add", "n": "<new ingredient name>", "q": <number>, "u": "<unit>" }

Rules:
- Match "from"/"target" against the supplied ingredients list (case-insensitive substring is fine).
- If the user says "tonight"/"today"/"this time" → scope = "today". If "always"/"forever"/"from now on" → scope = "always". Default to "today" when ambiguous.
- Preserve the user's quantities when given; otherwise estimate sensible quantities (e.g. swap chicken breast 1lb → tilapia 1lb).
- DO NOT output anything other than the JSON object. No prose, no markdown fences, no commentary.`;

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured on this Pages project' }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid JSON body' }, 400); }

  const { mealName, servings, ingredients, userText } = body || {};
  if (!Array.isArray(ingredients) || !userText) {
    return json({ error: 'missing ingredients or userText' }, 400);
  }

  const userPrompt = [
    `Meal: ${mealName || '(unnamed)'}`,
    `Servings: ${servings || '?'}`,
    `Ingredients:`,
    ...ingredients.map((ing) => `  - ${ing.n}: ${ing.q} ${ing.u || ''}`),
    ``,
    `User request: ${userText}`,
  ].join('\n');

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
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
  } catch (e) {
    return json({ error: 'anthropic fetch failed', detail: String(e) }, 502);
  }

  if (!llmRes.ok) {
    const t = await llmRes.text().catch(() => '');
    return json({ error: `anthropic ${llmRes.status}`, detail: t.slice(0, 400) }, 502);
  }

  let data;
  try { data = await llmRes.json(); }
  catch (e) { return json({ error: 'non-JSON from anthropic', detail: String(e) }, 502); }

  const text = (data.content || []).map((c) => c.text || '').join('').trim();

  // Strip ```json fences if the model adds them despite instructions
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Find first {...} block as last resort
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];

  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) {
    return json({ error: 'model returned non-JSON', raw: text.slice(0, 400) }, 502);
  }

  if (!parsed || !Array.isArray(parsed.operations)) {
    return json({ error: 'bad shape from model', raw: text.slice(0, 400) }, 502);
  }
  if (parsed.scope !== 'today' && parsed.scope !== 'always') parsed.scope = 'today';
  parsed.summary = String(parsed.summary || '').slice(0, 200);

  return json(parsed);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
