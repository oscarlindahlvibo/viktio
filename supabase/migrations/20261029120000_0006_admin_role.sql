/*
# Viktio — Admin role and locked-down shared data

Previously any signed-in user could change the point engine, app settings and the nutrition of
every shared food. Shared data is now writable only by admins (listed in `app_admins`); users can
still create and edit their own foods and recipes.

Admins are granted with SQL only (no client write policy):
  INSERT INTO app_admins (user_id) SELECT id FROM auth.users WHERE email = '...';
*/

CREATE TABLE IF NOT EXISTS app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_own_admin" ON app_admins;
CREATE POLICY "read_own_admin" ON app_admins FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated;

-- Foods: users manage their own, admins manage everything.
DROP POLICY IF EXISTS "insert_foods_user" ON foods;
CREATE POLICY "insert_foods_user" ON foods FOR INSERT
  TO authenticated WITH CHECK (created_by = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "update_foods_owner" ON foods;
CREATE POLICY "update_foods_owner" ON foods FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin())
  WITH CHECK (created_by = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "insert_food_nutrition" ON food_nutrition;
CREATE POLICY "insert_food_nutrition" ON food_nutrition FOR INSERT
  TO authenticated WITH CHECK (
    is_admin() OR EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id AND f.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "update_food_nutrition" ON food_nutrition;
CREATE POLICY "update_food_nutrition" ON food_nutrition FOR UPDATE
  TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id AND f.created_by = auth.uid()))
  WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id AND f.created_by = auth.uid()));

DROP POLICY IF EXISTS "insert_food_servings" ON food_servings;
CREATE POLICY "insert_food_servings" ON food_servings FOR INSERT
  TO authenticated WITH CHECK (
    is_admin() OR EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id AND f.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "insert_external_products" ON external_products;
CREATE POLICY "insert_external_products" ON external_products FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_external_products" ON external_products;
CREATE POLICY "update_external_products" ON external_products FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Recipes: users manage their own (e.g. imported ones), admins manage everything.
DROP POLICY IF EXISTS "insert_recipes" ON recipes;
CREATE POLICY "insert_recipes" ON recipes FOR INSERT
  TO authenticated WITH CHECK (created_by = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "update_recipes" ON recipes;
CREATE POLICY "update_recipes" ON recipes FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin())
  WITH CHECK (created_by = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "delete_recipes_owner" ON recipes;
CREATE POLICY "delete_recipes_owner" ON recipes FOR DELETE
  TO authenticated USING (created_by = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "insert_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "insert_recipe_ingredients" ON recipe_ingredients FOR INSERT
  TO authenticated WITH CHECK (
    is_admin() OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "update_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "update_recipe_ingredients" ON recipe_ingredients FOR UPDATE
  TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.created_by = auth.uid()))
  WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.created_by = auth.uid()));

DROP POLICY IF EXISTS "delete_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "delete_recipe_ingredients" ON recipe_ingredients FOR DELETE
  TO authenticated USING (
    is_admin() OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.created_by = auth.uid())
  );

-- Global configuration and reference data: admins only.
DROP POLICY IF EXISTS "insert_exercises" ON exercises;
CREATE POLICY "insert_exercises" ON exercises FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "insert_point_engine_versions" ON point_engine_versions;
CREATE POLICY "insert_point_engine_versions" ON point_engine_versions FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_point_engine_versions" ON point_engine_versions;
CREATE POLICY "update_point_engine_versions" ON point_engine_versions FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "insert_point_engine_rules" ON point_engine_rules;
CREATE POLICY "insert_point_engine_rules" ON point_engine_rules FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_point_engine_rules" ON point_engine_rules;
CREATE POLICY "update_point_engine_rules" ON point_engine_rules FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "insert_zero_point_rules" ON zero_point_rules;
CREATE POLICY "insert_zero_point_rules" ON zero_point_rules FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_zero_point_rules" ON zero_point_rules;
CREATE POLICY "delete_zero_point_rules" ON zero_point_rules FOR DELETE
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "insert_provider_cache" ON provider_cache;
CREATE POLICY "insert_provider_cache" ON provider_cache FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_provider_cache" ON provider_cache;
CREATE POLICY "update_provider_cache" ON provider_cache FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_provider_cache" ON provider_cache;
CREATE POLICY "delete_provider_cache" ON provider_cache FOR DELETE
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "insert_app_settings" ON app_settings;
CREATE POLICY "insert_app_settings" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_app_settings" ON app_settings;
CREATE POLICY "update_app_settings" ON app_settings FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
