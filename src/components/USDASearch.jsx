import React, { useState } from 'react'

const USDASearch = ({ onSave, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedResult, setSelectedResult] = useState(null)
  const [grams, setGrams] = useState('100')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    setIsLoading(true)
    setError(null)
    setSearchResults([])
    setSelectedResult(null)

    try {
      const response = await fetch('/api/nutrition/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setSearchResults(data.foods || [])

      if (data.foods && data.foods.length === 0) {
        setError('No results found')
      }
    } catch (err) {
      setError(err.message || 'Error searching USDA database')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectFood = (food) => {
    setSelectedResult(food)
    setGrams('100')
  }

  const handleSaveSelected = () => {
    if (!selectedResult || !grams) return

    const gramsValue = parseFloat(grams) || 100
    const multiplier = gramsValue / 100

    const calories = Math.round((selectedResult.calories || 0) * multiplier)
    const protein = Math.round((selectedResult.protein || 0) * multiplier * 10) / 10
    const carbs = Math.round((selectedResult.carbs || 0) * multiplier * 10) / 10
    const fat = Math.round((selectedResult.fat || 0) * multiplier * 10) / 10

    onSave({
      food_name: `${selectedResult.name} (${gramsValue}g)`,
      calories,
      protein,
      carbs,
      fat,
      serving_size: `${gramsValue}g`,
    })
  }

  if (selectedResult) {
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="font-semibold text-sm mb-3">{selectedResult.name}</div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
                Weight (grams)
              </label>
              <input
                type="number"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                className="w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                Nutritional values are per 100g
              </div>
            </div>

            {/* Nutrition Preview */}
            {grams && (
              <div
                className="p-3 rounded border"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Nutrition for {grams}g
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Calories</div>
                    <div className="font-semibold mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {Math.round((selectedResult.calories || 0) * (parseFloat(grams) / 100))}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Protein</div>
                    <div className="font-semibold mt-1" style={{ color: 'var(--macro-protein)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {Math.round((selectedResult.protein || 0) * (parseFloat(grams) / 100) * 10) / 10}g
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Carbs</div>
                    <div className="font-semibold mt-1" style={{ color: 'var(--macro-carbs)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {Math.round((selectedResult.carbs || 0) * (parseFloat(grams) / 100) * 10) / 10}g
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Fat</div>
                    <div className="font-semibold mt-1" style={{ color: 'var(--macro-fat)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {Math.round((selectedResult.fat || 0) * (parseFloat(grams) / 100) * 10) / 10}g
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveSelected}
            disabled={!grams || parseFloat(grams) <= 0}
            className="flex-1 px-4 py-3 rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--bg-primary)',
            }}
          >
            Add Food
          </button>
          <button
            onClick={() => {
              setSelectedResult(null)
              setGrams('100')
            }}
            className="flex-1 px-4 py-3 rounded border font-medium transition"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
            Search USDA Database
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g., chicken breast, banana, milk"
            className="w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !searchTerm.trim()}
          className="w-full px-4 py-3 rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--bg-primary)',
          }}
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching...
            </>
          ) : (
            'Search'
          )}
        </button>
      </form>

      {error && (
        <div
          className="p-3 rounded text-sm"
          style={{
            backgroundColor: '#3d2422',
            color: '#f85149',
          }}
        >
          {error}
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Results
          </div>
          {searchResults.map((food, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectFood(food)}
              className="w-full p-3 rounded-lg border text-left transition"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="font-semibold text-sm">{food.name}</div>
              <div className="text-xs mt-2 flex gap-3" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {Math.round(food.calories || 0)} cal/100g
                </span>
                <span>{Math.round(food.protein || 0)}g protein</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default USDASearch
