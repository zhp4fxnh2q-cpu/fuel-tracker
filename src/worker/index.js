/**
 * FUEL Calorie Tracking App - Cloudflare Worker Backend
 * Handles API routes for the single-page application
 */

const SYSTEM_PROMPT_FOOD_LOG = `You are a nutrition estimation expert helping users log food intake quickly and accurately.

When the user describes food they've eaten, extract the following information:
1. Food name/description
2. Portion size (estimate if needed)
3. Macro estimates (calories, protein, carbs, fat in grams)

Reference values for common foods (per 100g unless otherwise noted):
- Chicken breast (cooked): 165 cal, 31g protein, 0g carbs, 3.6g fat
- Ground beef 80/20 (cooked): 217 cal, 23g protein, 0g carbs, 13g fat
- Brown rice (cooked): 112 cal, 2.6g protein, 23g carbs, 0.9g fat
- Banana: 89 cal, 1.1g protein, 23g carbs, 0.3g fat
- Olive oil: 884 cal, 0g protein, 0g carbs, 100g fat
- Egg (large): 72 cal, 6.3g protein, 0.4g carbs, 5g fat
- White bread (1 slice 28g): 75 cal, 2.7g protein, 14g carbs, 1g fat

Guidelines:
- Be conservative with estimates, especially during cuts
- For mixed dishes, break down into components
- Include confidence level (high/medium/low) based on information detail
- When portion is unclear, state assumption clearly
- Account for cooking methods that affect macros

Return ONLY valid JSON with this structure:
{
  "foods": [
    {
      "name": "food name",
      "portion_description": "e.g., 200g, 1 cup, 2 slices",
      "calories": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0,
      "confidence": "high|medium|low"
    }
  ]
}`;

const SYSTEM_PROMPT_COACHING = `You are an evidence-based nutrition coach specializing in physique development for advanced lifters. Your client is a 6'6" tall male lifter currently in a cutting phase focused on maintaining muscle while reducing body fat.

You provide weekly coaching based on:
- Current smoothed weight and weekly weight change
- Average daily calorie and protein intake
- Days with logged food
- Training days and consistency
- Estimated TDEE
- Weeks elapsed in current phase

Coaching should include:
1. Assessment of current progress and trajectory
2. Macro recommendations (protein, carb/fat balance)
3. Training considerations (volume, intensity, recovery)
4. Practical implementation strategies
5. Adjustments if progress stalls

Be specific, data-driven, and account for individual variation. Acknowledge effort and consistency as critical factors. Recommend deficit adjustments only if progress indicates necessary change.

Return ONLY valid JSON with this structure:
{
  "assessment": "Summary of current progress and trajectory",
  "macroRecommendations": {
    "proteinRange": "target protein in grams",
    "calorieAdjustment": "recommendation for current deficit",
    "carbFatRatio": "guidance on carb vs fat distribution"
  },
  "trainingFocus": "How to adjust training for current phase",
  "actionItems": ["specific, actionable item 1", "item 2", "item 3"],
  "motivationalNote": "Brief acknowledgment of effort and encouragement"
}`;

/**
 * Hash a string using SHA-256
 */
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a random hex token
 */
function generateToken() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify Google ID token
 */
