import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

const RecipeImport = ({ onClose }) => {
  const [jsonInput, setJsonInput] = useState('')
  const [parseError, setParseError] = useState(null)
  const [parsedMeals, setParsedMeals] = useState(null)
  const [isImporting, setIsImporting] = useState(false)

  const importedRecipes = useLiveQuery(() => db.importedRecipes.toArray())

  const handleParseJSON = () => {
    setParseError(null)
    setParsedMeals(null)

    if (!jsonInput.trim()) {
      setParseError('Please paste JSON first')
      return
    }

    try {
      const data = JSON.parse(jsonInput)

      // Expect an array of meals or a meals key
      let meals = Array.isArray(data) ? data : data.meals || []

      if (!Array.isArray(meals)) {
        setParseError('Invalid format. Expected array of meals.')
        return
      }

      if (meals.length === 0) {
        setParseError('No meals found in JSON')
        return
      }

      // Validate meal structure
      meals = meals.map((meal) => ({
        meal_name: meal.name || meal.meal_name || 'Unnamed Meal',
        ingredients: meal.ingredients || [],
        total_calories: meal.calories || meal.total_calories || 0,
        total_protein: meal.protein || meal.total_protein || 0,
        total_carbs: meal.carbs || meal.total_carbs || 0,
        total_fat: meal.fat || meal.total_fat || 0,
        estimated_total_cooked_g: meal.cooked_grams || meal.estimated_total_cooked_g || 100,
      }))

      setParsedMeals(meals)
    } catch (err) {
      setParseError('Invalid JSON: ' + err.message)
    }
  }

  const handleImportAll = async () => {
    if (!parsedMeals || parsedMeals.length === 0) return

    setIsImporting(true)

    try {
      const now = new Date().toISOString()

      await db.importedRecipes.bulkAdd(
        parsedMeals.map((meal) => ({
          ...meal,
          imported_at: now,
          last_used: null,
        }))
      )

      setJsonInput('')
      setParsedMeals(null)
      alert(`Successfully imported ${parsedMeals.length} recipes`)
      onClose()
    } catch (error) {
      setParseError('Error importing recipes: ' + error.message)
    } finally {
      setIsImporting(false)
    }
  }

  if (parsedMeals && parsedMeals.length > 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Review Recipes</h2>

        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Found {parsedMeals.length} recipes. Click below to confirm import.
        </div>

        <div className="max-h-48 overflow-y-auto space-y-2">
          {parsedMeals.map((meal, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="font-semibold text-sm">{meal.meal_name}</div>
              <div className="text-xs mt-2 flex gap-3" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {Math.round(meal.total_calories)} cal
                </span>
                <span>{Math.round(meal.total_protein)}g protein</span>
              </div>
              {meal.ingredients && meal.ingredients.length > 0 && (
                <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                  {meal.ingredients.length} ingredients
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleImportAll}
            disabled={isImporting}
            className="flex-1 px-4 py-3 rounded font-medium transition disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--bg-primary)',
            }}
          >
            {isImporting ? 'Importing...' : 'Import All'}
          </button>
          <button
            onClick={() => {
              setParsedMeals(null)
              setJsonInput('')
            }}
            className="flex-1 px-4 py-3 rounded border font-medium transition"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Import Recipes</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Paste JSON from your meal planner export
        </p>
      </div>

      <textarea
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder={'[\n  {\n    "name": "Grilled Chicken",\n    "calories": 350,\n    "protein": 50,\n    "ingredients": ["chicken breast", "olive oil"]\n  }\n]'}
        className="w-full px-3 py-2 rounded border text-sm resize-none focus:outline-none focus:ring-2 font-mono text-xs"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
          minHeight: '200px',
        }}
      />

      {parseError && (
        <div
          className="p-3 rounded text-sm"
          style={{
            backgroundColor: '#3d2422',
            color: '#f85149',
          }}
        >
          {parseError}
        </div>
      )}

      <button
        onClick={handleParseJSON}
        className="w-full px-4 py-3 rounded font-medium transition"
        style={{
          backgroundColor: 'var(--accent-primary)',
          color: 'var(--bg-primary)',
        }}
      >
        Parse JSON
      </button>

      <button
        onClick={onClose}
        className="w-full px-4 py-3 rounded border font-medium transition"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--text-secondary)',
        }}
      >
        Close
      </button>

      {/* Current Recipes List */}
      {importedRecipes && importedRecipes.length > 0 && (
        <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-semibold text-sm mb-3">Currently Imported ({importedRecipes.length})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {importedRecipes.slice(0, 10).map((recipe) => (
              <div
                key={recipe.id}
                className="text-xs p-2 rounded"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                <div className="font-semibold">{recipe.meal_name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(recipe.total_calories || 0)} cal per serving
                </div>
              </div>
            ))}
            {importedRecipes.length > 10 && (
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                +{importedRecipes.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default RecipeImport
