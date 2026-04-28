-- ──────────────────────────────────────────────────────────────────────────────
-- FUEL — Phase 2 initial migration
-- Run this in the Supabase SQL editor for project `nuixrqyzzwkpdwzzkjsg`
-- (the same project that hosts meal_planner_data).
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

-- Shared user_id for David's solo apps.
-- Both david@providenceswfl.com and rogersdna15@gmail.com authenticate to
-- Supabase but write/read the same row keyed on this UUID. RLS policies
-- below restrict access to (a) the shared user_id AND (b) one of David's
-- two emails — defense in depth in case the anon key ever leaks AND a
-- third party signs in to the project.
DO $$ BEGIN
  PERFORM '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- fuel_food_log — every food entry
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_food_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  meal_slot TEXT NOT NULL,
  food_name TEXT NOT NULL,
  serving_qty REAL NOT NULL,
  serving_unit TEXT NOT NULL,
  kcal REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  fiber_g REAL NOT NULL DEFAULT 0,
  sodium_mg REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  source_id TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fuel_food_log_user_date ON public.fuel_food_log(user_id, date);

-- ────────────────────────────────────────────────────────────────────
-- fuel_weight_log — daily weight, one row per date
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_weight_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  weight_lbs REAL NOT NULL,
  trended_lbs REAL,
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- ────────────────────────────────────────────────────────────────────
-- fuel_saved_meals — user-built recipe templates
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_saved_meals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  servings REAL NOT NULL DEFAULT 1,
  ingredients JSONB NOT NULL,
  total_kcal REAL NOT NULL,
  total_protein_g REAL NOT NULL,
  total_carbs_g REAL NOT NULL,
  total_fat_g REAL NOT NULL,
  total_fiber_g REAL NOT NULL DEFAULT 0,
  total_sodium_mg REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_fuel_saved_meals_user ON public.fuel_saved_meals(user_id);

-- ────────────────────────────────────────────────────────────────────
-- fuel_food_cache — USDA + AI-estimate lookup cache
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_food_cache (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT,
  food_name TEXT NOT NULL,
  brand TEXT,
  data_type TEXT,
  serving_options JSONB,
  per_100g JSONB NOT NULL,
  raw_response JSONB,
  last_fetched TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_fuel_food_cache_name
  ON public.fuel_food_cache USING GIN (to_tsvector('english', food_name));

-- ────────────────────────────────────────────────────────────────────
-- fuel_settings — singleton row per user
-- profile JSONB        : {weight_lbs, height_in, age, sex, activity_level, goal, target_rate_pct, training_days_per_week}
-- targets JSONB        : {protein_g_per_lb, fat_g_per_lb, training_kcal, rest_kcal, calorie_floor, training_carb_floor_g, weekly_cal_budget}
-- algo_state JSONB     : {tdee_estimate, tdee_confidence, last_review_date, phase, phase_start_date, ewma_alpha}
-- preferences JSONB    : {meal_slots, training_day_overrides, theme, units, intraday_rebalance}
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_settings (
  user_id UUID PRIMARY KEY,
  profile JSONB NOT NULL,
  targets JSONB NOT NULL,
  algo_state JSONB NOT NULL,
  preferences JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────
-- fuel_weekly_reviews — audit trail of algorithm adjustments
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_weekly_reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  review_date DATE NOT NULL,
  trended_weight_change_lbs REAL,
  avg_daily_kcal REAL,
  estimated_tdee REAL,
  prior_tdee REAL,
  prior_training_kcal REAL,
  prior_rest_kcal REAL,
  new_training_kcal REAL,
  new_rest_kcal REAL,
  reasoning TEXT,
  ai_coaching_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fuel_weekly_reviews_user_date
  ON public.fuel_weekly_reviews(user_id, review_date);

-- ──────────────────────────────────────────────────────────────────────────────
-- Row-level security
-- All FUEL tables are restricted to (a) David's shared user_id AND (b) one of
-- the two allowed Google emails. Even if the anon key leaks, a stranger who
-- somehow authenticates can't read FUEL rows because their email won't match.
-- fuel_food_cache is shared lookup data — any authenticated user reads,
-- writes go through the Cloudflare Worker (service_role bypasses RLS).
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fuel_food_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_weight_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_saved_meals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_food_cache     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fuel_food_log_owner_all       ON public.fuel_food_log;
DROP POLICY IF EXISTS fuel_weight_log_owner_all     ON public.fuel_weight_log;
DROP POLICY IF EXISTS fuel_saved_meals_owner_all    ON public.fuel_saved_meals;
DROP POLICY IF EXISTS fuel_settings_owner_all       ON public.fuel_settings;
DROP POLICY IF EXISTS fuel_weekly_reviews_owner_all ON public.fuel_weekly_reviews;
DROP POLICY IF EXISTS fuel_food_cache_read_authenticated ON public.fuel_food_cache;

CREATE POLICY fuel_food_log_owner_all ON public.fuel_food_log
  FOR ALL TO authenticated
  USING (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  )
  WITH CHECK (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  );

CREATE POLICY fuel_weight_log_owner_all ON public.fuel_weight_log
  FOR ALL TO authenticated
  USING (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  )
  WITH CHECK (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  );

CREATE POLICY fuel_saved_meals_owner_all ON public.fuel_saved_meals
  FOR ALL TO authenticated
  USING (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  )
  WITH CHECK (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  );

CREATE POLICY fuel_settings_owner_all ON public.fuel_settings
  FOR ALL TO authenticated
  USING (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  )
  WITH CHECK (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  );

CREATE POLICY fuel_weekly_reviews_owner_all ON public.fuel_weekly_reviews
  FOR ALL TO authenticated
  USING (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  )
  WITH CHECK (
    user_id = '0fc6ea4c-79fe-4f51-a74c-702af6e232e6'::uuid
    AND (auth.jwt() ->> 'email') IN ('rogersdna15@gmail.com', 'david@providenceswfl.com')
  );

CREATE POLICY fuel_food_cache_read_authenticated ON public.fuel_food_cache
  FOR SELECT TO authenticated
  USING (true);

-- Allow authenticated role to USE the BIGSERIAL sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
