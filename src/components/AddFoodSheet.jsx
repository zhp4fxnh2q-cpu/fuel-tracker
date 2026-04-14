import React, { useState, useCallback, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getRecentFoods, getFavoriteFoods, getImportedRecipes, getFoodLog } from '../lib/db'
import { fetchTodaysPlan } from '../lib/mealPlannerData'
import AIFoodInput from './AIFoodInput'
import QuickAddForm from './QuickAddForm'
import FavoriteFoodsList from './FavoriteFoodsList'
import RecentFoodsList from './RecentFoodsList'
import MealPlanList from './MealPlanList'
import USDASearch from './USDASearch'

const AddFoodSheet = ({ mealType, date, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState('ai')
  const [isLoading, setIsLoading] = useState(false)
  const [plannedMeal, setPlannedMeal] = useState(null)
  const [showPlannedEntry, setShowPlannedEntry] = useState(false)
  const [plannedMacros, setPlannedMacros] = useState(null)

  const recentFoods = useLiveQuery(() => getRecentFoods(20))
  const favoriteFoods = useLiveQuery(() => getFavoriteFoods())
  const importedRecipes = useLiveQuery(() => getImportedRecipes())

  // Fetch today's planned meal for this slot
  useEffect(() => {
    (async () => {
      try {
        const plan = await fetchTodaysPlan(date);
        const meal = plan[mealType];
        if (meal) {
          setPlannedMeal(meal);
          // Check if we have previous macros for this meal
          const foodLog = await getFoodLog(date);
          const prev = foodLog.find(e => e.food_name === meal.name);
          if (prev) {
            setPlannedMacros({
              calories: prev.calories,
              protein_g: prev.protein_g,
              carbs_g: prev.carbs_g,
              fat_g: prev.fat_g,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching planned meal:', err);
      }
    })();
  }, [date, mealType]);

  const tabs = [
    { id: 'ai', label: 'AI Log' },
    { id: 'quick', label: 'Quick Add' },
    { id: 'recipes', label: 'Meals' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'recent', label: 'Recent' },
    { id: 'search', label: 'Search' },
  ]

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
  }

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
          <div>
            <h2 className="text-lg font-600">Add Food</h2>
            <div className="text-xs mt-1 font-500" style={{ color: 'var(--text-secondary)' }}>
              {mealType}
            </div>
          </div>
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

        {/* Planned Meal Card */}
        {plannedMeal && !showPlannedEntry && (
          <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="text-xs font-600 mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Today's Plan
            </div>
            <button
              onClick={() => setShowPlannedEntry(true)}
              className="w-full p-4 rounded-xl text-left transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, rgba(240, 152, 62, 0.12), rgba(224, 112, 32, 0.08))',
                border: '1px solid rgba(240, 152, 62, 0.25)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {plannedMeal.name}
                  </div>
                  <div className="text-xs mt-1.5 flex gap-2 items-center">
                    <span
                      className="px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: 'rgba(240, 152, 62, 0.15)',
                        color: '#F0983E',
                        fontSize: '11px',
                      }}
                    >
                      {plannedMeal.cuisine}
                    </span>
                    {plannedMacros && (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                        Last: {plannedMacros.calories} cal
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-xs font-600" style={{ color: '#F0983E' }}>Log</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F0983E" strokeWidth="2">
                    <path d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Planned Meal Quick Entry */}
        {showPlannedEntry && plannedMeal && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <PlannedMealEntry
              meal={plannedMeal}
              previousMacros={plannedMacros}
              onBack={() => setShowPlannedEntry(false)}
              onSave={(foodData) => {
                onSave(foodData);
                onClose();
              }}
            />
          </div>
        )}

        {/* Tabs + Content (hidden when entering planned meal) */}
        {!showPlannedEntry && (
          <>
            <div
              className="px-6 pt-3 flex gap-2 overflow-x-auto border-b scrollbar-hide"
              style={{ borderColor: 'var(--border)' }}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className="px-4 py-2 rounded-lg text-sm font-500 whitespace-nowrap transition"
                    style={{
                      backgroundColor: isActive ? 'rgba(88, 166, 255, 0.12)' : 'transparent',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {activeTab === 'ai' && <AIFoodInput onSave={onSave} onClose={onClose} />}
              {activeTab === 'quick' && <QuickAddForm onSave={onSave} onClose={onClose} />}
              {activeTab === 'recipes' && (
                <MealPlanList
                  recipes={importedRecipes || []}
                  onSave={onSave}
                  onClose={onClose}
                  date={date}
                />
              )}
              {activeTab === 'favorites' && (
                <FavoriteFoodsList
                  foods={favoriteFoods || []}
                  onSave={onSave}
                  onClose={onClose}
                />
              )}
              {activeTab === 'recent' && (
                <RecentFoodsList
                  foods={recentFoods || []}
                  onSave={onSave}
                  onClose={onClose}
                />
              )}
              {activeTab === 'search' && (
                <USDASearch onSave={onSave} onClose={onClose} />
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

/**
 * Quick entry form for a planned meal
 */
function PlannedMealEntry({ meal, previousMacros, onBack, onSave }) {
  const [calories, setCalories] = useState(previousMacros?.calories || '');
  const [protein, setProtein] = useState(previousMacros?.protein_g || '');
  const [carbs, setCarbs] = useState(previousMacros?.carbs_g || '');
  const [fat, setFat] = useState(previousMacros?.fat_g || '');

  const handleSave = () => {
    onSave({
      food_name: meal.name,
      calories: parseFloat(calories) || 0,
      protein_g: parseFloat(protein) || 0,
      carbs_g: parseFloat(carbs) || 0,
      fat_g: parseFloat(fat) || 0,
    });
  };

  const isValid = calories && parseFloat(calories) > 0;

  return (
    <div className="space-y-4">
      {/* Meal Header */}
      <div className="p-4 rounded-xl" style={{
        background: 'linear-gradient(135deg, rgba(240, 152, 62, 0.12), rgba(224, 112, 32, 0.08))',
        border: '1px solid rgba(240, 152, 62, 0.25)',
      }}>
        <div className="text-xs font-600 mb-2" style={{ color: '#F0983E', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Planned Meal
        </div>
        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          {meal.name}
        </div>
        <div className="text-xs mt-2 flex gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(240, 152, 62, 0.15)', color: '#F0983E' }}>
            {meal.cuisine}
          </span>
        </div>
        {previousMacros && (
          <div className="text-xs mt-3 pt-3 border-t" style={{ borderColor: 'rgba(240, 152, 62, 0.2)', color: 'var(--text-tertiary)' }}>
            Previously logged: {previousMacros.calories} cal, {previousMacros.protein_g}g P
          </div>
        )}
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
          placeholder="Enter calories"
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
            placeholder="0"
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
            placeholder="0"
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
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-4">
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="flex-1 px-4 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isValid ? 'linear-gradient(135deg, #F0983E, #E07020)' : 'var(--text-tertiary)',
            color: '#fff',
          }}
        >
          Log It
        </button>
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 rounded-lg border font-medium transition"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
}

export default AddFoodSheet