async function handleAuthGoogle(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { idToken } = body;
  if (!idToken || typeof idToken !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing idToken' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify token with Google
    const url = new URL('https://oauth2.googleapis.com/tokeninfo');
    url.searchParams.set('id_token', idToken);

    const response = await fetch(url.toString());

    if (!response.ok) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tokenData = await response.json();

    // Verify audience (client ID)
    const clientId = env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';
    if (tokenData.aud !== clientId) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Optionally verify email matches ALLOWED_EMAIL
    if (env.ALLOWED_EMAIL && tokenData.email !== env.ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      email: tokenData.email,
      name: tokenData.name,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return new Response(JSON.stringify({ error: 'Auth verification failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Verify PIN and return token (legacy)
 */
async function handleAuthVerify(request, env) {
  const { pin } = await request.json();

  if (!pin || typeof pin !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const pinHash = await hashString(pin);
  const valid = pinHash === env.APP_PIN_HASH;

  if (!valid) {
    return new Response(JSON.stringify({ valid: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = generateToken();

  return new Response(JSON.stringify({
    valid: true,
    token: token
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Verify token (simple check against hash)
 */
async function verifyToken(token, env) {
  if (!token || token === env.APP_PIN_HASH) {
    return true;
  }
  // For stateless workers, we just verify the PIN was provided
  // In this simple model, the client stores the pin hash as token
  return token === env.APP_PIN_HASH;
}

/**
 * Sync data from client to D1 database
 */
async function handleSync(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = auth.slice(7);
  // In this simple model, we accept any bearer token (client has already verified PIN)

  let syncData;
  try {
    syncData = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const tables = [
    'weight_entries',
    'food_log',
    'imported_recipes',
    'custom_foods',
    'algorithm_state',
    'weekly_summaries',
    'training_days',
    'user_settings'
  ];

  try {
    for (const table of tables) {
      const records = syncData[table] || [];

      for (const record of records) {
        // Build upsert query based on table structure
        // This is a simplified approach - in production, use proper prepared statements
        const columns = Object.keys(record);
        const values = columns.map((col, idx) => {
          const val = record[col];
          if (val === null) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === 'boolean') return val ? '1' : '0';
          return val;
        });

        // For D1, we'll use INSERT OR REPLACE (SQLite upsert)
        const columnList = columns.join(', ');
        const valueList = values.join(', ');
        const query = `INSERT OR REPLACE INTO ${table} (${columnList}) VALUES (${valueList})`;

        await env.DB.prepare(query).run();
      }
    }

    const syncedAt = new Date().toISOString();
    return new Response(JSON.stringify({
      success: true,
      synced_at: syncedAt
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: 'Sync failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * AI food logging via Claude Haiku
 */
async function handleAIFoodLog(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { userInput } = body;
  if (!userInput || typeof userInput !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing userInput' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT_FOOD_LOG,
        messages: [
          {
            role: 'user',
            content: userInput
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Invalid response format' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const foodData = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(foodData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Food log error:', error);
    return new Response(JSON.stringify({ error: 'Food log processing failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * AI coaching via Claude Sonnet
 */
async function handleAICoaching(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { smoothed_weight, weight_change, avg_calories, avg_protein, days_logged, training_days, tdee, weeks_in_phase } = body;

  const userPrompt = `
Weekly Status:
- Current smoothed weight: ${smoothed_weight} lbs
- Weekly weight change: ${weight_change} lbs
- Average daily calories: ${avg_calories} kcal
- Average daily protein: ${avg_protein}g
- Days with food logged: ${days_logged}/7
- Training days this week: ${training_days}
- Estimated TDEE: ${tdee} kcal
- Weeks in current cutting phase: ${weeks_in_phase}

Please provide coaching on macros, training, and progress adjustment.
`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT_COACHING,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Invalid response format' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const coachingData = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(coachingData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Coaching error:', error);
    return new Response(JSON.stringify({ error: 'Coaching processing failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Search USDA FoodData Central
 */
async function handleNutritionSearch(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { query } = body;
  if (!query || typeof query !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing query' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('api_key', env.USDA_API_KEY);
    url.searchParams.set('query', query);
    url.searchParams.set('dataType', 'Foundation,SR Legacy');
    url.searchParams.set('pageSize', '10');

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('USDA API error:', response.status);
      return new Response(JSON.stringify({ error: 'USDA service error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    const foods = (data.foods || []).map(food => {
      const nutrients = food.foodNutrients || [];

      const getNutrient = (id) => {
        const nutrient = nutrients.find(n => n.nutrientId === id);
        return nutrient ? nutrient.value : 0;
      };

      return {
        fdcId: food.fdcId,
        name: food.description,
        calories: getNutrient(1008),
        protein: getNutrient(1003),
        fat: getNutrient(1004),
        carbs: getNutrient(1005),
        fiber: getNutrient(1079),
        per: '100g'
      };
    });

    return new Response(JSON.stringify(foods), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Nutrition search error:', error);
    return new Response(JSON.stringify({ error: 'Search failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get detailed nutrition for specific food
 */
async function handleNutritionFood(request, env, fdcId) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!fdcId) {
    return new Response(JSON.stringify({ error: 'Missing fdcId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}`);
    url.searchParams.set('api_key', env.USDA_API_KEY);

    const response = await fetch(url.toString());

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(JSON.stringify({ error: 'Food not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.error('USDA API error:', response.status);
      return new Response(JSON.stringify({ error: 'USDA service error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const food = await response.json();
    const nutrients = food.foodNutrients || [];

    const getNutrient = (id) => {
      const nutrient = nutrients.find(n => n.nutrientId === id);
      return nutrient ? nutrient.value : 0;
    };

    const result = {
      fdcId: food.fdcId,
      name: food.description,
      calories: getNutrient(1008),
      protein: getNutrient(1003),
      fat: getNutrient(1004),
      carbs: getNutrient(1005),
      fiber: getNutrient(1079),
      per: '100g'
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Nutrition fetch error:', error);
    return new Response(JSON.stringify({ error: 'Fetch failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Add CORS headers to response
 */
function addCORSHeaders(response) {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return newResponse;
}

/**
 * Handle OPTIONS requests
 */
function handleOptions() {
  return addCORSHeaders(new Response(null, {
    status: 204,
    headers: { 'Content-Type': 'application/json' }
  }));
}

/**
 * Main fetch handler
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    let response;

    // Route handlers
    if (pathname === '/api/auth/google' && request.method === 'POST') {
      response = await handleAuthGoogle(request, env);
    } else if (pathname === '/api/auth/verify' && request.method === 'POST') {
      response = await handleAuthVerify(request, env);
    } else if (pathname === '/api/sync' && request.method === 'POST') {
      response = await handleSync(request, env);
    } else if (pathname === '/api/ai/food-log' && request.method === 'POST') {
      response = await handleAIFoodLog(request, env);
    } else if (pathname === '/api/ai/coaching' && request.method === 'POST') {
      response = await handleAICoaching(request, env);
    } else if (pathname === '/api/nutrition/search' && request.method === 'POST') {
      response = await handleNutritionSearch(request, env);
    } else if (pathname.startsWith('/api/nutrition/food/') && request.method === 'GET') {
      const fdcId = pathname.replace('/api/nutrition/food/', '');
      response = await handleNutritionFood(request, env, fdcId);
    } else {
      response = new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return addCORSHeaders(response);
  }
};
