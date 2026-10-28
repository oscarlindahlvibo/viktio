/*
# Viktio — Core Schema (MVP)

This migration creates the foundational tables for the Viktio health/weight-loss app.

## Overview
- Profiles, goals, weight entries, measurements (per-user private data)
- Food database: foods, categories, servings, nutrition, sources, external products (shared/global)
- Recipes: recipes, recipe sources, recipe ingredients, ingredient mappings, user recipes
- Saved meals + items (per-user)
- Food log + activity log (per-user)
- Workouts, exercises, workout sessions (per-user)
- Meal plans + items (per-user)
- Shopping lists + items (per-user)
- Point engine versioning: engine versions, rules, zero-point rules
- Provider cache for external retailer products
- App settings (global, configurable)

## Security
- RLS enabled on EVERY table.
- Per-user tables use `user_id` defaulting to `auth.uid()`, scoped `TO authenticated` with ownership predicates.
- Shared/global tables (foods, recipes, categories, engine config) are readable by anon+authenticated; writes restricted to service role (admin) via no INSERT/UPDATE/DELETE policy for anon.
- Every per-user INSERT policy works even when the client omits user_id (DEFAULT auth.uid()).

## Notes
- All nutrition values normalized per 100g/100ml.
- Points are stored with engine version + nutrition snapshot for historical correctness.
- Swedish-friendly defaults.
*/

-- ============================================================
-- PROFILES & GOALS
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  sex text CHECK (sex IN ('male','female','other')),
  date_of_birth date,
  height_cm numeric,
  current_weight_kg numeric,
  target_weight_kg numeric,
  activity_level text CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  weight_loss_pace text CHECK (weight_loss_pace IN ('slow','moderate','fast')),
  waist_cm numeric,
  dietary_preferences text[] DEFAULT '{}',
  allergies text[] DEFAULT '{}',
  disliked_foods text[] DEFAULT '{}',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  bmi numeric,
  bmr numeric,
  tdee numeric,
  calorie_target numeric,
  daily_points_budget numeric NOT NULL DEFAULT 30,
  weekly_points_pool numeric NOT NULL DEFAULT 0,
  protein_target_g numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_goals" ON user_goals;
CREATE POLICY "select_own_goals" ON user_goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_goals" ON user_goals;
CREATE POLICY "insert_own_goals" ON user_goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_goals" ON user_goals;
CREATE POLICY "update_own_goals" ON user_goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_goals" ON user_goals;
CREATE POLICY "delete_own_goals" ON user_goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- WEIGHT ENTRIES & MEASUREMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric NOT NULL,
  waist_cm numeric,
  body_fat_pct numeric,
  note text,
  photo_url text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_weights" ON weight_entries;
CREATE POLICY "select_own_weights" ON weight_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_weights" ON weight_entries;
CREATE POLICY "insert_own_weights" ON weight_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_weights" ON weight_entries;
CREATE POLICY "update_own_weights" ON weight_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_weights" ON weight_entries;
CREATE POLICY "delete_own_weights" ON weight_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_weight_entries_user_logged ON weight_entries(user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  waist_cm numeric,
  hip_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  body_fat_pct numeric,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_measurements" ON measurements;
CREATE POLICY "select_own_measurements" ON measurements FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_measurements" ON measurements;
CREATE POLICY "insert_own_measurements" ON measurements FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_measurements" ON measurements;
CREATE POLICY "update_own_measurements" ON measurements FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_measurements" ON measurements;
CREATE POLICY "delete_own_measurements" ON measurements FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- FOOD DATABASE (SHARED/GLOBAL)
-- ============================================================

CREATE TABLE IF NOT EXISTS food_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  zero_point boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_food_categories" ON food_categories;
CREATE POLICY "read_food_categories" ON food_categories FOR SELECT
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS food_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_food_sources" ON food_sources;
CREATE POLICY "read_food_sources" ON food_sources FOR SELECT
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  category_id uuid REFERENCES food_categories(id),
  source_id uuid REFERENCES food_sources(id),
  barcode text,
  package_size text,
  serving_size_g numeric,
  serving_description text,
  image_url text,
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified','imported','user_created','estimated','needs_review')),
  zero_point boolean NOT NULL DEFAULT false,
  manual_points numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_foods" ON foods;
CREATE POLICY "read_foods" ON foods FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_foods_user" ON foods;
CREATE POLICY "insert_foods_user" ON foods FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_foods_owner" ON foods;
CREATE POLICY "update_foods_owner" ON foods FOR UPDATE
  TO authenticated USING (created_by = auth.uid() OR created_by IS NULL) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_foods_name ON foods USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);

