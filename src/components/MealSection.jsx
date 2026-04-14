import React, { useState } from 'react'
import FoodItem from './FoodItem'

const MealSection = ({ mealType, items, totals, onAddFood, onDeleteFood, onUpdateFood }) => {
  const [isExpanded, setIsExpanded] = useState(true)

  const caloriesLabel = totals?.calories || 0
  const proteinLabel = totals?.protein || 0

  return (
    <div
      className="border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between transition"
        style={{
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <svg
            className={`w-5 h-5 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="text-left">
            <div className="font-semibold text-sm">{mealType}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {items.length > 0
                ? `${items.length} ${items.length === 1 ? 'item' : 'items'}`
                : 'No items'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div
              className="text-sm font-semibold"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {caloriesLabel}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {proteinLabel}g protein
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddFood()
            }}
            className="p-1.5 rounded transition"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--bg-primary)',
            }}
            aria-label={`Add to ${mealType}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 py-2">
          {items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <FoodItem
                  key={item.id}
                  item={item}
                  onDelete={() => onDeleteFood(item.id)}
                  onUpdate={(updates) => onUpdateFood(item.id, updates)}
                />
              ))}
            </div>
          ) : (
            <div
              className="py-3 text-center text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              No items yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MealSection
