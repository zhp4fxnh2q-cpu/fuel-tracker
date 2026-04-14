import React, { useState } from 'react'

const PortionPicker = ({ recipe, onClose, onSave }) => {
  const [portionMode, setPortionMode] = useState('regular')
  const [customGrams, setCustomGrams] = useState('')

  const portionMultipliers = {
    half: 0.5,
    regular: 1.0,
    large: 1.5,
  }

  const getMultiplier = () => {
    if (portionMode === 'custom') {
      const cooked = recipe.estimated_total_cooked_g || 100
      return customGrams / cooked
    }
    return portionMultipliers[portionMode] || 1.0
  }

  const multiplier = getMultiplier()

  const calories = Math.round((recipe.total_calories || 0) * multiplier)
  const protein = Math.round((recipe.total_protein || 0) * multiplier * 10) / 10
  const carbs = Math.round((recipe.total_carbs || 0) * multiplier * 10) / 10
  const fat = Math.round((recipe.total_fat || 0) * multiplier * 10) / 10

  const handleSave = () => {
    onSave({
      food_name: recipe.meal_name,
      calories,
      protein,
      carbs,
      fat,
      serving_size: `${portionMode === 'custom' ? customGrams + 'g' : portionMode}`,
    })
  }

  const isValid = portionMode !== 'custom' || (customGrams && parseFloat(customGrams) > 0)

  return (
    <div className="space-y-4">
      {/* Recipe Header */}
      <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <div className="font-semibold text-sm">{recipe.meal_name}</div>
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            <div className="font-semibold mb-1">Ingredients:</div>
            <ul className="space-y-0.5">
              {recipe.ingredients.slice(0, 5).map((ingredient, idx) => (
                <li key={idx}>{ingredient}</li>
              ))}
              {recipe.ingredients.length > 5 && <li>+{recipe.ingredients.length - 5} more</li>}
            </ul>
          </div>
        )}
      </div>

      {/* Portion Options */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
          Portion Size
        </div>

        <div className="space-y-2">
          {/* Half */}
          <button
            onClick={() => setPortionMode('half')}
            className="w-full p-3 rounded-lg border text-left transition"
            style={{
              backgroundColor: portionMode === 'half' ? 'var(--bg-elevated)' : 'var(--bg-primary)',
              borderColor: portionMode === 'half' ? 'var(--accent-primary)' : 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Half</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  50% of the recipe
                </div>
              </div>
              {portionMode === 'half' && (
                <svg className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>

          {/* Regular */}
          <button
            onClick={() => setPortionMode('regular')}
            className="w-full p-3 rounded-lg border text-left transition"
            style={{
              backgroundColor: portionMode === 'regular' ? 'var(--bg-elevated)' : 'var(--bg-primary)',
              borderColor: portionMode === 'regular' ? 'var(--accent-primary)' : 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Regular</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Full recipe (1x)
                </div>
              </div>
              {portionMode === 'regular' && (
                <svg className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>

          {/* Large */}
          <button
            onClick={() => setPortionMode('large')}
            className="w-full p-3 rounded-lg border text-left transition"
            style={{
              backgroundColor: portionMode === 'large' ? 'var(--bg-elevated)' : 'var(--bg-primary)',
              borderColor: portionMode === 'large' ? 'var(--accent-primary)' : 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Large</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  150% of the recipe
                </div>
              </div>
              {portionMode === 'large' && (
                <svg className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>

          {/* Custom */}
          <button
            onClick={() => setPortionMode('custom')}
            className="w-full p-3 rounded-lg border text-left transition"
            style={{
              backgroundColor: portionMode === 'custom' ? 'var(--bg-elevated)' : 'var(--bg-primary)',
              borderColor: portionMode === 'custom' ? 'var(--accent-primary)' : 'var(--border)',
            }}
          >
            <div className="font-semibold text-sm">Custom</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Enter weight in grams
            </div>
          </button>
        </div>

        {/* Custom Weight Input */}
        {portionMode === 'custom' && (
          <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
              Weight (grams)
            </label>
            <input
              type="number"
              value={customGrams}
              onChange={(e) => setCustomGrams(e.target.value)}
              placeholder={`e.g., ${recipe.estimated_total_cooked_g || 100}`}
              className="w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {recipe.estimated_total_cooked_g && (
              <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                Full recipe: {recipe.estimated_total_cooked_g}g
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nutrition Preview */}
      <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
          Nutrition Preview
        </div>
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div>
            <div style={{ color: 'var(--text-secondary)' }} className="text-xs">
              Calories
            </div>
            <div className="font-semibold mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {calories}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)' }} className="text-xs">
              Protein
            </div>
            <div className="font-semibold mt-1" style={{ color: 'var(--macro-protein)', fontFamily: "'JetBrains Mono', monospace" }}>
              {protein}g
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)' }} className="text-xs">
              Carbs
            </div>
            <div className="font-semibold mt-1" style={{ color: 'var(--macro-carbs)', fontFamily: "'JetBrains Mono', monospace" }}>
              {carbs}g
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)' }} className="text-xs">
              Fat
            </div>
            <div className="font-semibold mt-1" style={{ color: 'var(--macro-fat)', fontFamily: "'JetBrains Mono', monospace" }}>
              {fat}g
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="flex-1 px-4 py-3 rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isValid ? 'var(--accent-primary)' : 'var(--text-tertiary)',
            color: 'var(--bg-primary)',
          }}
        >
          Log It
        </button>
        <button
          onClick={onClose}
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

export default PortionPicker