CREATE TABLE IF NOT EXISTS food_nutrition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  kcal numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbohydrate_g numeric NOT NULL DEFAULT 0,
  sugar_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  saturated_fat_g numeric NOT NULL DEFAULT 0,
  fiber_g numeric NOT NULL DEFAULT 0,
  sodium_mg numeric NOT NULL DEFAULT 0,
  salt_g numeric NOT NULL DEFAULT 0,
  per_amount numeric NOT NULL DEFAULT 100,
  unit text NOT NULL DEFAULT 'g',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_nutrition ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_food_nutrition" ON food_nutrition;
CREATE POLICY "read_food_nutrition" ON food_nutrition FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_food_nutrition" ON food_nutrition;
CREATE POLICY "insert_food_nutrition" ON food_nutrition FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_food_nutrition" ON food_nutrition;
CREATE POLICY "update_food_nutrition" ON food_nutrition FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS food_servings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount_g numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_servings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_food_servings" ON food_servings;
CREATE POLICY "read_food_servings" ON food_servings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_food_servings" ON food_servings;
CREATE POLICY "insert_food_servings" ON food_servings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS external_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_id text NOT NULL,
  canonical_url text,
  barcode text,
  retailer text,
  price numeric,
  comparison_price numeric,
  comparison_unit text,
  image_url text,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

ALTER TABLE external_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_external_products" ON external_products;
CREATE POLICY "read_external_products" ON external_products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_external_products" ON external_products;
CREATE POLICY "insert_external_products" ON external_products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_external_products" ON external_products;
CREATE POLICY "update_external_products" ON external_products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_external_products_barcode ON external_products(barcode);

-- ============================================================
-- RECIPES (SHARED + USER)
-- ============================================================

CREATE TABLE IF NOT EXISTS recipe_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recipe_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_recipe_sources" ON recipe_sources;
CREATE POLICY "read_recipe_sources" ON recipe_sources FOR SELECT
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  prep_time_min integer,
  cook_time_min integer,
  servings integer NOT NULL DEFAULT 4,
  total_points numeric NOT NULL DEFAULT 0,
  kcal_per_serving numeric NOT NULL DEFAULT 0,
  protein_per_serving numeric NOT NULL DEFAULT 0,
  carbs_per_serving numeric NOT NULL DEFAULT 0,
  fat_per_serving numeric NOT NULL DEFAULT 0,
  fiber_per_serving numeric NOT NULL DEFAULT 0,
  source_id uuid REFERENCES recipe_sources(id),
  source_url text,
  source_name text,
  author text,
  instructions text,
  tags text[] DEFAULT '{}',
  meal_type text CHECK (meal_type IN ('breakfast','lunch','dinner','snack','any')),
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified','imported','user_created','estimated','needs_review')),
  created_by uuid,
  engine_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_recipes" ON recipes;
CREATE POLICY "read_recipes" ON recipes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_recipes" ON recipes;
CREATE POLICY "insert_recipes" ON recipes FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_recipes" ON recipes;
CREATE POLICY "update_recipes" ON recipes FOR UPDATE
  TO authenticated USING (created_by = auth.uid() OR created_by IS NULL) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_recipes_owner" ON recipes;
