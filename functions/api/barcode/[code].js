/**
 * GET /api/barcode/<code>
 *
 * Looks up a UPC/EAN/GTIN barcode and returns a food detail in the same
 * shape as /api/usda/food/<fdcId> so the quantity picker can render it
 * unchanged.
 *
 * Resolution order:
 *   1. USDA Branded foods — clean per-100g macros, US-curated.
 *      USDA's search supports gtinUpc as a query term.
 *   2. Open Food Facts — open global database, ~3M products. CC-BY-SA.
 *
 * Required env: USDA_API_KEY.
 */

const NUTRIENT_IDS = {
  1008: 'kcal',
  1003: 'protein_g',
  1004: 'fat_g',
  1005: 'carbs_g',
  1079: 'fiber_g',
  1093: 'sodium_mg',
};

function nutrientsFromUsda(food) {
  const out = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sodium_mg: 0 };
  for (const n of food.foodNutrients || []) {
    const id = n.nutrient?.id ?? n.nutrientId;
    const key = NUTRIENT_IDS[id];
    if (key) out[key] = n.amount ?? n.value ?? 0;
  }
  if (!out.kcal && (out.protein_g || out.carbs_g || out.fat_g)) {
    out.kcal = Math.round(out.protein_g * 4 + out.carbs_g * 4 + out.fat_g * 9);
  }
  return out;
}

async function tryUsdaByBarcode(code, key) {
  // USDA's search-by-GTIN: pass the barcode as the query against Branded foods.
  const u = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  u.searchParams.set('api_key', key);
  u.searchParams.set('query', code);
  u.searchParams.set('dataType', 'Branded');
  u.searchParams.set('pageSize', '5');
  const r = await fetch(u.toString());
  if (!r.ok) return null;
  const data = await r.json();
  // Filter to exact GTIN match — USDA may return name-keyword hits otherwise.
  const exact = (data.foods || []).find((f) => (f.gtinUpc || '').replace(/^0+/, '') === code.replace(/^0+/, ''));
  if (!exact) return null;
  // Hit detail to get foodPortions
  const dr = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${exact.fdcId}?api_key=${key}`);
  if (!dr.ok) {
    return {
      source: 'usda_branded',
      fdcId: exact.fdcId,
      name: exact.description,
      brand: exact.brandOwner || exact.brandName || null,
      dataType: 'Branded',
      per100g: nutrientsFromUsda(exact),
      portions: defaultPortions(),
    };
  }
  const food = await dr.json();
  const per100g = nutrientsFromUsda(food);
  const portions = defaultPortions();
  // Branded foods often have a packaged serving — surface it as the natural option.
  if (food.servingSize && food.servingSizeUnit) {
    const grams = food.servingSizeUnit.toLowerCase() === 'g' ? food.servingSize
                  : food.servingSizeUnit.toLowerCase() === 'ml' ? food.servingSize : null;
    if (grams) {
      portions.unshift({
        label: `1 serving (${food.householdServingFullText || `${food.servingSize} ${food.servingSizeUnit}`})`,
        grams,
      });
    }
  }
  return {
    source: 'usda_branded',
    fdcId: food.fdcId,
    name: food.description,
    brand: food.brandOwner || food.brandName || null,
    dataType: 'Branded',
    per100g,
    portions,
  };
}

async function tryOpenFoodFacts(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments,serving_size,serving_quantity,image_front_small_url`);
  if (!r.ok) return null;
  const data = await r.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const n = p.nutriments || {};
  // Open Food Facts stores per-100g values; sodium is in GRAMS (must convert).
  const per100g = {
    kcal: Math.round(n['energy-kcal_100g'] || n.energy_kcal_100g || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0)),
    protein_g: round1(n.proteins_100g || 0),
    carbs_g: round1(n.carbohydrates_100g || 0),
    fat_g: round1(n.fat_100g || 0),
    fiber_g: round1(n.fiber_100g || 0),
    sodium_mg: round1((n.sodium_100g || 0) * 1000), // OFF reports sodium in grams
  };
  if (!per100g.kcal && (per100g.protein_g || per100g.carbs_g || per100g.fat_g)) {
    per100g.kcal = Math.round(per100g.protein_g * 4 + per100g.carbs_g * 4 + per100g.fat_g * 9);
  }
  const portions = defaultPortions();
  if (p.serving_quantity && Number(p.serving_quantity) > 0) {
    portions.unshift({
      label: `1 serving (${p.serving_size || `${p.serving_quantity} g`})`,
      grams: Number(p.serving_quantity),
    });
  }
  return {
    source: 'open_food_facts',
    barcode: code,
    name: p.product_name || `Product ${code}`,
    brand: p.brands || null,
    dataType: 'Branded',
    per100g,
    portions,
    image_url: p.image_front_small_url || null,
  };
}

function defaultPortions() {
  return [
    { label: '100 g', grams: 100 },
    { label: '1 oz (28 g)', grams: 28.3495 },
    { label: '1 g', grams: 1 },
  ];
}

function round1(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export async function onRequestGet({ params, env }) {
  const raw = (params.code || '').trim();
  // Accept digits only, 8-14 chars (UPC-E, UPC-A, EAN-13, GTIN-14).
  const code = raw.replace(/[^0-9]/g, '');
  if (!code || code.length < 8 || code.length > 14) {
    return json({ error: 'invalid barcode' }, 400);
  }
  if (!env.USDA_API_KEY) {
    return json({ error: 'USDA_API_KEY not configured' }, 500);
  }

  // Try USDA first (US-curated, cleanest), fall back to Open Food Facts.
  try {
    const u = await tryUsdaByBarcode(code, env.USDA_API_KEY);
    if (u) return json(u);
  } catch (e) {
    // log and continue
    console.error('USDA barcode lookup failed:', e);
  }

  try {
    const off = await tryOpenFoodFacts(code);
    if (off) return json(off);
  } catch (e) {
    console.error('OFF barcode lookup failed:', e);
  }

  return json({ error: 'not found', barcode: code }, 404);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=600',
    },
  });
}
