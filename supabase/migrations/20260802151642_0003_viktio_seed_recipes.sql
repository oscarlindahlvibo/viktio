/*
# Viktio — Seed Data Part 2 (Recipes, Exercises, Demo User)

Seeds:
- Recipe sources (Viktio original, ICA, Coop, City Gross)
- 15 original recipes with ingredients, nutrition, and points calculated server-side
- 10 exercises
- Demo user with profile, goals, 2 weeks of weight entries and food log history

All recipes are original to Viktio (no copyrighted text).
Points are calculated using the v1 engine rules stored in the database.
*/

-- ============================================================
-- RECIPE SOURCES
-- ============================================================

INSERT INTO recipe_sources (name, slug) VALUES
  ('Viktio', 'viktio'),
  ('ICA Recept', 'ica_recept'),
  ('Coop Recept', 'coop_recept'),
  ('City Gross Recept', 'city_gross_recept')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- EXERCISES
-- ============================================================

INSERT INTO exercises (name, category, muscle_group, equipment, description) VALUES
  ('Promenad', 'cardio', 'Helkropp', 'Inget', 'Gå i lugn till måttlig takt utomhus eller på löpband.'),
  ('Löpning', 'cardio', 'Helkropp', 'Inget', 'Löp i måttlig takt, justera efter din nivå.'),
  ('Cykling', 'cardio', 'Ben', 'Cykel', 'Cykla utomhus eller på träningscykel.'),
  ('Simning', 'cardio', 'Helkropp', 'Inget', 'Simma valfri simsätt i måttlig intensitet.'),
  ('Squat', 'strength', 'Ben', 'Skivstång', 'Böj knä och sjunk ner med rak rygg, pressa upp genom klackarna.'),
  ('Bänkpress', 'strength', 'Bröst', 'Skivstång', 'Pressa stången från brösthöjd till raka armar.'),
  ('Marklyft', 'strength', 'Rygg/Ben', 'Skivstång', 'Lyft stången från golvet med rak rygg till stående.'),
  ('Pull-ups', 'strength', 'Rygg', 'Räck', 'Dra dig upp tills hakan är över räcket, sänk kontrollerat.'),
  ('Plankan', 'core', 'Mage', 'Inget', 'Håll kroppen rak på underarmarna, spänna magen.'),
  ('Armhävningar', 'strength', 'Bröst/Armar', 'Inget', 'Sänk och pressa upp kroppen med raka armar.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RECIPES
-- ============================================================
-- We calculate points server-side using the v1 engine rules.
-- Helper function to calculate points per 100g from nutrition values.

CREATE OR REPLACE FUNCTION calc_points_100g(
  p_kcal numeric, p_protein numeric, p_carb numeric, p_sugar numeric,
  p_fat numeric, p_satfat numeric, p_fiber numeric, p_sodium numeric
) RETURNS numeric AS $$
DECLARE
  w_cal numeric; w_pro numeric; w_sugar numeric; w_satfat numeric; w_fat numeric; w_fiber numeric; w_sodium numeric;
  pts numeric;
BEGIN
  SELECT rule_value INTO w_cal FROM point_engine_rules WHERE engine_version_id = (SELECT id FROM point_engine_versions WHERE is_active LIMIT 1) AND rule_key = 'calorie_weight';
  SELECT rule_value INTO w_pro FROM point_engine_rules WHERE engine_version_id = (SELECT id FROM point_engine_versions WHERE is_active LIMIT 1) AND rule_key = 'protein_weight';
  SELECT rule_value INTO w_sugar FROM point_engine_rules WHERE engine_version_id = (SELECT id FROM point_engine_versions WHERE is_active LIMIT 1) AND rule_key = 'sugar_weight';
  SELECT rule_value INTO w_satfat FROM point_engine_rules WHERE engine_version_id = (SELECT id FROM point_engine_versions WHERE is_active LIMIT 1) AND rule_key = 'saturated_fat_weight';
  SELECT rule_value INTO w_fat FROM point_engine_rules WHERE engine_version_id = (SELECT id FROM point_engine_versions WHERE is_active LIMIT 1) AND rule_key = 'fat_weight';
  SELECT rule_value INTO w_fiber FROM point_engine_rules WHERE engine_version_id = (SELECT id FROM point_engine_versions WHERE is_active LIMIT 1) AND rule_key = 'fiber_weight';
  SELECT rule_value INTO w_sodium FROM point_engine_rules WHERE engine_version_id = (SELECT id FROM point_engine_versions WHERE is_active LIMIT 1) AND rule_key = 'sodium_weight';

  pts := p_kcal * w_cal
       + p_protein * w_pro
       + p_sugar * w_sugar
       + p_satfat * w_satfat
       + p_fat * w_fat
       + p_fiber * w_fiber
       + p_sodium * w_sodium;

  RETURN GREATEST(pts, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper to get nutrition for a food by name
CREATE OR REPLACE FUNCTION get_nutrition(p_food_name text)
RETURNS TABLE (food_id uuid, kcal numeric, protein_g numeric, carb_g numeric, sugar_g numeric, fat_g numeric, satfat_g numeric, fiber_g numeric, sodium_mg numeric, zero_point boolean)
AS $$
  SELECT f.id, n.kcal, n.protein_g, n.carbohydrate_g, n.sugar_g, n.fat_g, n.saturated_fat_g, n.fiber_g, n.sodium_mg, f.zero_point
  FROM foods f
  JOIN food_nutrition n ON n.food_id = f.id
  WHERE f.name = p_food_name
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Helper to insert a recipe ingredient
CREATE OR REPLACE FUNCTION insert_recipe_ingredient(
  p_recipe_id uuid, p_food_name text, p_raw_text text, p_amount numeric, p_unit text, p_weight_g numeric
) RETURNS void AS $$
DECLARE
  v_food uuid; v_kcal numeric; v_pro numeric; v_carb numeric; v_sugar numeric; v_fat numeric; v_satfat numeric; v_fiber numeric; v_sodium numeric; v_zero boolean;
  v_pts numeric; v_factor numeric; v_conf text;
BEGIN
  SELECT food_id, kcal, protein_g, carb_g, sugar_g, fat_g, satfat_g, fiber_g, sodium_mg, zero_point
  INTO v_food, v_kcal, v_pro, v_carb, v_sugar, v_fat, v_satfat, v_fiber, v_sodium, v_zero
  FROM get_nutrition(p_food_name);

  IF v_food IS NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, raw_text, amount, unit, weight_g, confidence)
    VALUES (p_recipe_id, p_raw_text, p_amount, p_unit, p_weight_g, 'unmatched');
    RETURN;
  END IF;

  v_factor := p_weight_g / 100.0;
  v_pts := CASE WHEN v_zero THEN 0 ELSE calc_points_100g(v_kcal, v_pro, v_carb, v_sugar, v_fat, v_satfat, v_fiber, v_sodium) * v_factor END;
  v_conf := 'high';

  INSERT INTO recipe_ingredients (recipe_id, food_id, raw_text, amount, unit, weight_g, kcal, protein_g, carbohydrate_g, fat_g, fiber_g, points, confidence)
  VALUES (p_recipe_id, v_food, p_raw_text, p_amount, p_unit, p_weight_g,
    v_kcal * v_factor, v_pro * v_factor, v_carb * v_factor, v_fat * v_factor, v_fiber * v_factor, v_pts, v_conf);
END;
$$ LANGUAGE plpgsql;

-- Helper to finalize recipe totals
CREATE OR REPLACE FUNCTION finalize_recipe(p_recipe_id uuid, p_servings int)
RETURNS void AS $$
DECLARE
  v_total_pts numeric; v_total_kcal numeric; v_total_pro numeric; v_total_carb numeric; v_total_fat numeric; v_total_fiber numeric;
  v_eng uuid;
BEGIN
  SELECT id INTO v_eng FROM point_engine_versions WHERE is_active LIMIT 1;

  SELECT COALESCE(SUM(points),0), COALESCE(SUM(kcal),0), COALESCE(SUM(protein_g),0), COALESCE(SUM(carbohydrate_g),0), COALESCE(SUM(fat_g),0), COALESCE(SUM(fiber_g),0)
  INTO v_total_pts, v_total_kcal, v_total_pro, v_total_carb, v_total_fat, v_total_fiber
  FROM recipe_ingredients WHERE recipe_id = p_recipe_id;

  UPDATE recipes SET
    total_points = v_total_pts,
    kcal_per_serving = v_total_kcal / p_servings,
    protein_per_serving = v_total_pro / p_servings,
    carbs_per_serving = v_total_carb / p_servings,
    fat_per_serving = v_total_fat / p_servings,
    fiber_per_serving = v_total_fiber / p_servings,
    servings = p_servings,
    engine_version_id = v_eng
  WHERE id = p_recipe_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INSERT RECIPES
-- ============================================================

DO $$
DECLARE
  v_viktio uuid; v_ica uuid; v_coop uuid; v_citygross uuid;
  r uuid;
BEGIN
  SELECT id INTO v_viktio FROM recipe_sources WHERE slug='viktio';
  SELECT id INTO v_ica FROM recipe_sources WHERE slug='ica_recept';
  SELECT id INTO v_coop FROM recipe_sources WHERE slug='coop_recept';
  SELECT id INTO v_citygross FROM recipe_sources WHERE slug='city_gross_recept';

  -- 1. Kycklinggryta med kikärtor
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Kycklinggryta med kikärtor', NULL, 10, 25, 4, v_viktio, 'Viktio', 'Fräs kyckling i tärningar tills genomstekt. Tillsätt finhackad lök, vitlök och krossade tomater. Låt sjuda 15 min. Tillsätt kikärtor och spenat, smaksätt med salt och peppar.', ARRAY['hogprotein','lunch','middag'], 'dinner', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Kycklingfilé', '500 g kycklingfilé', 500, 'g', 500);
  PERFORM insert_recipe_ingredient(r, 'Gul lök', '1 gul lök', 1, 'st', 110);
  PERFORM insert_recipe_ingredient(r, 'Vitlök', '2 vitlöksklyftor', 2, 'st', 6);
  PERFORM insert_recipe_ingredient(r, 'Krossade tomater', '400 g krossade tomater', 400, 'g', 400);
  PERFORM insert_recipe_ingredient(r, 'Kikärtor kokta', '400 g kikärtor', 400, 'g', 400);
  PERFORM insert_recipe_ingredient(r, 'Spenat', '150 g spenat', 150, 'g', 150);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '1 msk olivolja', 1, 'msk', 13.5);
  PERFORM finalize_recipe(r, 4);

  -- 2. Lax med quinoa och broccoli
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Lax med quinoa och broccoli', NULL, 10, 20, 4, v_viktio, 'Viktio', 'Baka laxfilé i ugn 200 grader ca 15 min. Koka quinoa enligt förpackning. Ångkoka broccoli 5 min. Servera med en klick citron.', ARRAY['hogprotein','lunch','middag'], 'dinner', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Laxfilé', '600 g laxfilé', 600, 'g', 600);
  PERFORM insert_recipe_ingredient(r, 'Quinoa kokt', '4 dl kokt quinoa', 4, 'dl', 320);
  PERFORM insert_recipe_ingredient(r, 'Broccoli', '400 g broccoli', 400, 'g', 400);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '1 msk olivolja', 1, 'msk', 13.5);
  PERFORM finalize_recipe(r, 4);

  -- 3. Ägg och keso frukost
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Ägg och keso frukost', NULL, 5, 10, 1, v_viktio, 'Viktio', 'Stek två ägg i lite olja. Lägg på en tallrik med keso och knäckebröd. Toppa med salt och peppar.', ARRAY['hogprotein','frukost','snabb'], 'breakfast', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Ägg', '2 ägg', 2, 'st', 110);
  PERFORM insert_recipe_ingredient(r, 'Keso 1,5%', '150 g keso', 150, 'g', 150);
  PERFORM insert_recipe_ingredient(r, 'Knäckebröd', '2 knäckebröd', 2, 'st', 46);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '1 tsk olivolja', 1, 'tsk', 4.5);
  PERFORM finalize_recipe(r, 1);

  -- 4. Bolognese med fullkornspasta
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Bolognese med fullkornspasta', NULL, 10, 30, 4, v_viktio, 'Viktio', 'Fräs finhackad lök och vitlök i olja. Tillsätt nötfärs och bryn. Häll i krossade tomater, tomatpuré och örter. Låt sjuda 20 min. Koka pasta och servera.', ARRAY['familjevanlig','middag'], 'dinner', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Nötfärs 5%', '500 g nötfärs 5%', 500, 'g', 500);
  PERFORM insert_recipe_ingredient(r, 'Gul lök', '1 gul lök', 1, 'st', 110);
  PERFORM insert_recipe_ingredient(r, 'Vitlök', '2 vitlöksklyftor', 2, 'st', 6);
  PERFORM insert_recipe_ingredient(r, 'Krossade tomater', '400 g krossade tomater', 400, 'g', 400);
  PERFORM insert_recipe_ingredient(r, 'Tomatpuré', '2 msk tomatpuré', 2, 'msk', 30);
  PERFORM insert_recipe_ingredient(r, 'Pasta torkad', '300 g pasta', 300, 'g', 300);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '1 msk olivolja', 1, 'msk', 13.5);
  PERFORM finalize_recipe(r, 4);

  -- 5. Tonfisksallad
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Tonfisksallad', NULL, 10, 0, 2, v_viktio, 'Viktio', 'Blanda sallad, tomat, gurka, paprika och tonfisk. Dressa med olivolja och citron.', ARRAY['laggpoints','lunch','snabb'], 'lunch', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Tonfisk i vatten', '200 g tonfisk', 200, 'g', 200);
  PERFORM insert_recipe_ingredient(r, 'Sallad isberg', '1 sallad isberg', 1, 'st', 300);
  PERFORM insert_recipe_ingredient(r, 'Tomat', '4 tomater', 4, 'st', 400);
  PERFORM insert_recipe_ingredient(r, 'Gurka', '1 gurka', 1, 'st', 300);
  PERFORM insert_recipe_ingredient(r, 'Paprika röd', '1 paprika', 1, 'st', 120);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '2 msk olivolja', 2, 'msk', 27);
  PERFORM finalize_recipe(r, 2);

  -- 6. Grekisk yoghurt med bär och nötter
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Grekisk yoghurt med bär och nötter', NULL, 5, 0, 1, v_viktio, 'Viktio', 'Blanda grekisk yoghurt med bär och valnötter i en skål.', ARRAY['frukost','snabb','hogprotein'], 'breakfast', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Grekisk yoghurt 0%', '200 g grekisk yoghurt', 200, 'g', 200);
  PERFORM insert_recipe_ingredient(r, 'Blåbär', '100 g blåbär', 100, 'g', 100);
  PERFORM insert_recipe_ingredient(r, 'Valnötter', '20 g valnötter', 20, 'g', 20);
  PERFORM finalize_recipe(r, 1);

  -- 7. Kycklingkebab med ris
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Kycklingkebab med ris', NULL, 15, 20, 4, v_viktio, 'Viktio', 'Marinera kycklingfilé i tärningar med kebakryddor. Stek i het panna. Servera med kokt ris, sallad och tomatsås.', ARRAY['middag','hogprotein'], 'dinner', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Kycklingfilé', '600 g kycklingfilé', 600, 'g', 600);
  PERFORM insert_recipe_ingredient(r, 'Basmatiris kokt', '6 dl kokt basmatiris', 6, 'dl', 480);
  PERFORM insert_recipe_ingredient(r, 'Tomat', '2 tomater', 2, 'st', 200);
  PERFORM insert_recipe_ingredient(r, 'Sallad isberg', '1 sallad isberg', 1, 'st', 300);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '1 msk olivolja', 1, 'msk', 13.5);
  PERFORM finalize_recipe(r, 4);

  -- 8. Linssoppa
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Röd linssoppa', NULL, 10, 25, 4, v_viktio, 'Viktio', 'Fräs lök och vitlök i olja. Tillsätt röda linser, krossade tomater och buljong. Koka tills linser är mjuka, ca 20 min.', ARRAY['vegetarisk','lunch','vegan'], 'lunch', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Röda linser kokta', '300 g röda linser', 300, 'g', 300);
  PERFORM insert_recipe_ingredient(r, 'Gul lök', '1 gul lök', 1, 'st', 110);
  PERFORM insert_recipe_ingredient(r, 'Vitlök', '2 vitlöksklyftor', 2, 'st', 6);
  PERFORM insert_recipe_ingredient(r, 'Krossade tomater', '400 g krossade tomater', 400, 'g', 400);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '1 msk olivolja', 1, 'msk', 13.5);
  PERFORM finalize_recipe(r, 4);

  -- 9. Havregrynsgröt med bär
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Havregrynsgröt med bär', NULL, 2, 8, 1, v_viktio, 'Viktio', 'Koka upp havregryn med mjölk och vatten. Låt svälla 5 min. Servera med bär.', ARRAY['frukost','snabb','vegetarisk'], 'breakfast', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Havregryn', '1 dl havregryn', 1, 'dl', 35);
  PERFORM insert_recipe_ingredient(r, 'Mellanmjölk 1,5%', '2 dl mjölk', 2, 'dl', 206);
  PERFORM insert_recipe_ingredient(r, 'Hallon', '100 g hallon', 100, 'g', 100);
  PERFORM finalize_recipe(r, 1);

  -- 10. Torsk med potatis och dillås
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Torsk med potatis och dillås', NULL, 15, 20, 4, v_viktio, 'Viktio', 'Koka potatis. Ångkoka torsk 8 min. Koka en lätt sås på mjölk och dill.', ARRAY['middag','laggpoints'], 'dinner', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Torskfilé', '600 g torskfilé', 600, 'g', 600);
  PERFORM insert_recipe_ingredient(r, 'Potatis kokt', '800 g potatis', 800, 'g', 800);
  PERFORM insert_recipe_ingredient(r, 'Mellanmjölk 1,5%', '3 dl mjölk', 3, 'dl', 309);
  PERFORM insert_recipe_ingredient(r, 'Margarin lätt', '1 msk margarin', 1, 'msk', 14);
  PERFORM finalize_recipe(r, 4);

  -- 11. Keso pannkakor
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Keso pannkakor', NULL, 10, 10, 2, v_viktio, 'Viktio', 'Blanda keso, ägg och havregryn till en smet. Stek små pannkakor i lite olja.', ARRAY['frukost','hogprotein'], 'breakfast', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Keso 1,5%', '300 g keso', 300, 'g', 300);
  PERFORM insert_recipe_ingredient(r, 'Ägg', '3 ägg', 3, 'st', 165);
  PERFORM insert_recipe_ingredient(r, 'Havregryn', '1 dl havregryn', 1, 'dl', 35);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '1 tsk olivolja', 1, 'tsk', 4.5);
  PERFORM finalize_recipe(r, 2);

  -- 12. Svartbönsgryta
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Svartbönsgryta', NULL, 10, 30, 4, v_viktio, 'Viktio', 'Fräs lök och vitlök. Tillsätt svarta bönor, krossade tomater och spiskummin. Sjud 25 min.', ARRAY['vegan','vegetarisk','middag'], 'dinner', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Svarta bönor kokta', '400 g svarta bönor', 400, 'g', 400);
  PERFORM insert_recipe_ingredient(r, 'Gul lök', '1 gul lök', 1, 'st', 110);
  PERFORM insert_recipe_ingredient(r, 'Vitlök', '2 vitlöksklyftor', 2, 'st', 6);
  PERFORM insert_recipe_ingredient(r, 'Krossade tomater', '400 g krossade tomater', 400, 'g', 400);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '1 msk olivolja', 1, 'msk', 13.5);
  PERFORM finalize_recipe(r, 4);

  -- 13. Kyckling sallad med avokado
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Kycklingsallad med avokado', NULL, 15, 10, 2, v_viktio, 'Viktio', 'Stek kycklingfilé i strimlor. Blanda med sallad, avokado, tomat och paprika. Dressa med olivolja och lime.', ARRAY['lunch','hogprotein','laggpoints'], 'lunch', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Kycklingfilé', '300 g kycklingfilé', 300, 'g', 300);
  PERFORM insert_recipe_ingredient(r, 'Avokado', '1 avokado', 1, 'st', 150);
  PERFORM insert_recipe_ingredient(r, 'Sallad isberg', '1 sallad isberg', 1, 'st', 300);
  PERFORM insert_recipe_ingredient(r, 'Tomat', '2 tomater', 2, 'st', 200);
  PERFORM insert_recipe_ingredient(r, 'Paprika röd', '1 paprika', 1, 'st', 120);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '1 msk olivolja', 1, 'msk', 13.5);
  PERFORM finalize_recipe(r, 2);

  -- 14. Räksmörgås
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Räksmörgås', NULL, 5, 0, 1, v_viktio, 'Viktio', 'Bred margarin på knäckebröd. Toppa med räkor, ägg och lite dill.', ARRAY['snabb','mellanmal'], 'snack', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Knäckebröd', '2 knäckebröd', 2, 'st', 46);
  PERFORM insert_recipe_ingredient(r, 'Räkor', '100 g räkor', 100, 'g', 100);
  PERFORM insert_recipe_ingredient(r, 'Ägg', '1 ägg', 1, 'st', 55);
  PERFORM insert_recipe_ingredient(r, 'Margarin lätt', '1 msk margarin', 1, 'msk', 14);
  PERFORM finalize_recipe(r, 1);

  -- 15. Ugnsrostade rotfrukter med kalkon
  INSERT INTO recipes (name, image_url, prep_time_min, cook_time_min, servings, source_id, source_name, instructions, tags, meal_type, status, created_by)
  VALUES ('Ugnsrostade rotfrukter med kalkon', NULL, 15, 35, 4, v_viktio, 'Viktio', 'Skär rotfrukter i tärningar, blanda med olja och rosta i ugn 200 grader 30 min. Stek kalkonbröst och skiva. Servera.', ARRAY['middag','hogprotein'], 'dinner', 'verified', NULL)
  RETURNING id INTO r;
  PERFORM insert_recipe_ingredient(r, 'Kalkonbröst', '500 g kalkonbröst', 500, 'g', 500);
  PERFORM insert_recipe_ingredient(r, 'Morot', '400 g morötter', 400, 'g', 400);
  PERFORM insert_recipe_ingredient(r, 'Sötpotatis', '500 g sötpotatis', 500, 'g', 500);
  PERFORM insert_recipe_ingredient(r, 'Olivolja', '2 msk olivolja', 2, 'msk', 27);
  PERFORM finalize_recipe(r, 4);

END $$;

-- Drop recipe helper functions
DROP FUNCTION IF EXISTS insert_recipe_ingredient(uuid, text, text, numeric, text, numeric);
DROP FUNCTION IF EXISTS finalize_recipe(uuid, int);
DROP FUNCTION IF EXISTS get_nutrition(text);
DROP FUNCTION IF EXISTS calc_points_100g(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric);
