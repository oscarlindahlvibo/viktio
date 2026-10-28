/*
# Viktio — Food import and ingredient matching

- Links imported foods to their source record (`foods.external_id`) so imports can be re-run as upserts.
- Adds trigram search on food names for fuzzy ingredient matching.
- `match_food` ranks foods for a free-text ingredient name.
- `apply_ingredient_match` stores a matched food, weight, nutrition and points on a recipe ingredient.
- `recalculate_recipe` refreshes a recipe's totals from its ingredients.
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE foods ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_source_external
  ON foods (source_id, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_foods_name_trgm
  ON foods USING gin (lower(name) extensions.gin_trgm_ops);

INSERT INTO food_sources (name, slug) VALUES ('Livsmedelsverket', 'livsmedelsverket')
ON CONFLICT (slug) DO NOTHING;

-- Ranks generic foods (no brand) by how well their name matches an ingredient name.
-- Raw/unprocessed variants get a small boost since recipes list ingredients before cooking;
-- composite dishes and sauces are pushed down so "champinjoner" doesn't match a pizza.
CREATE OR REPLACE FUNCTION match_food(p_query text, p_limit int DEFAULT 5)
RETURNS TABLE (food_id uuid, name text, score real)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  WITH q AS (SELECT lower(trim(p_query)) AS q)
  SELECT f.id, f.name,
    (
      GREATEST(similarity(lower(f.name), q.q), word_similarity(q.q, lower(f.name)))
      + CASE WHEN lower(f.name) = q.q THEN 0.3 ELSE 0 END
      + CASE WHEN split_part(lower(f.name), ' ', 1) = split_part(q.q, ' ', 1) THEN 0.15
             WHEN lower(f.name) LIKE split_part(q.q, ' ', 1) || '%' THEN 0.1 ELSE 0 END
      + CASE WHEN lower(f.name) ~ '\mrå\M' THEN 0.05 ELSE 0 END
      - CASE WHEN c.slug IN ('fardigmat', 'sas_dressing') AND q.q !~ 'sås|dressing|soppa|gryta|pizza|paj' THEN 0.3 ELSE 0 END
      - CASE WHEN lower(f.name) LIKE '% m. %' AND q.q NOT LIKE '% m. %' THEN 0.1 ELSE 0 END
      - LEAST(length(f.name), 80) * 0.003
    )::real AS score
  FROM foods f
  CROSS JOIN q
  LEFT JOIN food_categories c ON c.id = f.category_id
  WHERE f.brand IS NULL
    AND f.status <> 'user_created'
    AND (lower(f.name) % q.q OR q.q <% lower(f.name))
    AND EXISTS (SELECT 1 FROM food_nutrition n WHERE n.food_id = f.id)
  ORDER BY score DESC
  LIMIT p_limit;
$$;

-- Rule lookup with the same fallback as points.ts (`rule || default`).
CREATE OR REPLACE FUNCTION n_or(p_value numeric, p_default numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT COALESCE(NULLIF(p_value, 0), p_default) $$;

-- Points per 100 g using the active point engine; mirrors calculateFoodPoints in src/lib/points.ts.
CREATE OR REPLACE FUNCTION food_points_100g(n food_nutrition)
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  WITH r AS (
    SELECT rule_key, rule_value FROM point_engine_rules
    WHERE engine_version_id = (SELECT id FROM point_engine_versions WHERE is_active LIMIT 1)
  )
  SELECT GREATEST(
      (n.kcal * n_or((SELECT rule_value FROM r WHERE rule_key = 'calorie_weight'), 0.03)
     + n.protein_g * n_or((SELECT rule_value FROM r WHERE rule_key = 'protein_weight'), -0.012)
     + n.sugar_g * n_or((SELECT rule_value FROM r WHERE rule_key = 'sugar_weight'), 0.04)
     + n.saturated_fat_g * n_or((SELECT rule_value FROM r WHERE rule_key = 'saturated_fat_weight'), 0.035)
     + n.fat_g * n_or((SELECT rule_value FROM r WHERE rule_key = 'fat_weight'), 0.018)
     + n.fiber_g * n_or((SELECT rule_value FROM r WHERE rule_key = 'fiber_weight'), -0.02)
     + n.sodium_mg * n_or((SELECT rule_value FROM r WHERE rule_key = 'sodium_weight'), 0.0008))
     * 100 / NULLIF(n.per_amount, 0),
    n_or((SELECT rule_value FROM r WHERE rule_key = 'min_points'), 0));
$$;

CREATE OR REPLACE FUNCTION apply_ingredient_match(
  p_ingredient_id uuid,
  p_food_id uuid,
  p_amount numeric,
  p_unit text,
  p_weight_g numeric,
  p_confidence text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  n food_nutrition%ROWTYPE;
  v_zero boolean;
  v_factor numeric;
  v_points numeric;
BEGIN
  IF p_food_id IS NULL THEN
    UPDATE recipe_ingredients SET
      food_id = NULL, amount = p_amount, unit = p_unit, weight_g = p_weight_g,
      kcal = 0, protein_g = 0, carbohydrate_g = 0, fat_g = 0, fiber_g = 0, points = 0,
      -- A confidence other than 'unmatched' marks a deliberately ignored seasoning.
      confidence = COALESCE(p_confidence, 'unmatched')
    WHERE id = p_ingredient_id;
    RETURN;
  END IF;

  SELECT * INTO n FROM food_nutrition WHERE food_id = p_food_id ORDER BY created_at DESC LIMIT 1;
  SELECT zero_point INTO v_zero FROM foods WHERE id = p_food_id;
  v_factor := COALESCE(p_weight_g, 0) / NULLIF(n.per_amount, 0);
  v_points := CASE WHEN v_zero THEN 0 ELSE round(food_points_100g(n) * COALESCE(p_weight_g, 0) / 100, 1) END;

  UPDATE recipe_ingredients SET
    food_id = p_food_id,
    amount = p_amount,
    unit = p_unit,
    weight_g = p_weight_g,
    kcal = round(n.kcal * v_factor, 1),
    protein_g = round(n.protein_g * v_factor, 1),
    carbohydrate_g = round(n.carbohydrate_g * v_factor, 1),
    fat_g = round(n.fat_g * v_factor, 1),
    fiber_g = round(n.fiber_g * v_factor, 1),
    points = v_points,
    confidence = p_confidence
  WHERE id = p_ingredient_id;
END;
$$;

CREATE OR REPLACE FUNCTION recalculate_recipe(p_recipe_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE recipes r SET
    total_points = t.points,
    kcal_per_serving = round(t.kcal / r.servings, 1),
    protein_per_serving = round(t.protein / r.servings, 1),
    carbs_per_serving = round(t.carbs / r.servings, 1),
    fat_per_serving = round(t.fat / r.servings, 1),
    fiber_per_serving = round(t.fiber / r.servings, 1),
    engine_version_id = (SELECT id FROM point_engine_versions WHERE is_active LIMIT 1),
    updated_at = now()
  FROM (
    SELECT COALESCE(sum(points), 0) AS points, COALESCE(sum(kcal), 0) AS kcal,
      COALESCE(sum(protein_g), 0) AS protein, COALESCE(sum(carbohydrate_g), 0) AS carbs,
      COALESCE(sum(fat_g), 0) AS fat, COALESCE(sum(fiber_g), 0) AS fiber
    FROM recipe_ingredients WHERE recipe_id = p_recipe_id
  ) t
  WHERE r.id = p_recipe_id;
$$;

REVOKE EXECUTE ON FUNCTION apply_ingredient_match(uuid, uuid, numeric, text, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION recalculate_recipe(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION match_food(text, int) TO anon, authenticated;
