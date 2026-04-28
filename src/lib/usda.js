/**
 * Client wrapper for the USDA Pages Functions.
 * Same-origin fetches → no CORS, no exposed API key.
 */

export async function searchUsda(query) {
  if (!query || query.trim().length < 2) return [];
  const r = await fetch(`/api/usda/search?q=${encodeURIComponent(query.trim())}`);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`USDA search ${r.status}: ${text.slice(0, 120)}`);
  }
  const data = await r.json();
  return data.results || [];
}

export async function getUsdaFood(fdcId) {
  const r = await fetch(`/api/usda/food/${encodeURIComponent(fdcId)}`);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`USDA food ${r.status}: ${text.slice(0, 120)}`);
    err.status = r.status;
    throw err;
  }
  return await r.json();
}

/**
 * Some Foundation foods 404 on USDA's /food/{fdcId} endpoint even though
 * they appear in search results. This builds a minimal usable detail from
 * the search hit: per-100g macros are already there, and we attach the
 * universal "100 g" + "1 oz" portions so the user can still log by weight.
 */
export function detailFromSearchHit(hit) {
  return {
    fdcId: hit.fdcId,
    name: hit.name,
    brand: hit.brand,
    dataType: hit.dataType,
    per100g: hit.per100g,
    portions: [
      { label: '100 g', grams: 100 },
      { label: '1 oz (28 g)', grams: 28.3495 },
      { label: '1 g', grams: 1 },
    ],
    fallbackFromSearch: true,
  };
}

/** Compute macros at a chosen gram amount given per-100g values. */
export function macrosAtGrams(per100g, grams) {
  const factor = grams / 100;
  return {
    kcal: round(per100g.kcal * factor),
    protein_g: round(per100g.protein_g * factor),
    carbs_g: round(per100g.carbs_g * factor),
    fat_g: round(per100g.fat_g * factor),
    fiber_g: round(per100g.fiber_g * factor),
    sodium_mg: round((per100g.sodium_mg || 0) * factor),
  };
}

function round(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}
