/**
 * GET /api/usda/search?q=<query>
 *
 * Proxies USDA FoodData Central search through a Cloudflare Pages Function so
 * the API key never reaches the browser. Returns a normalized list of hits.
 *
 * Required env: USDA_API_KEY (set in Cloudflare Pages → Settings → Environment variables).
 */

const NUTRIENT_IDS = {
  1008: 'kcal',
  1003: 'protein_g',
  1004: 'fat_g',
  1005: 'carbs_g',
  1079: 'fiber_g',
  1093: 'sodium_mg',
};

function pickNutrientsFromSearchHit(hit) {
  // Search results include foodNutrients per 100g
  const out = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sodium_mg: 0 };
  for (const n of hit.foodNutrients || []) {
    const id = n.nutrientId ?? n.nutrient?.id;
    const key = NUTRIENT_IDS[id];
    if (key) out[key] = n.value ?? n.amount ?? 0;
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) {
    return json({ error: 'missing q' }, 400);
  }
  if (!env.USDA_API_KEY) {
    return json({ error: 'USDA_API_KEY not configured' }, 500);
  }

  const usdaUrl = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  usdaUrl.searchParams.set('api_key', env.USDA_API_KEY);
  usdaUrl.searchParams.set('query', q);
  // Spec preference order: Foundation > SR Legacy > Survey (FNDDS) > Branded
  usdaUrl.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS),Branded');
  usdaUrl.searchParams.set('pageSize', '20');
  usdaUrl.searchParams.set('sortBy', 'dataType.keyword');

  let data;
  try {
    const r = await fetch(usdaUrl.toString());
    if (!r.ok) {
      return json({ error: `USDA returned ${r.status}` }, 502);
    }
    data = await r.json();
  } catch (e) {
    return json({ error: 'USDA fetch failed', detail: String(e) }, 502);
  }

  const results = (data.foods || []).map((f) => ({
    fdcId: f.fdcId,
    name: f.description,
    brand: f.brandOwner || f.brandName || null,
    dataType: f.dataType,
    per100g: pickNutrientsFromSearchHit(f),
  }));

  return json({ q, results });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60', // small caching, USDA is stable
    },
  });
}