CREATE POLICY "delete_recipes_owner" ON recipes FOR DELETE
  TO authenticated USING (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes USING gin (to_tsvector('simple', name));

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id),
  raw_text text,
  amount numeric,
  unit text,
  weight_g numeric,
  kcal numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbohydrate_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  fiber_g numeric NOT NULL DEFAULT 0,
  points numeric NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'high' CHECK (confidence IN ('high','medium','low','unmatched')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "read_recipe_ingredients" ON recipe_ingredients FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "insert_recipe_ingredients" ON recipe_ingredients FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "update_recipe_ingredients" ON recipe_ingredients FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "delete_recipe_ingredients" ON recipe_ingredients FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

CREATE TABLE IF NOT EXISTS ingredient_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  food_id uuid NOT NULL REFERENCES foods(id),
  amount numeric,
  unit text,
  weight_g numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_text, food_id)
);

ALTER TABLE ingredient_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_ingredient_mappings" ON ingredient_mappings;
CREATE POLICY "read_ingredient_mappings" ON ingredient_mappings FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "insert_ingredient_mappings" ON ingredient_mappings;
CREATE POLICY "insert_ingredient_mappings" ON ingredient_mappings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "update_ingredient_mappings" ON ingredient_mappings;
CREATE POLICY "update_ingredient_mappings" ON ingredient_mappings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recipe_id)
);

ALTER TABLE user_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_user_recipes" ON user_recipes;
CREATE POLICY "select_own_user_recipes" ON user_recipes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_user_recipes" ON user_recipes;
CREATE POLICY "insert_own_user_recipes" ON user_recipes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_user_recipes" ON user_recipes;
CREATE POLICY "delete_own_user_recipes" ON user_recipes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- SAVED MEALS
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  meal_type text CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  total_points numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_saved_meals" ON saved_meals;
CREATE POLICY "select_own_saved_meals" ON saved_meals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved_meals" ON saved_meals;
CREATE POLICY "insert_own_saved_meals" ON saved_meals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_saved_meals" ON saved_meals;
CREATE POLICY "update_own_saved_meals" ON saved_meals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved_meals" ON saved_meals;
CREATE POLICY "delete_own_saved_meals" ON saved_meals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS saved_meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_meal_id uuid NOT NULL REFERENCES saved_meals(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id),
  recipe_id uuid REFERENCES recipes(id),
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'serving',
  weight_g numeric,
  points numeric NOT NULL DEFAULT 0,
  kcal numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_meal_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_saved_meal_items" ON saved_meal_items;
CREATE POLICY "select_own_saved_meal_items" ON saved_meal_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM saved_meals WHERE saved_meals.id = saved_meal_items.saved_meal_id AND saved_meals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_saved_meal_items" ON saved_meal_items;
CREATE POLICY "insert_own_saved_meal_items" ON saved_meal_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM saved_meals WHERE saved_meals.id = saved_meal_items.saved_meal_id AND saved_meals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_saved_meal_items" ON saved_meal_items;
CREATE POLICY "update_own_saved_meal_items" ON saved_meal_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM saved_meals WHERE saved_meals.id = saved_meal_items.saved_meal_id AND saved_meals.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM saved_meals WHERE saved_meals.id = saved_meal_items.saved_meal_id AND saved_meals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_saved_meal_items" ON saved_meal_items;
CREATE POLICY "delete_own_saved_meal_items" ON saved_meal_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM saved_meals WHERE saved_meals.id = saved_meal_items.saved_meal_id AND saved_meals.user_id = auth.uid())
  );

-- ============================================================
-- FOOD LOG & ACTIVITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS food_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id),
  recipe_id uuid REFERENCES recipes(id),
  saved_meal_id uuid REFERENCES saved_meals(id),
  name text NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'serving',
  weight_g numeric,
  kcal numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbohydrate_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  fiber_g numeric NOT NULL DEFAULT 0,
  points numeric NOT NULL DEFAULT 0,
  engine_version_id uuid,
  nutrition_snapshot jsonb,
  logged_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_food_log" ON food_log;
