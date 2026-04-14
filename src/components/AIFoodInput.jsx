import React, { useState } from 'react'
import FlameIcon from './FlameIcon'

const AIFoodInput = ({ onSave, onClose }) => {
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim()) return

    setIsLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/ai/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze food')
      }

      const data = await response.json()
      setResults(data.foods || [])
    } catch (err) {
      setError(err.message || 'Error analyzing food. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveAll = () => {
    if (results && results.length > 0) {
      results.forEach((food) => {
        onSave({
          food_name: food.name,
          calories: Math.round(food.calories || 0),
          protein: Math.round(food.protein || 0),
          carbs: food.carbs || 0,
          fat: food.fat || 0,
          serving_size: food.portion || '',
        })
      })
    }
  }

  if (results && results.length > 0) {
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid rgba(240, 136, 62, 0.15)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <FlameIcon size={14} simplified />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-warm)' }}>
              Detected Foods
            </span>
          </div>

          {results.map((food, idx) => (
            <div
              key={idx}
              className="p-3 rounded border mb-3 last:mb-0"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-sm">{food.name}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {food.portion}
                  </div>
                </div>
                <div
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor:
                      food.confidence === 'high'
                        ? 'var(--accent-success)'
                        : food.confidence === 'medium'
                          ? 'var(--accent-warm)'
                          : 'var(--text-tertiary)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  {food.confidence}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Cal</div>
                  <div className="font-semibold">
                    {Math.round(food.calories || 0)}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Protein</div>
                  <div className="font-semibold" style={{ color: 'var(--macro-protein)' }}>
                    {Math.round(food.protein || 0)}g
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Carbs</div>
                  <div className="font-semibold" style={{ color: 'var(--macro-carbs)' }}>
                    {Math.round(food.carbs || 0)}g
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Fat</div>
                  <div className="font-semibold" style={{ color: 'var(--macro-fat)' }}>
                    {Math.round(food.fat || 0)}g
                  </div>
                </div>
              </div>
            </div>
          ))}

          {results[0]?.assumptions && (
            <div className="mt-4 p-3 rounded border" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                Assumptions
              </div>
              <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                {results[0].assumptions.map((assumption, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span>•</span>
                    <span>{assumption}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveAll}
            className="flex-1 px-4 py-3 rounded font-medium transition"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--bg-primary)',
            }}
          >
            Save All
          </button>
          <button
            onClick={() => {
              setResults(null)
              setDescription('')
            }}
            className="px-4 py-3 rounded border font-medium transition"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--accent-primary)',
            }}
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* FUEL AI Badge */}
      <div className="flex items-center gap-1.5 mb-1">
        <FlameIcon size={16} simplified />
        <span className="text-xs font-semibold" style={{ color: 'var(--accent-warm)', letterSpacing: '0.04em' }}>FUEL AI</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
            What did you eat?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: 2 eggs, slice of toast with butter, and a banana"
            className="w-full px-3 py-2 rounded border text-sm resize-none focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
              focusRingColor: 'var(--accent-primary)',
            }}
            rows={4}
            disabled={isLoading}
          />
        </div>

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

        <button
          type="submit"
          disabled={isLoading || !description.trim()}
          className="w-full px-4 py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #F0983E, #E07020)',
            color: '#fff',
            border: 'none',
          }}
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyzing...
            </>
          ) : (
            'Analyze with AI'
          )}
        </button>
      </form>

      <div className="text-xs pt-2" style={{ color: 'var(--text-secondary)' }}>
        Be specific about portions (e.g., "large apple", "2 slices", "1 bowl") for better accuracy.
      </div>
    </div>
  )
}

export default AIFoodInput
