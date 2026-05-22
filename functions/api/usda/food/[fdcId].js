/**
 * GET /api/usda/food/<fdcId>
 *
 * Returns one normalized food: per-100g macros + a list of natural serving
 * options derived from foodPortions. Branded foods use labelNutrients +
 * servingSize as the canonical portion; non-branded use foodPortions.
 *
 * Always appends "100 g" and "1 oz (28 g)" as universal fallbacks so the
 * quantity picker is never empty.
 */

const NUTRIENT_IDS = {
  1008: 'kcal',
  1003: 'protein_g',
  1004: 'fat_g',
  1005: 'carbs_g',
  1079: 'fiber_g',
  1093: 'sodium_mg',
};

function per100gFromFoodNutrients(food) {
  const out = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sodium_mg: 0 };
  for (const n of food.foodNutrients || []) {
    const id = n.nutrient?.id ?? n.nutrientId;
    const key = NUTRIENT_IDS[id];
    if (!key) continue;
    const amount = n.amount ?? n.value ?? 0;
    out[key] = amount;
  }
  return out;
}

function buildPortions(food) {
  const list = [];
  // Universal fallbacks
  list.push({ label: '100 g', grams: 100 });
  list.push({ label: '1 oz (28 g)', grams: 28.3495 });

  if (food.dataType === 'Branded' && food.servingSize && food.servingSizeUnit) {
    const grams =
      food.servingSizeUnit?.toLowerCase() === 'g'
        ? food.servingSize
        : food.servingSizeUnit?.toLowerCase() === 'ml'
          ? food.servingSize // approximate water density
          : null;
    if (grams) {
      list.push({ label: `1 serving (${food.householdServingFullText || `${food.servingSize} ${food.servingSizeUnit}`})`, grams });
    }
  }

  for (const p of food.foodPortions || []) {
    const grams = p.gramWeight;
    if (!grams || grams <= 0) continue;

    // FNDDS items put the readable text in portionDescription
    // (e.g. "1 large", "1 cup, chopped"). SR Legacy items use the
    // modifier/measureUnit/amount triple. Try FNDDS first, fall back.
    const fnddsDesc = (p.portionDescription || '').trim();
    let label = '';

    if (fnddsDesc && fnddsDesc.toLowerCase() !== 'quantity not specified') {
      label = fnddsDesc;
    } else {
      const amount = p.amount ?? 1;
      const modifier = (p.modifier || '').trim();
      const measureName = (p.measureUnit?.name || '').trim();
      const measureIsPlaceholder =
        !measureName || measureName === 'undetermined' || /^\d+$/.test(measureName);

      if (modifier && !measureIsPlaceholder) {
        label = `${amount} ${measureName} ${modifier}`;
      } else if (modifier) {
        label = amount === 1 ? modifier : `${amount} × ${modifier}`;
      } else if (!measureIsPlaceholder) {
        label = `${amount} ${measureName}`;
      } else {
        // No readable text anywhere — skip this portion entirely rather
        // than show a raw FNDDS code like "90000".
        continue;
      }
    }

    list.push({ label: `${label} (${Math.round(grams)} g)`, grams });
  }

  // Dedupe by label, keep first occurrence
  const seen = new Set();
  return list.filter((p) => {
    const key = p.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** USDA Foundation foods sometimes omit Energy in search results. Estimate
 * from Atwater factors when kcal is 0 but macros are present. */
function computeKcalFallback(m) {
  if (m.kcal && m.kcal > 0) return m.kcal;
  const est = (m.protein_g || 0) * 4 + (m.carbs_g || 0) * 4 + (m.fat_g || 0) * 9;
  return Math.round(est);
}

export async function onRequestGet({ params, env }) {
  const fdcId = params.fdcId;
  if (!fdcId) return json({ error: 'missing fdcId' }, 400);
  if (!env.USDA_API_KEY) return json({ error: 'USDA_API_KEY not configured' }, 500);

  const usdaUrl = new URL(`https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(fdcId)}`);
  usdaUrl.searchParams.set('api_key', env.USDA_API_KEY);

  let food;
  try {
    const r = await fetch(usdaUrl.toString());
    if (r.status === 404) return json({ error: 'food not found' }, 404);
    if (!r.ok) return json({ error: `USDA returned ${r.status}` }, 502);
    food = await r.json();
  } catch (e) {
    return json({ error: 'USDA fetch failed', detail: String(e) }, 502);
  }

  return json({
    fdcId: food.fdcId,
    name: food.description,
    brand: food.brandOwner || food.brandName || null,
    dataType: food.dataType,
    per100g: ((m) => ({ ...m, kcal: computeKcalFallback(m) }))(per100gFromFoodNutrients(food)),
    portions: buildPortions(food),
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
    },
  });
}
