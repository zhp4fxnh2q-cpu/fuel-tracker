import React, { useState } from 'react'

const QuickAddForm = ({ onSave, onClose }) => {
  const [formData, setFormData] = useState({
    food_name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.food_name.trim() || !formData.calories) {
      alert('Please enter food name and calories')
      return
    }

    onSave({
      food_name: formData.food_name.trim(),
      calories: parseInt(formData.calories) || 0,
      protein: parseFloat(formData.protein) || 0,
      carbs: parseFloat(formData.carbs) || 0,
      fat: parseFloat(formData.fat) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
          Food Name
        </label>
        <input
          type="text"
          name="food_name"
          value={formData.food_name}
          onChange={handleChange}
          placeholder="e.g., Grilled Chicken Breast"
          className="w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
            Calories *
          </label>
          <input
            type="number"
            name="calories"
            value={formData.calories}
            onChange={handleChange}
            placeholder="250"
            className="w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
            Protein (g) *
          </label>
          <input
            type="number"
            name="protein"
            value={formData.protein}
            onChange={handleChange}
            placeholder="30"
            step="0.1"
            className="w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
            Carbs (g)
          </label>
          <input
            type="number"
            name="carbs"
            value={formData.carbs}
            onChange={handleChange}
            placeholder="0"
            step="0.1"
            className="w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
            Fat (g)
          </label>
          <input
            type="number"
            name="fat"
            value={formData.fat}
            onChange={handleChange}
            placeholder="0"
            step="0.1"
            className="w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          className="flex-1 px-4 py-3 rounded font-medium transition"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--bg-primary)',
          }}
        >
          Add Food
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-3 rounded border font-medium transition"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default QuickAddForm