CREATE POLICY "select_own_food_log" ON food_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_food_log" ON food_log;
CREATE POLICY "insert_own_food_log" ON food_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_food_log" ON food_log;
CREATE POLICY "update_own_food_log" ON food_log FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_food_log" ON food_log;
CREATE POLICY "delete_own_food_log" ON food_log FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_food_log_user_date ON food_log(user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  activity text NOT NULL,
  duration_min integer NOT NULL,
  distance_km numeric,
  intensity text CHECK (intensity IN ('low','moderate','high')),
  estimated_kcal numeric NOT NULL DEFAULT 0,
  bonus_points numeric NOT NULL DEFAULT 0,
  source text,
  logged_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_activity_log" ON activity_log;
CREATE POLICY "select_own_activity_log" ON activity_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_activity_log" ON activity_log;
CREATE POLICY "insert_own_activity_log" ON activity_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_activity_log" ON activity_log;
CREATE POLICY "update_own_activity_log" ON activity_log FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_activity_log" ON activity_log;
CREATE POLICY "delete_own_activity_log" ON activity_log FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_date ON activity_log(user_id, logged_at DESC);

-- ============================================================
-- WORKOUTS & EXERCISES
-- ============================================================

CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  muscle_group text,
  equipment text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_exercises" ON exercises;
CREATE POLICY "read_exercises" ON exercises FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_exercises" ON exercises;
CREATE POLICY "insert_exercises" ON exercises FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text CHECK (goal IN ('lose_weight','get_stronger','improve_fitness','build_muscle','general_health')),
  location text CHECK (location IN ('home','gym','outdoors')),
  frequency int CHECK (frequency BETWEEN 1 AND 7),
  experience text CHECK (experience IN ('beginner','intermediate','advanced')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_workouts" ON workouts;
CREATE POLICY "select_own_workouts" ON workouts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_workouts" ON workouts;
CREATE POLICY "insert_own_workouts" ON workouts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_workouts" ON workouts;
CREATE POLICY "update_own_workouts" ON workouts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_workouts" ON workouts;
CREATE POLICY "delete_own_workouts" ON workouts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid REFERENCES workouts(id) ON DELETE SET NULL,
  exercise_id uuid REFERENCES exercises(id),
  exercise_name text NOT NULL,
  sets integer,
  reps integer,
  weight_kg numeric,
  rest_sec integer,
  duration_min integer,
  notes text,
  logged_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_workout_sessions" ON workout_sessions;
CREATE POLICY "select_own_workout_sessions" ON workout_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_workout_sessions" ON workout_sessions;
CREATE POLICY "insert_own_workout_sessions" ON workout_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_workout_sessions" ON workout_sessions;
CREATE POLICY "update_own_workout_sessions" ON workout_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_workout_sessions" ON workout_sessions;
CREATE POLICY "delete_own_workout_sessions" ON workout_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON workout_sessions(user_id, logged_at DESC);

-- ============================================================
-- MEAL PLANS & SHOPPING LISTS
-- ============================================================

CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_meal_plans" ON meal_plans;
CREATE POLICY "select_own_meal_plans" ON meal_plans FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_meal_plans" ON meal_plans;
CREATE POLICY "insert_own_meal_plans" ON meal_plans FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_meal_plans" ON meal_plans;
CREATE POLICY "update_own_meal_plans" ON meal_plans FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_meal_plans" ON meal_plans;
CREATE POLICY "delete_own_meal_plans" ON meal_plans FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  recipe_id uuid REFERENCES recipes(id),
  food_id uuid REFERENCES foods(id),
  name text NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_meal_plan_items" ON meal_plan_items;
CREATE POLICY "select_own_meal_plan_items" ON meal_plan_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.meal_plan_id AND meal_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_meal_plan_items" ON meal_plan_items;
CREATE POLICY "insert_own_meal_plan_items" ON meal_plan_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.meal_plan_id AND meal_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_meal_plan_items" ON meal_plan_items;
CREATE POLICY "update_own_meal_plan_items" ON meal_plan_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.meal_plan_id AND meal_plans.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.meal_plan_id AND meal_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_meal_plan_items" ON meal_plan_items;
CREATE POLICY "delete_own_meal_plan_items" ON meal_plan_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.meal_plan_id AND meal_plans.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Handlingslista',
  retailer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_shopping_lists" ON shopping_lists;
CREATE POLICY "select_own_shopping_lists" ON shopping_lists FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_shopping_lists" ON shopping_lists;
CREATE POLICY "insert_own_shopping_lists" ON shopping_lists FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_shopping_lists" ON shopping_lists;
CREATE POLICY "update_own_shopping_lists" ON shopping_lists FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_shopping_lists" ON shopping_lists;
CREATE POLICY "delete_own_shopping_lists" ON shopping_lists FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount text,
  category text NOT NULL DEFAULT 'other',
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_shopping_list_items" ON shopping_list_items;
CREATE POLICY "select_own_shopping_list_items" ON shopping_list_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM shopping_lists WHERE shopping_lists.id = shopping_list_items.shopping_list_id AND shopping_lists.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_shopping_list_items" ON shopping_list_items;
CREATE POLICY "insert_own_shopping_list_items" ON shopping_list_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM shopping_lists WHERE shopping_lists.id = shopping_list_items.shopping_list_id AND shopping_lists.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_shopping_list_items" ON shopping_list_items;
CREATE POLICY "update_own_shopping_list_items" ON shopping_list_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM shopping_lists WHERE shopping_lists.id = shopping_list_items.shopping_list_id AND shopping_lists.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM shopping_lists WHERE shopping_lists.id = shopping_list_items.shopping_list_id AND shopping_lists.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_shopping_list_items" ON shopping_list_items;
CREATE POLICY "delete_own_shopping_list_items" ON shopping_list_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM shopping_lists WHERE shopping_lists.id = shopping_list_items.shopping_list_id AND shopping_lists.user_id = auth.uid())
  );

