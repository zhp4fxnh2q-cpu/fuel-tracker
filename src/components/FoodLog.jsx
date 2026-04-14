import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addFoodEntry, deleteFoodEntry, getSetting, isTrainingDay as checkTrainingDay } from '../lib/db';
import AddFoodSheet from './AddFoodSheet';
import EditFoodSheet from './EditFoodSheet';
import FlameIcon from './FlameIcon';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export default function FoodLog() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddFood, setShowAddFood] = useState(false);
  const [activeMeal, setActiveMeal] = useState('breakfast');
  const [expandedMeals, setExpandedMeals] = useState({ breakfast: true, lunch: true, dinner: true, snack: true });
  const [calorieTarget, setCalorieTarget] = useState(2150);
  const [proteinTarget, setProteinTarget] = useState(200);
  const [editingEntry, setEditingEntry] = useState(null);

  const dateStr = selectedDate.toISOString().split('T')[0];
  const isToday = dateStr === new Date().toISOString().split('T')[0];

  // Live food log for this date
  const foodEntries = useLiveQuery(
    () => db.foodLog.where('date').equals(dateStr).toArray(),
    [dateStr]
  );

  // Load targets
  useEffect(() => {
    (async () => {
      const isTD = await checkTrainingDay(dateStr);
      const tdCal = await getSetting('trainingDayCalories');
      const rdCal = await getSetting('restDayCalories');
      const pTarget = await getSetting('dailyProteinTarget');
      setCalorieTarget(isTD ? (Number(tdCal) || 2650) : (Number(rdCal) || 2150));
      if (pTarget) setProteinTarget(Number(pTarget));
    })();
  }, [dateStr]);

  // Compute totals
  const totals = useMemo(() => {
    const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    (foodEntries || []).forEach(e => {
      t.calories += e.calories || 0;
      t.protein_g += e.protein_g || 0;
      t.carbs_g += e.carbs_g || 0;
      t.fat_g += e.fat_g || 0;
    });
    return t;
  }, [foodEntries]);

  // Group by meal
  const mealGroups = useMemo(() => {
    const groups = { breakfast: [], lunch: [], dinner: [], snack: [] };
    (foodEntries || []).forEach(e => {
      if (groups[e.meal]) groups[e.meal].push(e);
    });
    return groups;
  }, [foodEntries]);

  const mealCalories = (meal) => mealGroups[meal].reduce((s, e) => s + (e.calories || 0), 0);

  const navigateDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const handleOpenAdd = (meal) => {
    setActiveMeal(meal);
    setShowAddFood(true);
  };

  const handleSaveFood = async (foodData) => {
    await addFoodEntry({ ...foodData, date: dateStr, meal: activeMeal });
    setShowAddFood(false);
  };

  const handleDelete = async (id) => {
    await deleteFoodEntry(id);
  };

  const toggleMeal = (meal) => {
    setExpandedMeals(prev => ({ ...prev, [meal]: !prev[meal] }));
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Date Picker */}
      <div className="sticky top-0 z-10 safe-top" style={{
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'rgba(13, 17, 23, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
      <div className="px-6 py-4 flex items-center justify-between w-full">
        <button onClick={() => navigateDay(-1)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-secondary)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="text-center flex-1">
          <div className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          {!isToday && (
            <button onClick={() => setSelectedDate(new Date())} className="text-xs mt-1 font-500" style={{ color: 'var(--accent-primary)' }}>
              Back to today
            </button>
          )}
        </div>
        <button onClick={() => navigateDay(1)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-secondary)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      </div>

      {/* Daily Totals */}
      <div className="px-6 py-4 grid grid-cols-2 gap-4 w-full" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="text-label" style={{ color: 'var(--text-secondary)' }}>Calories</div>
          <div className="flex items-baseline mt-1">
            <span className="text-lg font-700 mono" style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(totals.calories)}</span>
            <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>/ {calorieTarget}</span>
          </div>
        </div>
        <div>
          <div className="text-label" style={{ color: 'var(--text-secondary)' }}>Protein</div>
          <div className="flex items-baseline mt-1">
            <span className="text-lg font-700 mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--macro-protein)' }}>{Math.round(totals.protein_g)}g</span>
            <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>/ {proteinTarget}g</span>
          </div>
        </div>
      </div>

      {/* Meal Sections */}
      <div className="px-6 py-6 space-y-4 w-full">
        {MEALS.map(meal => (
          <div key={meal} className="card overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
            {/* Meal Header */}
            <button
              onClick={() => toggleMeal(meal)}
              className="w-full px-4 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{MEAL_LABELS[meal]}</span>
                <span className="text-xs font-500 mono" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {mealCalories(meal) > 0 ? `${Math.round(mealCalories(meal))} kcal` : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenAdd(meal); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={{ backgroundColor: 'rgba(88, 166, 255, 0.12)', color: 'var(--accent-primary)' }}
                >
                  +
                </button>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ color: 'var(--text-tertiary)', transform: expandedMeals[meal] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </button>

            {/* Food Items */}
            {expandedMeals[meal] && mealGroups[meal].length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {mealGroups[meal].map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setEditingEntry(item)}
                    className="w-full px-4 py-3 flex items-center justify-between transition-all text-left hover:opacity-75"
                    style={{
                      borderBottom: index < mealGroups[meal].length - 1 ? '1px solid rgba(48, 54, 61, 0.3)' : 'none',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-500 truncate" style={{ color: 'var(--text-primary)' }}>{item.food_name}</div>
                      <div className="text-xs flex gap-3 mt-1 flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
                        {item.protein_g > 0 && <span style={{ color: 'var(--macro-protein)' }}>{Math.round(item.protein_g)}g P</span>}
                        {item.carbs_g > 0 && <span style={{ color: 'var(--macro-carbs)' }}>{Math.round(item.carbs_g)}g C</span>}
                        {item.fat_g > 0 && <span style={{ color: 'var(--macro-fat)' }}>{Math.round(item.fat_g)}g F</span>}
                        {item.confidence && item.confidence !== 'high' && (
                          <span style={{ color: item.confidence === 'low' ? 'var(--text-tertiary)' : 'var(--accent-warm)' }}>~est</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <span className="text-sm font-600 mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {Math.round(item.calories)}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-tertiary)' }}>
                        <path d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Empty state */}
        {(!foodEntries || foodEntries.length === 0) && (
          <div className="text-center" style={{ padding: '48px 0' }}>
            <FlameIcon size={48} opacity={0.15} simplified style={{ margin: '0 auto 20px' }} />
            <div className="text-sm font-500" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>No foods logged yet</div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '28px' }}>Light the flame — start tracking your fuel</div>
            <button
              onClick={() => handleOpenAdd('breakfast')}
              style={{
                background: 'linear-gradient(135deg, #F0983E, #E07020)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 48px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 150ms ease',
              }}
            >
              Log Your First Meal
            </button>
          </div>
        )}
      </div>

      {/* Add Food Sheet */}
      {showAddFood && (
        <AddFoodSheet
          mealType={activeMeal}
          date={dateStr}
          onClose={() => setShowAddFood(false)}
          onSave={handleSaveFood}
        />
      )}

      {/* Edit Food Sheet */}
      {editingEntry && (
        <EditFoodSheet
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={() => {
            setEditingEntry(null);
          }}
        />
      )}
    </div>
  );
}
