/**
 * GET /api/usda/search?q=<query>
 *
 * Proxies USDA FoodData Central search. The API key never reaches the browser.
 * USDA's relevance ranking is decent but it mixes Branded junk in with the
 * generic foods you actually want. We re-sort by quality bucket:
 *
 *   1. Foundation         (modern lab-analyzed foods)
 *   2. SR Legacy          (the classic SR28 reference)
 *   3. Survey (FNDDS)     (NHANES food code mappings)
 *   4. Branded            (commercial products)
 *
 * Within each bucket we keep USDA's relevance order. Hits with zero kcal AND
 * zero protein are filtered out (lab metadata, water, etc.).
 *
 * Required env: USDA_API_KEY (Cloudflare Pages → Settings → Variables and Secrets).
 */

const NUTRIENT_IDS = {
  1008: 'kcal',
  1003: 'protein_g',
  1004: 'fat_g',
  1005: 'carbs_g',
  1079: 'fiber_g',
  1093: 'sodium_mg',
};

const DATATYPE_RANK = {
  'SR Legacy': 0,
  Foundation: 1,
  'Survey (FNDDS)': 2,
  Branded: 3,
};

function pickNutrientsFromSearchHit(hit) {
  const out = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sodium_mg: 0 };
  for (const n of hit.foodNutrients || []) {
    const id = n.nutrientId ?? n.nutrient?.id;
    const key = NUTRIENT_IDS[id];
    if (key) out[key] = n.value ?? n.amount ?? 0;
  }
  return out;
}

/** Naturalness score: lower is more natural. Encourages "Egg, whole, raw, fresh"
 * to beat "Egg, whole, dried" without us having to maintain a curated list. */
const NATURAL_BOOST_WORDS = ['raw', 'fresh', 'uncooked', 'whole'];
const PROCESSED_DEMOTE_WORDS = [
  'dried', 'powder', 'powdered', 'substitute', 'imitation',
  'low-fat', 'fat-free', 'fortified', 'enriched', 'flavored',
  'instant', 'breaded', 'frozen', 'preserved', 'canned',
  'with added', 'with salt',
];

function naturalnessScore(name) {
  const lower = (name || '').toLowerCase();
  let score = 0;
  for (const w of NATURAL_BOOST_WORDS) if (lower.includes(w)) score -= 1;
  for (const w of PROCESSED_DEMOTE_WORDS) if (lower.includes(w)) score += 2;
  // Cooking method demotions
  for (const w of ['cooked', 'fried', 'scrambled', 'poached', 'omelet']) if (lower.includes(w)) score += 1;
  return score;
}

/** USDA Foundation foods sometimes omit Energy in search results. Estimate
 * from Atwater factors when kcal is 0 but macros are present. */
function computeKcalFallback(m) {
  if (m.kcal && m.kcal > 0) return m.kcal;
  const est = (m.protein_g || 0) * 4 + (m.carbs_g || 0) * 4 + (m.fat_g || 0) * 9;
  return Math.round(est);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ error: 'missing q' }, 400);
  if (!env.USDA_API_KEY) return json({ error: 'USDA_API_KEY not configured' }, 500);

  const usdaUrl = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  usdaUrl.searchParams.set('api_key', env.USDA_API_KEY);
  usdaUrl.searchParams.set('query', q);
  // No dataType filter, no sortBy — let USDA's relevance ranking work, then
  // we re-bucket below.
  usdaUrl.searchParams.set('pageSize', '200');

  let data;
  try {
    const r = await fetch(usdaUrl.toString());
    if (!r.ok) return json({ error: `USDA returned ${r.status}` }, 502);
    data = await r.json();
  } catch (e) {
    return json({ error: 'USDA fetch failed', detail: String(e) }, 502);
  }

  const normalized = (data.foods || [])
    .map((f) => ({
      fdcId: f.fdcId,
      name: f.description,
      brand: f.brandOwner || f.brandName || null,
      dataType: f.dataType,
      per100g: ((m) => ({ ...m, kcal: computeKcalFallback(m) }))(pickNutrientsFromSearchHit(f)),
      _relevanceIdx: 0, // populated below
    }))
    .filter((r) => {
      // Drop garbage entries — must have either calories or protein
      const p = r.per100g;
      return (p.kcal || 0) > 0 || (p.protein_g || 0) > 0;
    });

  // Preserve relevance ordering inside each bucket
  normalized.forEach((r, i) => { r._relevanceIdx = i; });

  // "egg" should rank "Egg, whole, raw, fresh" above "Bagels, egg" — name
  // starts with the query is a much stronger match than a comma-trailing modifier.
  const qLower = q.toLowerCase();
  const firstWord = qLower.split(/\s+/)[0];
  const startsWithQuery = (name) => {
    const n = (name || '').toLowerCase().trimStart();
    return n.startsWith(qLower) || n.startsWith(firstWord);
  };

  normalized.sort((a, b) => {
    const ra = DATATYPE_RANK[a.dataType] ?? 99;
    const rb = DATATYPE_RANK[b.dataType] ?? 99;
    if (ra !== rb) return ra - rb;
    const sa = startsWithQuery(a.name) ? 0 : 1;
    const sb = startsWithQuery(b.name) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const na = naturalnessScore(a.name);
    const nb = naturalnessScore(b.name);
    if (na !== nb) return na - nb;
    return a._relevanceIdx - b._relevanceIdx;
  });

  // Cap at 20 after re-sort and strip the internal field
  const results = normalized.slice(0, 20).map(({ _relevanceIdx, ...rest }) => rest);

  return json({ q, results });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60',
    },
  });
}
