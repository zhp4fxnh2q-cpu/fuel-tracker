import React from 'react'
import FlameIcon from './FlameIcon'

const RecentFoodsList = ({ foods, onSave, onClose }) => {
  const handleSelect = (food) => {
    onSave({
      food_name: food.food_name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
    })
  }

  if (!foods || foods.length === 0) {
    return (
      <div className="text-center py-8">
        <FlameIcon size={36} opacity={0.15} simplified style={{ margin: '0 auto 12px' }} />
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No recent foods yet
        </div>
        <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Your recently logged foods will appear here
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {foods.map((food) => (
        <button
          key={food.id}
          onClick={() => handleSelect(food)}
          className="w-full p-3 rounded-lg text-left transition"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-semibold text-sm">{food.food_name}</div>
              <div className="text-xs mt-1 flex gap-3" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {food.calories} cal
                </span>
                <span>{food.protein}g protein</span>
              </div>
            </div>
            <svg className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      ))}
    </div>
  )
}

export default RecentFoodsList
