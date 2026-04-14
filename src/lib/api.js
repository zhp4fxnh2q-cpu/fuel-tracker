/**
 * API client utilities for communicating with Cloudflare Workers backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 30000

class APIClient {
  constructor(baseUrl = API_BASE_URL, timeout = API_TIMEOUT) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      timeout = this.timeout,
    } = options

    const url = `${this.baseUrl}/api/${endpoint}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || `API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      throw new Error(`API request failed: ${error.message}`)
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' })
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body })
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body })
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' })
  }
}

export const apiClient = new APIClient()

// User API
export const userAPI = {
  async getProfile() {
    return await apiClient.get('user/profile')
  },

  async updateProfile(profileData) {
    return await apiClient.post('user/profile', profileData)
  },

  async getSettings() {
    return await apiClient.get('user/settings')
  },

  async updateSettings(settings) {
    return await apiClient.put('user/settings', settings)
  },
}

// Food Log API
export const foodLogAPI = {
  async logFood(foodData) {
    return await apiClient.post('food-log/log', foodData)
  },

  async getDailyLog(date) {
    return await apiClient.get(`food-log/daily?date=${date}`)
  },

  async removeFoodEntry(entryId) {
    return await apiClient.delete(`food-log/entry/${entryId}`)
  },

  async searchFoods(query) {
    return await apiClient.get(`food-log/search?q=${encodeURIComponent(query)}`)
  },

  async getFoodDetails(foodId) {
    return await apiClient.get(`food-log/food/${foodId}`)
  },
}

// Weight API
export const weightAPI = {
  async addEntry(weight, date = new Date().toISOString().split('T')[0]) {
    return await apiClient.post('weight/entry', { weight, date })
  },

  async getHistory(days = 90) {
    return await apiClient.get(`weight/history?days=${days}`)
  },

  async getLatest() {
    return await apiClient.get('weight/latest')
  },

  async removeEntry(entryId) {
    return await apiClient.delete(`weight/entry/${entryId}`)
  },
}

// Analytics API
export const analyticsAPI = {
  async getDailyAnalytics(date) {
    return await apiClient.get(`analytics/daily?date=${date}`)
  },

  async getWeeklyAnalytics(weekStart) {
    return await apiClient.get(`analytics/weekly?weekStart=${weekStart}`)
  },

  async getMonthlyAnalytics(month) {
    return await apiClient.get(`analytics/monthly?month=${month}`)
  },

  async getTrendAnalytics(days = 30) {
    return await apiClient.get(`analytics/trend?days=${days}`)
  },

  async getMacroBreakdown(date) {
    return await apiClient.get(`analytics/macros?date=${date}`)
  },
}

// Recipes API
export const recipesAPI = {
  async getRecipes() {
    return await apiClient.get('recipes/list')
  },

  async importRecipe(recipeData) {
    return await apiClient.post('recipes/import', recipeData)
  },

  async getRecipeDetails(recipeId) {
    return await apiClient.get(`recipes/${recipeId}`)
  },

  async updateRecipe(recipeId, data) {
    return await apiClient.put(`recipes/${recipeId}`, data)
  },

  async deleteRecipe(recipeId) {
    return await apiClient.delete(`recipes/${recipeId}`)
  },

  async searchRecipes(query) {
    return await apiClient.get(`recipes/search?q=${encodeURIComponent(query)}`)
  },
}

// Custom Foods API
export const customFoodsAPI = {
  async getCustomFoods() {
    return await apiClient.get('custom-foods/list')
  },

  async addCustomFood(foodData) {
    return await apiClient.post('custom-foods/add', foodData)
  },

  async updateCustomFood(foodId, data) {
    return await apiClient.put(`custom-foods/${foodId}`, data)
  },

  async deleteCustomFood(foodId) {
    return await apiClient.delete(`custom-foods/${foodId}`)
  },
}

// Recommendations API
export const recommendationsAPI = {
  async getMacroRecommendations() {
    return await apiClient.get('recommendations/macros')
  },

  async getAdjustmentRecommendations() {
    return await apiClient.get('recommendations/adjustments')
  },

  async getFoodRecommendations() {
    return await apiClient.get('recommendations/foods')
  },
}

// Health check
export const systemAPI = {
  async healthCheck() {
    return await apiClient.get('health')
  },
}

export default apiClient
