import React, { useMemo } from 'react';

/**
 * MacroBar - Horizontal segmented progress bar showing protein, carbs, fat
 * Props: protein (g), carbs (g), fat (g), calories (kcal), proteinTarget (g), calorieTarget (kcal)
 */
const MacroBar = ({
  protein = 0,
  carbs = 0,
  fat = 0,
  calories = 0,
  proteinTarget = 200,
  calorieTarget = 2000,
}) => {
  // Calculate percentages
  const totalCalories = calories;
  const proteinPercent = Math.min((protein / proteinTarget) * 100, 100);
  const carbCalories = carbs * 4;
  const fatCalories = fat * 9;
  const proteinCalories = protein * 4;

  // Calculate macro percentages of total calories
  const proteinPercentOfTotal = totalCalories > 0 ? (proteinCalories / totalCalories) * 100 : 0;
  const carbsPercentOfTotal = totalCalories > 0 ? (carbCalories / totalCalories) * 100 : 0;
  const fatPercentOfTotal = totalCalories > 0 ? (fatCalories / totalCalories) * 100 : 0;

  return (
    <div className="w-full space-y-4">
      {/* Macro bar */}
      <div className="w-full">
        <div className="flex h-8 rounded-lg overflow-hidden gap-0.5 bg-black/30 p-1">
          {/* Protein */}
          {proteinPercentOfTotal > 0 && (
            <div
              className="transition-all duration-300 ease-out"
              style={{
                width: `${proteinPercentOfTotal}%`,
                backgroundColor: 'var(--macro-protein)',
              }}
            />
          )}

          {/* Carbs */}
          {carbsPercentOfTotal > 0 && (
            <div
              className="transition-all duration-300 ease-out"
              style={{
                width: `${carbsPercentOfTotal}%`,
                backgroundColor: 'var(--macro-carbs)',
              }}
            />
          )}

          {/* Fat */}
          {fatPercentOfTotal > 0 && (
            <div
              className="transition-all duration-300 ease-out"
              style={{
                width: `${fatPercentOfTotal}%`,
                backgroundColor: 'var(--macro-fat)',
              }}
            />
          )}
        </div>
      </div>

      {/* Macro values below bar */}
      <div className="grid grid-cols-3 gap-4">
        {/* Protein */}
        <div className="text-center">
          <div
            className="text-xs font-medium mb-1"
            style={{ color: 'var(--macro-protein)' }}
          >
            PROTEIN
          </div>
          <div
            className="text-sm font-semibold font-[family-name:var(--font-mono)]"
            style={{ color: 'var(--text-primary)' }}
          >
            {Math.round(protein)}g
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            of {proteinTarget}g
          </div>
        </div>

        {/* Carbs */}
        <div className="text-center">
          <div
            className="text-xs font-medium mb-1"
            style={{ color: 'var(--macro-carbs)' }}
          >
            CARBS
          </div>
          <div
            className="text-sm font-semibold font-[family-name:var(--font-mono)]"
            style={{ color: 'var(--text-primary)' }}
          >
            {Math.round(carbs)}g
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {((carbs * 4) / 2000) * 100}% of cal
          </div>
        </div>

        {/* Fat */}
        <div className="text-center">
          <div
            className="text-xs font-medium mb-1"
            style={{ color: 'var(--macro-fat)' }}
          >
            FAT
          </div>
          <div
            className="text-sm font-semibold font-[family-name:var(--font-mono)]"
            style={{ color: 'var(--text-primary)' }}
          >
            {Math.round(fat)}g
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {((fat * 9) / 2000) * 100}% of cal
          </div>
        </div>
      </div>
    </div>
  );
};

export default MacroBar;
