-- FUEL Tracker Database Schema
-- Initial migration with all core tables

-- User Settings and Preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- User profile
  user_id TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,

  -- Anthropometric data
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  height_cm REAL,
  current_weight_kg REAL,
  target_weight_kg REAL,

  -- Activity and goals
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')),
  goal TEXT CHECK (goal IN ('lose_weight', 'maintain', 'gain_muscle', 'general_fitness')),

  -- Calorie targets (calculated)
  tdee_calories INTEGER,
  target_calories INTEGER,

  -- Macronutrient targets (grams per day)
  target_protein_g REAL DEFAULT 2.0,
  target_carbs_g REAL DEFAULT 4.0,
  target_fat_g REAL DEFAULT 1.0,

  -- Preferences
  unit_system TEXT CHECK (unit_system IN ('metric', 'imperial')) DEFAULT 'metric',
  use_ai_recommendations BOOLEAN DEFAULT TRUE,
  track_water BOOLEAN DEFAULT TRUE,
  track_exercise BOOLEAN DEFAULT FALSE,

  -- Notification preferences
  daily_reminder_time TEXT,
  enable_notifications BOOLEAN DEFAULT TRUE
);

-- Weight tracking history
CREATE TABLE IF NOT EXISTS weight_entries (
  id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  user_id TEXT NOT NULL,
  entry_date DATE NOT NULL,
  weight_kg REAL NOT NULL,
  notes TEXT,

  FOREIGN KEY (user_id) REFERENCES user_settings(user_id),
  UNIQUE (user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON weight_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON weight_entries(entry_date);

-- Food log entries
CREATE TABLE IF NOT EXISTS food_log (
  id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  user_id TEXT NOT NULL,
  log_date DATE NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')),

  food_id TEXT NOT NULL,
  food_name TEXT NOT NULL,
  serving_size REAL NOT NULL,
  serving_unit TEXT NOT NULL,

  -- Nutritional data (per serving logged)
  calories REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  fiber_g REAL DEFAULT 0,
  sugar_g REAL DEFAULT 0,
  sodium_mg REAL DEFAULT 0,

  -- Source tracking
  source TEXT CHECK (source IN ('usda', 'fatsecret', 'custom', 'imported_recipe')),
  notes TEXT,

  FOREIGN KEY (user_id) REFERENCES user_settings(user_id)
);

CREATE INDEX IF NOT EXISTS idx_food_log_user_id ON food_log(user_id);
CREATE INDEX IF NOT EXISTS idx_food_log_date ON food_log(log_date);
CREATE INDEX IF NOT EXISTS idx_food_log_user_date ON food_log(user_id, log_date);

-- Custom food database
CREATE TABLE IF NOT EXISTS custom_foods (
  id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  user_id TEXT NOT NULL,
  food_id TEXT UNIQUE NOT NULL,
  food_name TEXT NOT NULL,
  brand TEXT,
  category TEXT,

  -- Nutritional info per serving
  serving_size REAL NOT NULL,
  serving_unit TEXT NOT NULL,
  calories REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  fiber_g REAL DEFAULT 0,
  sugar_g REAL DEFAULT 0,
  sodium_mg REAL DEFAULT 0,

  -- Additional fields
  notes TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,

  FOREIGN KEY (user_id) REFERENCES user_settings(user_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_foods_user_id ON custom_foods(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_foods_name ON custom_foods(food_name);

-- Imported recipes database
CREATE TABLE IF NOT EXISTS imported_recipes (
  id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  user_id TEXT NOT NULL,
  recipe_id TEXT UNIQUE NOT NULL,
  recipe_name TEXT NOT NULL,

  -- Recipe composition
  ingredients TEXT NOT NULL,
  instructions TEXT,
  yield_servings INTEGER NOT NULL,

  -- Nutritional totals (entire recipe)
  total_calories REAL NOT NULL,
  total_protein_g REAL NOT NULL,
  total_carbs_g REAL NOT NULL,
  total_fat_g REAL NOT NULL,
  total_fiber_g REAL DEFAULT 0,

  -- Per serving (calculated)
  calories_per_serving REAL NOT NULL,
  protein_per_serving_g REAL NOT NULL,
  carbs_per_serving_g REAL NOT NULL,
  fat_per_serving_g REAL NOT NULL,

  -- Metadata
  source TEXT,
  source_url TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  notes TEXT,

  FOREIGN KEY (user_id) REFERENCES user_settings(user_id)
);

CREATE INDEX IF NOT EXISTS idx_imported_recipes_user_id ON imported_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_imported_recipes_name ON imported_recipes(recipe_name);

-- Weekly summaries (for efficient analytics)
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  user_id TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,

  -- Totals and averages
  total_calories INTEGER DEFAULT 0,
  avg_daily_calories INTEGER DEFAULT 0,

  total_protein_g REAL DEFAULT 0,
  avg_daily_protein_g REAL DEFAULT 0,

  total_carbs_g REAL DEFAULT 0,
  avg_daily_carbs_g REAL DEFAULT 0,

  total_fat_g REAL DEFAULT 0,
  avg_daily_fat_g REAL DEFAULT 0,

  -- Weight changes
  starting_weight_kg REAL,
  ending_weight_kg REAL,
  weight_change_kg REAL,

  -- Adherence tracking
  days_logged INTEGER DEFAULT 0,
  calories_vs_target_percent REAL,

  -- Insights
  notes TEXT,

  FOREIGN KEY (user_id) REFERENCES user_settings(user_id),
  UNIQUE (user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_id ON weekly_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_date_range ON weekly_summaries(week_start_date, week_end_date);

-- Training days log
CREATE TABLE IF NOT EXISTS training_days (
  id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  user_id TEXT NOT NULL,
  training_date DATE NOT NULL,

  -- Training details
  activity_type TEXT NOT NULL,
  duration_minutes INTEGER,
  intensity TEXT CHECK (intensity IN ('light', 'moderate', 'high')),

  -- Energy expenditure
  estimated_calories_burned INTEGER,

  -- Performance tracking
  notes TEXT,
  exercise_details TEXT,

  FOREIGN KEY (user_id) REFERENCES user_settings(user_id)
);

CREATE INDEX IF NOT EXISTS idx_training_days_user_id ON training_days(user_id);
CREATE INDEX IF NOT EXISTS idx_training_days_date ON training_days(training_date);

-- Algorithm state and recommendations cache
CREATE TABLE IF NOT EXISTS algorithm_state (
  id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  user_id TEXT UNIQUE NOT NULL,

  -- Last analysis
  last_analysis_date DATE,
  last_recommendation_date DATE,

  -- Calculated metrics (cached for performance)
  metabolic_adaptation_factor REAL DEFAULT 1.0,
  recent_compliance_rate REAL DEFAULT 0.5,
  weight_trend_g_per_day REAL DEFAULT 0,

  -- State data (JSON for flexibility)
  macro_recommendations TEXT,
  adjustment_recommendations TEXT,

  -- Flags
  needs_recalibration BOOLEAN DEFAULT FALSE,
  last_recalibration_date DATE,

  FOREIGN KEY (user_id) REFERENCES user_settings(user_id)
);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS user_settings_updated_at
AFTER UPDATE ON user_settings
BEGIN
  UPDATE user_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS weight_entries_updated_at
AFTER UPDATE ON weight_entries
BEGIN
  UPDATE weight_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS food_log_updated_at
AFTER UPDATE ON food_log
BEGIN
  UPDATE food_log SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS custom_foods_updated_at
AFTER UPDATE ON custom_foods
BEGIN
  UPDATE custom_foods SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS imported_recipes_updated_at
AFTER UPDATE ON imported_recipes
BEGIN
  UPDATE imported_recipes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS weekly_summaries_updated_at
AFTER UPDATE ON weekly_summaries
BEGIN
  UPDATE weekly_summaries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS training_days_updated_at
AFTER UPDATE ON training_days
BEGIN
  UPDATE training_days SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS algorithm_state_updated_at
AFTER UPDATE ON algorithm_state
BEGIN
  UPDATE algorithm_state SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
