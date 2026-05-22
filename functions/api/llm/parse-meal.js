/**
 * POST /api/llm/parse-meal
 *
 * Free-text → structured ingredient list.
 *
 * Request:  { text: "2 eggs and a banana with peanut butter" }
 * Response:
 *   {
 *     items: [
 *       { ingredient: "egg", qty: 2, unit: "large" },
 *       { ingredient: "banana", qty: 1, unit: "medium" },
 *       { ingredient: "peanut butter", qty: 1, unit: "tbsp" }
 *     ],
 *     summary: "3 items parsed"
 *   }
 *
 * Each item is then resolved via /api/usda/search and either logged
 * automatically (one tap = log all) or shown in a confirm list.
 *
 * Required env: ANTHROPIC_API_KEY.
 */

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You convert a user's free-text meal description into a JSON list of ingredients.

Output ONLY valid JSON in this exact shape:
{
  "items": [
    { "ingredient": "<simple noun phrase>", "qty": <number>, "unit": "<unit>" }
  ],
  "summary": "<one short sentence>"
}

Rules:
- "ingredient" = the simplest searchable term, plus cooking state if it changes the macros (e.g. "chicken breast cooked", "white rice cooked", "olive oil").
- "qty" = a positive number. "a"/"an" → 1, "half" → 0.5, "a couple" → 2, "a few" → 3.
- "unit" = the natural household unit ("large", "medium", "small", "cup", "tbsp", "tsp", "oz", "g", "slice", "piece") or "" if none given.
- One ingredient per item; don't combine ("rice and beans" → two items).
- Don't invent quantities. Unknown qty → 1, unit "".
- "summary" = brief English description of what you parsed.
- No prose, no markdown fences, just the JSON object.`;

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured on this Pages project' }, 500);
  }
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid JSON body' }, 400); }

  const text = String((body && body.text) || '').trim();
  if (!text) return json({ error: 'missing text' }, 400);

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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
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

  const raw = (data.content || []).map((c) => c.text || '').join('').trim();
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) cleaned = m[0];

  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) {
    return json({ error: 'model returned non-JSON', raw: raw.slice(0, 400) }, 502);
  }

  if (!parsed || !Array.isArray(parsed.items)) {
    return json({ error: 'bad shape from model', raw: raw.slice(0, 400) }, 502);
  }
  parsed.summary = String(parsed.summary || '').slice(0, 200);

  return json(parsed);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