-- ============================================================
-- POINT ENGINE VERSIONING
-- ============================================================

CREATE TABLE IF NOT EXISTS point_engine_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE point_engine_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_point_engine_versions" ON point_engine_versions;
CREATE POLICY "read_point_engine_versions" ON point_engine_versions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_point_engine_versions" ON point_engine_versions;
CREATE POLICY "insert_point_engine_versions" ON point_engine_versions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_point_engine_versions" ON point_engine_versions;
CREATE POLICY "update_point_engine_versions" ON point_engine_versions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS point_engine_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_version_id uuid NOT NULL REFERENCES point_engine_versions(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  rule_value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engine_version_id, rule_key)
);

ALTER TABLE point_engine_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_point_engine_rules" ON point_engine_rules;
CREATE POLICY "read_point_engine_rules" ON point_engine_rules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_point_engine_rules" ON point_engine_rules;
CREATE POLICY "insert_point_engine_rules" ON point_engine_rules FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_point_engine_rules" ON point_engine_rules;
CREATE POLICY "update_point_engine_rules" ON point_engine_rules FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS zero_point_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES food_categories(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE zero_point_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_zero_point_rules" ON zero_point_rules;
CREATE POLICY "read_zero_point_rules" ON zero_point_rules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_zero_point_rules" ON zero_point_rules;
CREATE POLICY "insert_zero_point_rules" ON zero_point_rules FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_zero_point_rules" ON zero_point_rules;
CREATE POLICY "delete_zero_point_rules" ON zero_point_rules FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- PROVIDER CACHE
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  query text,
  barcode text,
  response jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE provider_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_provider_cache" ON provider_cache;
CREATE POLICY "read_provider_cache" ON provider_cache FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_provider_cache" ON provider_cache;
CREATE POLICY "insert_provider_cache" ON provider_cache FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_provider_cache" ON provider_cache;
CREATE POLICY "update_provider_cache" ON provider_cache FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_provider_cache" ON provider_cache;
CREATE POLICY "delete_provider_cache" ON provider_cache FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_provider_cache_lookup ON provider_cache(provider, query, barcode);

-- ============================================================
-- APP SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_app_settings" ON app_settings;
CREATE POLICY "read_app_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_app_settings" ON app_settings;
CREATE POLICY "insert_app_settings" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_app_settings" ON app_settings;
CREATE POLICY "update_app_settings" ON app_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_goals_updated ON user_goals;
CREATE TRIGGER trg_user_goals_updated BEFORE UPDATE ON user_goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_foods_updated ON foods;
CREATE TRIGGER trg_foods_updated BEFORE UPDATE ON foods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_recipes_updated ON recipes;
CREATE TRIGGER trg_recipes_updated BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_app_settings_updated ON app_settings;
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
