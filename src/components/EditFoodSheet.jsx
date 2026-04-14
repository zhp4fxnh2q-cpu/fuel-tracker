import React, { useState } from 'react';
import { updateFoodEntry, deleteFoodEntry } from '../lib/db';

const EditFoodSheet = ({ entry, onClose, onSave }) => {
  const [foodName, setFoodName] = useState(entry.food_name);
  const [meal, setMeal] = useState(entry.meal);
  const [calories, setCalories] = useState(entry.calories);
  const [protein, setProtein] = useState(entry.protein_g);
  const [carbs, setCarbs] = useState(entry.carbs_g);
  const [fat, setFat] = useState(entry.fat_g);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
  const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

  const handleSave = async () => {
    await updateFoodEntry(entry.id, {
      food_name: foodName,
      meal,
      calories: parseFloat(calories) || 0,
      protein_g: parseFloat(protein) || 0,
      carbs_g: parseFloat(carbs) || 0,
      fat_g: parseFloat(fat) || 0,
    });
    onSave?.();
    onClose();
  };

  const handleDelete = async () => {
    await deleteFoodEntry(entry.id);
    onSave?.();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 rounded-t-3xl z-50 max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        style={{
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'var(--border)',
            }}
          />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-600">Edit Food</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Food Name */}
            <div>
              <label className="text-sm font-600 block mb-2" style={{ color: 'var(--text-secondary)' }}>
                Food Name
              </label>
              <input
                type="text"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Meal Type */}
            <div>
              <label className="text-sm font-600 block mb-3" style={{ color: 'var(--text-secondary)' }}>
                Meal Type
              </label>
              <div className="flex gap-2 flex-wrap">
                {MEALS.map((mealType) => (
                  <button
                    key={mealType}
                    onClick={() => setMeal(mealType)}
                    className="px-4 py-2 rounded-lg text-sm font-500 transition"
                    style={{
                      backgroundColor: meal === mealType ? 'rgba(88, 166, 255, 0.12)' : 'var(--bg-elevated)',
                      color: meal === mealType ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderColor: meal === mealType ? 'var(--accent-primary)' : 'var(--border)',
                      border: '1px solid',
                    }}
                  >
                    {MEAL_LABELS[mealType]}
                  </button>
                ))}
              </div>
            </div>

            {/* Calories */}
            <div>
              <label className="text-sm font-600 block mb-2" style={{ color: 'var(--text-secondary)' }}>
                Calories
              </label>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Macros */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-600 block mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Protein (g)
                </label>
                <input
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-600 block mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Carbs (g)
                </label>
                <input
                  type="number"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-600 block mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Fat (g)
                </label>
                <input
                  type="number"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 py-6 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleSave}
            className="w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #F0983E, #E07020)',
              color: '#fff',
              border: 'none',
            }}
          >
            Save Changes
          </button>

          {!showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all"
              style={{
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                color: '#e74c3c',
                border: '1px solid rgba(231, 76, 60, 0.2)',
              }}
            >
              Delete
            </button>
          )}

          {showDeleteConfirm && (
            <>
              <div className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                Are you sure? This cannot be undone.
              </div>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all"
                style={{
                  backgroundColor: '#e74c3c',
                  color: '#fff',
                  border: 'none',
                }}
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                Cancel
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            Back
          </button>
        </div>
      </div>
    </>
  );
};

export default EditFoodSheet;
