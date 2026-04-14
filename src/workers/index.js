/**
 * FUEL Tracker - Cloudflare Workers Backend
 * Handles API requests, database operations, and business logic
 */

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers,
      })
    }

    try {
      const url = new URL(request.url)
      const pathname = url.pathname

      // Route API requests
      if (pathname.startsWith('/api/')) {
        const route = pathname.slice(5) // Remove '/api/' prefix

        // Health check
        if (route === 'health') {
          return new Response(
            JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
            { status: 200, headers }
          )
        }

        // User endpoints
        if (route.startsWith('user/')) {
          return handleUserRoute(route, request, env, headers)
        }

        // Food log endpoints
        if (route.startsWith('food-log/')) {
          return handleFoodLogRoute(route, request, env, headers)
        }

        // Weight tracking endpoints
        if (route.startsWith('weight/')) {
          return handleWeightRoute(route, request, env, headers)
        }

        // Analytics endpoints
        if (route.startsWith('analytics/')) {
          return handleAnalyticsRoute(route, request, env, headers)
        }

        // Recipe endpoints
        if (route.startsWith('recipes/')) {
          return handleRecipesRoute(route, request, env, headers)
        }

        return new Response(
          JSON.stringify({ error: 'Route not found', path: pathname }),
          { status: 404, headers }
        )
      }

      // Serve frontend assets via ASSETS binding
      if (request.method === 'GET') {
        const response = await env.ASSETS.fetch(request)
        if (response.status === 404) {
          // Return index.html for SPA routing
          return await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)))
        }
        return response
      }

      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers }
      )
    } catch (error) {
      console.error('Worker error:', error)
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  },
}

// Route handlers

async function handleUserRoute(route, request, env, headers) {
  const db = env['fuel-db']

  if (route === 'user/profile' && request.method === 'GET') {
    // TODO: Get user profile from D1
    return new Response(
      JSON.stringify({ message: 'Get user profile endpoint' }),
      { status: 200, headers }
    )
  }

  if (route === 'user/profile' && request.method === 'POST') {
    // TODO: Update user profile in D1
    return new Response(
      JSON.stringify({ message: 'Update user profile endpoint' }),
      { status: 200, headers }
    )
  }

  return new Response(
    JSON.stringify({ error: 'User endpoint not found' }),
    { status: 404, headers }
  )
}

async function handleFoodLogRoute(route, request, env, headers) {
  const db = env['fuel-db']

  if (route === 'food-log/log' && request.method === 'POST') {
    // TODO: Log food entry to D1
    return new Response(
      JSON.stringify({ message: 'Log food entry endpoint' }),
      { status: 201, headers }
    )
  }

  if (route === 'food-log/daily' && request.method === 'GET') {
    // TODO: Get daily food log from D1
    return new Response(
      JSON.stringify({ message: 'Get daily food log endpoint' }),
      { status: 200, headers }
    )
  }

  return new Response(
    JSON.stringify({ error: 'Food log endpoint not found' }),
    { status: 404, headers }
  )
}

async function handleWeightRoute(route, request, env, headers) {
  const db = env['fuel-db']

  if (route === 'weight/entry' && request.method === 'POST') {
    // TODO: Add weight entry to D1
    return new Response(
      JSON.stringify({ message: 'Add weight entry endpoint' }),
      { status: 201, headers }
    )
  }

  if (route === 'weight/history' && request.method === 'GET') {
    // TODO: Get weight history from D1
    return new Response(
      JSON.stringify({ message: 'Get weight history endpoint' }),
      { status: 200, headers }
    )
  }

  return new Response(
    JSON.stringify({ error: 'Weight endpoint not found' }),
    { status: 404, headers }
  )
}

async function handleAnalyticsRoute(route, request, env, headers) {
  const db = env['fuel-db']

  if (route === 'analytics/daily' && request.method === 'GET') {
    // TODO: Get daily analytics from D1
    return new Response(
      JSON.stringify({ message: 'Get daily analytics endpoint' }),
      { status: 200, headers }
    )
  }

  if (route === 'analytics/weekly' && request.method === 'GET') {
    // TODO: Get weekly analytics from D1
    return new Response(
      JSON.stringify({ message: 'Get weekly analytics endpoint' }),
      { status: 200, headers }
    )
  }

  return new Response(
    JSON.stringify({ error: 'Analytics endpoint not found' }),
    { status: 404, headers }
  )
}

async function handleRecipesRoute(route, request, env, headers) {
  const db = env['fuel-db']

  if (route === 'recipes/list' && request.method === 'GET') {
    // TODO: Get recipes from D1
    return new Response(
      JSON.stringify({ message: 'Get recipes endpoint' }),
      { status: 200, headers }
    )
  }

  if (route === 'recipes/import' && request.method === 'POST') {
    // TODO: Import recipe to D1
    return new Response(
      JSON.stringify({ message: 'Import recipe endpoint' }),
      { status: 201, headers }
    )
  }

  return new Response(
    JSON.stringify({ error: 'Recipes endpoint not found' }),
    { status: 404, headers }
  )
}
