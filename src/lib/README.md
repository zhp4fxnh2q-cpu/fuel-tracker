# FUEL Core Library Modules

Production-ready JavaScript ES6 modules implementing the calorie tracking engine.

## Files

### 1. constants.js (107 lines)
Default configuration and application constants.

**Exports:**
- `DEFAULT_PROFILE` - User profile with body metrics and targets
- `MEALS` - Array of meal categories
- `PHASE` - Training phase constants
- `CONFIDENCE` - Confidence level enum
- Numeric constants: `MIN_CALORIES`, `KCAL_PER_LB`, `EWMA_ALPHA`, `MIN_DAYS_FOR_TDEE`, `COLD_START_DAYS`, `TRAINING_DAY_BONUS`, `DIET_BREAK_WEEKS`, `ADJUSTMENT_STEP`
- `TABS` - Navigation tab configuration

### 2. conversions.js (147 lines)
Unit conversion utilities and cooking yield factors.

**Key Exports:**
- `COOKING_YIELD_FACTORS` - Raw-to-cooked weight ratios for 22+ common foods
- `VOLUME_TO_GRAMS` - Volume-to-weight conversions
- `getCookingYieldFactor(ingredientName)` - Smart ingredient matching
- Weight conversions: `lbsToKg()`, `kgToLbs()`, `inchesToCm()`, `cmToInches()`

### 3. algorithm.js (536 lines)
Core TDEE algorithm - pure JavaScript with zero UI dependencies.

**Main Functions:**
- `updateSmoothedWeight()` - EWMA weight smoothing
- `calculateFormulaTDEE()` - Mifflin-St Jeor formula
- `calculateAdaptiveTDEE()` - Data-driven TDEE from weight/food history
- `getBlendedTDEE()` - Cold start blending (30-day ramp)
- `generateTargets()` - Training/rest day calorie targets
- `applyGuardrails()` - Safety constraints
- `weeklyCheck()` - Analyze trend and recommend adjustments
- `checkDietBreakNeeded()` - Monitor cut phase duration
- `computeWeeklySummary()` - Aggregate weekly stats

**Helper Functions:**
- `getSmoothedWeightAt()` - Interpolate smoothed weight
- `sumCalories()`, `countLoggedDays()`, `daysBetween()`

### 4. db.js (505 lines)
Dexie offline-first database with all async helper functions.

**Database Tables:**
- `weightEntries` - Daily weight measurements with EWMA smoothing
- `foodLog` - Individual food entries with macros
- `userSettings` - Key-value store
- `trainingDays` - Training schedule overrides
- `algorithmState` - Current TDEE and phase info
- `weeklySummaries` - Aggregated weekly stats
- `importedRecipes` - Imported recipes from MyFitnessPal, etc.
- `customFoods` - User-created food database

**Async Functions:**
- **Settings:** `getSetting()`, `setSetting()`
- **Weight:** `getWeightEntries()`, `addWeightEntry()` (auto-smoothing)
- **Food:** `getFoodLog()`, `getFoodLogRange()`, `addFoodEntry()`, `updateFoodEntry()`, `deleteFoodEntry()`, `getDailyTotals()`
- **Training:** `getTrainingDay()`, `setTrainingDay()`, `isTrainingDay()`
- **Algorithm:** `getAlgorithmState()`, `updateAlgorithmState()`
- **Summaries:** `getWeeklySummary()`, `saveWeeklySummary()`
- **Recipes:** `getImportedRecipes()`, `saveImportedRecipe()`
- **Foods:** `getCustomFoods()`, `saveCustomFood()`, `getRecentFoods()`, `getFavoriteFoods()`
- **Utility:** `generateId()` - crypto.randomUUID()

## Features

### Algorithm Precision
- Exponential Weighted Moving Average (EWMA) for weight smoothing
- Back-calculated TDEE from actual weight changes and food intake
- Formula-to-data blend during 30-day cold start period
- Requires minimum 14 days of data for adaptive estimates

### Safety Guardrails
- Minimum 1700 cal/day intake floor
- Maximum 20% weekly calorie change limits
- Sustained diet break recommendations after 8 weeks

### Production Ready
- Complete JSDoc documentation
- All functions tested for syntax
- Zero external dependencies (algorithm.js, conversions.js, constants.js)
- Dexie dependency only in db.js (npm install dexie)

## Usage Example

```javascript
import {
  DEFAULT_PROFILE,
  EWMA_ALPHA,
  calculateFormulaTDEE,
  getBlendedTDEE,
  generateTargets
} from './lib/constants.js';
import { lbsToKg, inchesToCm } from './lib/conversions.js';
import { db, addWeightEntry, addFoodEntry } from './lib/db.js';

// Calculate initial TDEE
const weightKg = lbsToKg(DEFAULT_PROFILE.startingWeight);
const heightCm = inchesToCm(DEFAULT_PROFILE.heightInches);
const tdee = calculateFormulaTDEE(weightKg, heightCm, 35);

// Log a weight entry
await addWeightEntry({
  date: '2026-04-13',
  weight_lbs: 218,
  notes: 'Morning weight'
});

// Log a food entry
await addFoodEntry({
  date: '2026-04-13',
  meal: 'breakfast',
  food_name: 'Chicken Breast',
  calories: 165,
  protein_g: 31,
  carbs_g: 0,
  fat_g: 3.6
});
```

## File Sizes
- constants.js: 2.3 KB
- conversions.js: 3.6 KB
- algorithm.js: 18 KB
- db.js: 14 KB
- **Total: 38 KB**
