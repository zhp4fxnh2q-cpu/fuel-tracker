import React, { useState, useMemo, useEffect } from 'react';
import { getAllMealPlannerMeals } from '../lib/mealPlannerData';
import { getFoodLog } from '../lib/db';
import FlameIcon from './FlameIcon';

const MealPlanList = ({ onSave, onClose, date }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [meals, setMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mealMacros, setMealMacros] = useState({});

  // Load all meals on mount
  useEffect(() => {
    (async () => {
      const allMeals = await getAllMealPlannerMeals();
      setMeals(allMeals);
      setIsLoading(false);
    })();
  }, []);

  // Load macro history for meals
  useEffect(() => {
    (async () => {
      const foodLog = await getFoodLog(date || new Date().toISOString().split('T')[0]);
      const macroMap = {};
      foodLog.forEach(entry => {
        if (!macroMap[entry.food_name]) {
          macroMap[entry.food_name] = {
            calories: entry.calories,
            protein_g: entry.protein_g,
            carbs_g: entry.carbs_g,
            fat_g: entry.fat_g,
          };
        }
      });
      setMealMacros(macroMap);
    })();
  }, [date]);

  // Filter and sort meals
  const filteredMeals = useMemo(() => {
    let filtered = meals;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = meals.filter(meal =>
        meal.name.toLowerCase().includes(query) ||
        meal.cuisine.toLowerCase().includes(query)
      );
    }

    // Sort alphabetically
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [meals, searchQuery]);

  const handleMealSelect = (meal) => {
    setSelectedMeal(meal);
  };

  const handleSaveMeal = async (foodData) => {
    await onSave(foodData);
    setSelectedMeal(null);
    onClose();
  };

  if (selectedMeal) {
    return (
      <QuickEntryForm
        meal={selectedMeal}
        previousMacros={mealMacros[selectedMeal.name]}
        onClose={() => setSelectedMeal(null)}
        onSave={handleSaveMeal}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="loading-dot" style={{ animationDelay: '0s' }} />
        <div className="loading-dot" style={{ animationDelay: '0.2s' }} />
        <div className="loading-dot" style={{ animationDelay: '0.4s' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="sticky top-0 z-10 pb-2">
        <input
          type="text"
          placeholder="Search meals or cuisine..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Meals List */}
      {filteredMeals.length > 0 ? (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {filteredMeals.map((meal) => (
            <button
              key={meal.id}
              onClick={() => handleMealSelect(meal)}
              className="w-full p-4 rounded-lg text-left transition"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border)',
                border: '1px solid',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {meal.name}
                  </div>
                  <div className="text-xs mt-2 flex gap-2 flex-wrap">
                    <span
                      className="px-2 py-1 rounded"
                      style={{
                        backgroundColor: 'rgba(88, 166, 255, 0.1)',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      {meal.cuisine}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {meal.times.join(', ')}
                    </span>
                  </div>
                </div>
                <svg className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <FlameIcon size={36} opacity={0.15} simplified style={{ margin: '0 auto 12px' }} />
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No meals found
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Try a different search
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Quick entry form for a selected meal
 */
function QuickEntryForm({ meal, previousMacros, onClose, onSave }) {
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
      <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          {meal.name}
        </div>
        <div className="text-xs mt-2 flex gap-2 flex-wrap">
          <span
            className="px-2 py-1 rounded"
            style={{
              backgroundColor: 'rgba(88, 166, 255, 0.1)',
              color: 'var(--accent-primary)',
            }}
          >
            {meal.cuisine}
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            {meal.times.join(', ')}
          </span>
        </div>
        {previousMacros && (
          <div className="text-xs mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}>
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
            backgroundColor: isValid ? 'var(--accent-primary)' : 'var(--text-tertiary)',
            color: isValid ? 'var(--bg-primary)' : 'var(--text-primary)',
          }}
        >
          Log It
        </button>
        <button
          onClick={onClose}
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

export default MealPlanList;
