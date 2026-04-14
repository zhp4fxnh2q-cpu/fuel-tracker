import React, { useState } from 'react'

const FoodItem = ({ item, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState({
    calories: item.calories || 0,
    protein: item.protein || 0,
    carbs: item.carbs || 0,
    fat: item.fat || 0,
  })

  const handleSaveEdit = () => {
    onUpdate(editValues)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditValues({
      calories: item.calories || 0,
      protein: item.protein || 0,
      carbs: item.carbs || 0,
      fat: item.fat || 0,
    })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div
        className="p-3 rounded-lg border"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="text-sm font-medium mb-3">{item.food_name}</div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Calories
              </label>
              <input
                type="number"
                value={editValues.calories}
                onChange={(e) =>
                  setEditValues({
                    ...editValues,
                    calories: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full mt-1 px-2 py-1 rounded text-sm border"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Protein (g)
              </label>
              <input
                type="number"
                value={editValues.protein}
                onChange={(e) =>
                  setEditValues({
                    ...editValues,
                    protein: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full mt-1 px-2 py-1 rounded text-sm border"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveEdit}
              className="flex-1 px-3 py-2 rounded text-sm font-medium transition"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--bg-primary)',
              }}
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex-1 px-3 py-2 rounded text-sm border transition"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="p-3 rounded-lg flex items-center justify-between transition"
      style={{
        backgroundColor: 'var(--bg-elevated)',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(28, 33, 40, 0.8)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
    >
      <div className="flex-1">
        <div className="text-sm font-medium">{item.food_name}</div>
        <div className="text-xs mt-1 flex gap-3" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {item.calories} cal
          </span>
          <span>{item.protein}g protein</span>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-3">
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 rounded transition"
          aria-label="Edit"
          style={{ color: 'var(--accent-primary)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>

        <button
          onClick={() => {
            if (window.confirm(`Delete ${item.food_name}?`)) {
              onDelete()
            }
          }}
          className="p-1.5 rounded transition"
          aria-label="Delete"
          style={{ color: '#f85149' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default FoodItem
