/**
 * Utility functions for FUEL Tracker
 */

// Date utilities
export const dateUtils = {
  today: () => {
    const date = new Date()
    return date.toISOString().split('T')[0]
  },

  formatDate: (date) => {
    if (typeof date === 'string') {
      date = new Date(date)
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  },

  formatTime: (date) => {
    if (typeof date === 'string') {
      date = new Date(date)
    }
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  },

  getWeekStart: (date = new Date()) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toISOString().split('T')[0]
  },

  getWeekEnd: (date = new Date()) => {
    const weekStart = new Date(dateUtils.getWeekStart(date))
    weekStart.setDate(weekStart.getDate() + 6)
    return weekStart.toISOString().split('T')[0]
  },

  getDaysDiff: (date1, date2) => {
    const d1 = new Date(date1).getTime()
    const d2 = new Date(date2).getTime()
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24))
  },

  addDays: (date, days) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  },

  formatRelative: (date) => {
    const now = new Date()
    const then = new Date(date)
    const diff = now - then
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return formatDate(date)
  },
}

// Nutrition utilities
export const nutritionUtils = {
  // Calculate calorie macros from grams
  caloriesFromMacros: (protein, carbs, fat) => {
    return (protein * 4) + (carbs * 4) + (fat * 9)
  },

  // Calculate macro percentages
  macroPercentages: (protein, carbs, fat) => {
    const total = (protein * 4) + (carbs * 4) + (fat * 9)
    if (total === 0) return { protein: 0, carbs: 0, fat: 0 }
    return {
      protein: Math.round((protein * 4 / total) * 100),
      carbs: Math.round((carbs * 4 / total) * 100),
      fat: Math.round((fat * 9 / total) * 100),
    }
  },

  // Format macros for display
  formatMacros: (protein, carbs, fat) => {
    return `P${Math.round(protein)}g / C${Math.round(carbs)}g / F${Math.round(fat)}g`
  },

  // Estimate daily calorie needs (Harris-Benedict equation)
  estimateTDEE: (gender, weight, height, age, activityLevel = 1.55) => {
    let bmr
    if (gender.toLowerCase() === 'male') {
      bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    } else {
      bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)
    }
    return Math.round(bmr * activityLevel)
  },

  // Activity level multipliers
  activityMultipliers: {
    sedentary: 1.2,
    lightlyActive: 1.375,
    moderatelyActive: 1.55,
    veryActive: 1.725,
    extremelyActive: 1.9,
  },
}

// Number formatting
export const formatUtils = {
  number: (num, decimals = 0) => {
    return parseFloat(num).toFixed(decimals)
  },

  calories: (cal) => {
    return Math.round(cal).toLocaleString('en-US')
  },

  grams: (g) => {
    return parseFloat(g).toFixed(1)
  },

  percent: (val, decimals = 1) => {
    return `${parseFloat(val).toFixed(decimals)}%`
  },

  weight: (kg, unit = 'kg') => {
    if (unit === 'lbs') {
      return (kg * 2.20462).toFixed(1)
    }
    return kg.toFixed(1)
  },

  currency: (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  },
}

// Storage utilities
export const storageUtils = {
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Storage set error:', error)
    }
  },

  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.error('Storage get error:', error)
      return defaultValue
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Storage remove error:', error)
    }
  },

  clear: () => {
    try {
      localStorage.clear()
    } catch (error) {
      console.error('Storage clear error:', error)
    }
  },
}

// Validation utilities
export const validationUtils = {
  isValidEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  },

  isValidDate: (date) => {
    const d = new Date(date)
    return d instanceof Date && !isNaN(d)
  },

  isValidNumber: (num) => {
    return !isNaN(parseFloat(num)) && isFinite(num)
  },

  isPositiveNumber: (num) => {
    return validationUtils.isValidNumber(num) && parseFloat(num) > 0
  },

  isEmail: (email) => validationUtils.isValidEmail(email),
  isUrl: (url) => {
    try {
      new URL(url)
      return true
    } catch (error) {
      return false
    }
  },
}

// Color utilities
export const colorUtils = {
  macroColors: {
    protein: '#A5D6FF',
    carbs: '#F0883E',
    fat: '#D2A8FF',
    calories: '#F0F6FC',
  },

  getMacroColor: (macroType) => {
    return colorUtils.macroColors[macroType] || '#58A6FF'
  },

  statusColor: (status) => {
    const colors = {
      success: '#238636',
      warning: '#F0883E',
      error: '#DA3633',
      info: '#58A6FF',
    }
    return colors[status] || '#58A6FF'
  },

  hexToRgba: (hex, alpha = 1) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  },
}

// Array utilities
export const arrayUtils = {
  chunk: (array, size) => {
    const chunks = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  },

  unique: (array, key = null) => {
    if (!key) return [...new Set(array)]
    const seen = new Set()
    return array.filter(item => {
      const k = key(item)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  },

  groupBy: (array, key) => {
    return array.reduce((acc, item) => {
      const group = key(item)
      if (!acc[group]) acc[group] = []
      acc[group].push(item)
      return acc
    }, {}),
  },

  sortBy: (array, key, ascending = true) => {
    return [...array].sort((a, b) => {
      const aVal = typeof key === 'function' ? key(a) : a[key]
      const bVal = typeof key === 'function' ? key(b) : b[key]
      return ascending ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })
  },
}

// String utilities
export const stringUtils = {
  capitalize: (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1)
  },

  titleCase: (str) => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  },

  slugify: (str) => {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
  },

  truncate: (str, length = 100) => {
    return str.length > length ? str.substring(0, length) + '...' : str
  },
}

export default {
  dateUtils,
  nutritionUtils,
  formatUtils,
  storageUtils,
  validationUtils,
  colorUtils,
  arrayUtils,
  stringUtils,
}
