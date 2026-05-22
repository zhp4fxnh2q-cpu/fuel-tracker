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


/** Look up a barcode (UPC/EAN/GTIN). Returns the same shape as getUsdaFood. */
export async function lookupBarcode(code) {
  const r = await fetch(`/api/barcode/${encodeURIComponent(code)}`);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`Barcode ${r.status}: ${text.slice(0, 120)}`);
    err.status = r.status;
    err.barcode = code;
    throw err;
  }
  return await r.json();
}


/**
 * Pick the right default portion index for a food's portion list.
 *
 * Portions array convention (built by functions/api/usda/food/[fdcId].js):
 *   index 0:  universal fallback ("100 g")
 *   index 1:  universal fallback ("1 oz (28 g)")
 *   index 2+: natural household portions in USDA's order
 *
 * Strategy:
 *  1. Prefer single-unit natural portions (no "cup"/"tbsp" multipliers).
 *  2. If "large" is present without "extra", pick that (USDA's reference
 *     size for many foods - egg, chicken breast, banana, etc.).
 *  3. Otherwise pick the median-grams natural portion.
 *  4. Fall back to index 0 ("100 g") if no natural portions exist.
 */
export function pickDefaultPortionIdx(portions) {
  if (!Array.isArray(portions) || portions.length === 0) return 0;
  if (portions.length <= 2) return 0;

  const natural = portions.slice(2);
  if (natural.length === 0) return 0;

  const multiHints = /\b(cup|tbsp|tsp|tablespoon|teaspoon|fl\s*oz|fluid\s+ounce)\b/i;
  const numericMultiHint = /\(\d+\.\d+\s+[a-z]/i;

  const singleUnits = natural.filter((p) =>
    !multiHints.test(p.label) && !numericMultiHint.test(p.label)
  );
  const pool = singleUnits.length > 0 ? singleUnits : natural;

  const large = pool.find((p) =>
    /\blarge\b/i.test(p.label) && !/\bextra\s+large\b/i.test(p.label)
  );
  if (large) return portions.indexOf(large);

  const sorted = [...pool].sort((a, b) => a.grams - b.grams);
  const median = sorted[Math.floor(sorted.length / 2)];
  return portions.indexOf(median);
}
