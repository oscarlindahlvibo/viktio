/*
# Viktio — Seed Data Part 1 (Foods)

Seeds point engine v1, app settings, food categories, food sources, and 50+ foods with nutrition per 100g, including 20 Swedish grocery products with barcodes.

Helper functions are defined FIRST, then called from a DO block.
*/

-- ============================================================
-- POINT ENGINE v1
-- ============================================================

INSERT INTO point_engine_versions (version, label, is_active)
VALUES ('v1', 'Points Engine v1', true)
ON CONFLICT (version) DO NOTHING;

INSERT INTO point_engine_rules (engine_version_id, rule_key, rule_value)
SELECT v.id, r.key, r.value
FROM point_engine_versions v
CROSS JOIN (VALUES
  ('calorie_weight', 0.03),
  ('protein_weight', -0.012),
  ('sugar_weight', 0.04),
  ('saturated_fat_weight', 0.035),
  ('fat_weight', 0.018),
  ('fiber_weight', -0.02),
  ('sodium_weight', 0.0008),
  ('min_points', 0),
  ('round_precision', 1),
  ('points_per_100g_divisor', 1)
) AS r(key, value)
WHERE v.version = 'v1'
ON CONFLICT (engine_version_id, rule_key) DO NOTHING;

-- ============================================================
-- APP SETTINGS
-- ============================================================

INSERT INTO app_settings (key, value) VALUES
  ('points_label', '"points"'::jsonb),
  ('points_label_plural', '"points"'::jsonb),
  ('weekly_points_default', '35'::jsonb),
  ('exercise_bonus_enabled', 'false'::jsonb),
  ('exercise_bonus_rate', '0'::jsonb),
  ('app_name', '"Viktio"'::jsonb),
  ('language', '"sv-SE"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- FOOD CATEGORIES
-- ============================================================

INSERT INTO food_categories (name, slug, zero_point) VALUES
  ('Frukt', 'frukt', true),
  ('Grönsaker', 'gronsaker', true),
  ('Ägg', 'agg', true),
  ('Kycklingbröst', 'kycklingbrost', true),
  ('Kalkonbröst', 'kalkonbrost', true),
  ('Fisk', 'fisk', true),
  ('Baljväxter', 'baljvaxter', true),
  ('Mejeri lätt', 'mejeri_latt', true),
  ('Kött', 'kott', false),
  ('Fläsk', 'flask', false),
  ('Mejeri', 'mejeri', false),
  ('Spannmål', 'spannmal', false),
  ('Bröd', 'brod', false),
  ('Pasta och ris', 'pasta_ris', false),
  ('Potatis', 'potatis', false),
  ('Sötsaker', 'sotsaker', false),
  ('Snacks', 'snacks', false),
  ('Drycker', 'drycker', false),
  ('Fett och olja', 'fett_olja', false),
  ('Sås och dressing', 'sas_dressing', false),
  ('Färdigmat', 'fardigmat', false),
  ('Nötter och frön', 'notter_fron', false),
  ('Bakning', 'bakning', false)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- FOOD SOURCES
-- ============================================================

INSERT INTO food_sources (name, slug) VALUES
  ('Viktio', 'viktio'),
  ('Open Food Facts', 'open_food_facts'),
  ('ICA', 'ica'),
  ('Coop', 'coop'),
  ('City Gross', 'city_gross'),
  ('Mathem', 'mathem'),
  ('Willys', 'willys')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- HELPER FUNCTIONS (must exist before DO block)
-- ============================================================

CREATE OR REPLACE FUNCTION insert_food(
  p_name text, p_brand text, p_cat uuid, p_src uuid,
  p_kcal numeric, p_protein numeric, p_carb numeric, p_sugar numeric, p_fat numeric, p_satfat numeric, p_fiber numeric, p_sodium numeric, p_zero boolean
) RETURNS uuid AS $$
DECLARE f_id uuid;
BEGIN
  INSERT INTO foods (name, brand, category_id, source_id, zero_point, status)
  VALUES (p_name, p_brand, p_cat, p_src, p_zero, 'verified')
  ON CONFLICT DO NOTHING
  RETURNING id INTO f_id;
  IF f_id IS NULL THEN
    SELECT id INTO f_id FROM foods WHERE name = p_name AND COALESCE(brand,'') = COALESCE(p_brand,'');
  END IF;
  INSERT INTO food_nutrition (food_id, kcal, protein_g, carbohydrate_g, sugar_g, fat_g, saturated_fat_g, fiber_g, sodium_mg, per_amount, unit)
  VALUES (f_id, p_kcal, p_protein, p_carb, p_sugar, p_fat, p_satfat, p_fiber, p_sodium, 100, 'g')
  ON CONFLICT DO NOTHING;
  RETURN f_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insert_food_barcode(
  p_name text, p_brand text, p_cat uuid, p_src uuid,
  p_barcode text, p_pkg text, p_serving_g numeric, p_serving_desc text,
  p_kcal numeric, p_protein numeric, p_carb numeric, p_sugar numeric, p_fat numeric, p_satfat numeric, p_fiber numeric, p_sodium numeric, p_zero boolean
) RETURNS uuid AS $$
DECLARE f_id uuid;
BEGIN
  INSERT INTO foods (name, brand, category_id, source_id, barcode, package_size, serving_size_g, serving_description, zero_point, status)
  VALUES (p_name, p_brand, p_cat, p_src, p_barcode, p_pkg, p_serving_g, p_serving_desc, p_zero, 'verified')
  ON CONFLICT DO NOTHING
  RETURNING id INTO f_id;
  IF f_id IS NULL THEN
    SELECT id INTO f_id FROM foods WHERE barcode = p_barcode;
  END IF;
  INSERT INTO food_nutrition (food_id, kcal, protein_g, carbohydrate_g, sugar_g, fat_g, saturated_fat_g, fiber_g, sodium_mg, per_amount, unit)
  VALUES (f_id, p_kcal, p_protein, p_carb, p_sugar, p_fat, p_satfat, p_fiber, p_sodium, 100, 'g')
  ON CONFLICT DO NOTHING;
  RETURN f_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FOODS + NUTRITION
-- ============================================================

DO $$
DECLARE
  v_viktio uuid; v_off uuid;
  v_frukt uuid; v_gronsaker uuid; v_agg uuid; v_kyckling uuid; v_kalkon uuid; v_fisk uuid; v_baljvaxter uuid; v_mejeri_latt uuid;
  v_kott uuid; v_flask uuid; v_mejeri uuid; v_spannmal uuid; v_brod uuid; v_pasta_ris uuid; v_potatis uuid;
  v_sotsaker uuid; v_snacks uuid; v_drycker uuid; v_fett uuid; v_sas uuid; v_fardigmat uuid; v_notter uuid; v_bakning uuid;
  f uuid;
BEGIN
  SELECT id INTO v_viktio FROM food_sources WHERE slug='viktio';
  SELECT id INTO v_off FROM food_sources WHERE slug='open_food_facts';
  SELECT id INTO v_frukt FROM food_categories WHERE slug='frukt';
  SELECT id INTO v_gronsaker FROM food_categories WHERE slug='gronsaker';
  SELECT id INTO v_agg FROM food_categories WHERE slug='agg';
  SELECT id INTO v_kyckling FROM food_categories WHERE slug='kycklingbrost';
  SELECT id INTO v_kalkon FROM food_categories WHERE slug='kalkonbrost';
  SELECT id INTO v_fisk FROM food_categories WHERE slug='fisk';
  SELECT id INTO v_baljvaxter FROM food_categories WHERE slug='baljvaxter';
  SELECT id INTO v_mejeri_latt FROM food_categories WHERE slug='mejeri_latt';
  SELECT id INTO v_kott FROM food_categories WHERE slug='kott';
  SELECT id INTO v_flask FROM food_categories WHERE slug='flask';
  SELECT id INTO v_mejeri FROM food_categories WHERE slug='mejeri';
  SELECT id INTO v_spannmal FROM food_categories WHERE slug='spannmal';
  SELECT id INTO v_brod FROM food_categories WHERE slug='brod';
  SELECT id INTO v_pasta_ris FROM food_categories WHERE slug='pasta_ris';
  SELECT id INTO v_potatis FROM food_categories WHERE slug='potatis';
  SELECT id INTO v_sotsaker FROM food_categories WHERE slug='sotsaker';
  SELECT id INTO v_snacks FROM food_categories WHERE slug='snacks';
  SELECT id INTO v_drycker FROM food_categories WHERE slug='drycker';
  SELECT id INTO v_fett FROM food_categories WHERE slug='fett_olja';
  SELECT id INTO v_sas FROM food_categories WHERE slug='sas_dressing';
  SELECT id INTO v_fardigmat FROM food_categories WHERE slug='fardigmat';
  SELECT id INTO v_notter FROM food_categories WHERE slug='notter_fron';
  SELECT id INTO v_bakning FROM food_categories WHERE slug='bakning';

  -- FRUIT (zero-point)
  PERFORM insert_food('Äpple', NULL, v_frukt, v_viktio, 52, 0.3, 14, 10, 0.2, 0, 2.4, 1, true);
  PERFORM insert_food('Banan', NULL, v_frukt, v_viktio, 89, 1.1, 23, 12, 0.3, 0.1, 2.6, 1, true);
  PERFORM insert_food('Päron', NULL, v_frukt, v_viktio, 57, 0.4, 15, 10, 0.1, 0, 3.1, 1, true);
  PERFORM insert_food('Apelsin', NULL, v_frukt, v_viktio, 47, 0.9, 12, 9, 0.1, 0, 2.4, 0, true);
  PERFORM insert_food('Jordgubbar', NULL, v_frukt, v_viktio, 32, 0.7, 8, 5, 0.3, 0, 2, 1, true);
  PERFORM insert_food('Blåbär', NULL, v_frukt, v_viktio, 57, 0.7, 14, 10, 0.3, 0, 2.4, 0, true);
  PERFORM insert_food('Hallon', NULL, v_frukt, v_viktio, 53, 1.2, 12, 4, 0.7, 0, 6.5, 1, true);
  PERFORM insert_food('Vindruvor', NULL, v_frukt, v_viktio, 69, 0.7, 18, 16, 0.2, 0, 0.9, 2, true);
  PERFORM insert_food('Kiwi', NULL, v_frukt, v_viktio, 61, 1.1, 15, 9, 0.5, 0, 3, 3, true);
  PERFORM insert_food('Grapefrukt', NULL, v_frukt, v_viktio, 42, 0.8, 11, 7, 0.1, 0, 1.6, 0, true);

  -- VEGETABLES (zero-point)
  PERFORM insert_food('Broccoli', NULL, v_gronsaker, v_viktio, 34, 2.8, 7, 1.5, 0.4, 0, 2.6, 33, true);
  PERFORM insert_food('Gul lök', NULL, v_gronsaker, v_viktio, 40, 1.1, 9, 4.2, 0.1, 0, 1.7, 4, true);
  PERFORM insert_food('Vitlök', NULL, v_gronsaker, v_viktio, 149, 6.4, 33, 1, 0.5, 0.1, 2.1, 17, true);
  PERFORM insert_food('Morot', NULL, v_gronsaker, v_viktio, 41, 0.9, 10, 5, 0.2, 0, 2.8, 69, true);
  PERFORM insert_food('Paprika röd', NULL, v_gronsaker, v_viktio, 31, 1, 6, 4.2, 0.3, 0, 2.1, 4, true);
  PERFORM insert_food('Sallad isberg', NULL, v_gronsaker, v_viktio, 14, 1.4, 3, 2, 0.1, 0, 0.7, 10, true);
  PERFORM insert_food('Gurka', NULL, v_gronsaker, v_viktio, 15, 0.7, 4, 1.7, 0.1, 0, 0.5, 2, true);
  PERFORM insert_food('Tomat', NULL, v_gronsaker, v_viktio, 18, 0.9, 3.9, 2.6, 0.2, 0, 1.2, 5, true);
  PERFORM insert_food('Krossade tomater', NULL, v_gronsaker, v_viktio, 24, 1.2, 4.3, 3, 0.1, 0, 1.2, 10, true);
  PERFORM insert_food('Spenat', NULL, v_gronsaker, v_viktio, 23, 2.9, 3.6, 0.4, 0.4, 0, 2.2, 79, true);
  PERFORM insert_food('Blomkål', NULL, v_gronsaker, v_viktio, 25, 1.9, 5, 2, 0.3, 0, 2, 30, true);
  PERFORM insert_food('Zucchini', NULL, v_gronsaker, v_viktio, 17, 1.2, 3.1, 2.5, 0.3, 0, 1, 8, true);
  PERFORM insert_food('Sötpotatis', NULL, v_gronsaker, v_viktio, 86, 1.6, 20, 4.2, 0.1, 0, 3, 30, false);
  PERFORM insert_food('Avokado', NULL, v_gronsaker, v_viktio, 160, 2, 9, 0.7, 15, 2.1, 7, 7, false);

  -- EGGS (zero-point)
  PERFORM insert_food('Ägg', NULL, v_agg, v_viktio, 143, 13, 1.1, 1.1, 9.5, 3.1, 0, 142, true);
  PERFORM insert_food('Äggvita', NULL, v_agg, v_viktio, 52, 11, 0.7, 0.7, 0.2, 0, 0, 166, true);

  -- CHICKEN BREAST (zero-point)
  PERFORM insert_food('Kycklingfilé', NULL, v_kyckling, v_viktio, 165, 31, 0, 0, 3.6, 1, 0, 74, true);
  PERFORM insert_food('Kycklingbröst utan skinn', NULL, v_kyckling, v_viktio, 165, 31, 0, 0, 3.6, 1, 0, 74, true);

  -- TURKEY BREAST (zero-point)
  PERFORM insert_food('Kalkonbröst', NULL, v_kalkon, v_viktio, 135, 30, 0, 0, 1, 0.3, 0, 54, true);

  -- FISH (zero-point)
  PERFORM insert_food('Laxfilé', NULL, v_fisk, v_viktio, 208, 20, 0, 0, 13, 3, 0, 59, true);
  PERFORM insert_food('Torskfilé', NULL, v_fisk, v_viktio, 82, 18, 0, 0, 0.7, 0.1, 0, 54, true);
  PERFORM insert_food('Laxröra', NULL, v_fisk, v_viktio, 156, 14, 4, 3, 9, 2, 0, 60, false);
  PERFORM insert_food('Tonfisk i vatten', NULL, v_fisk, v_viktio, 116, 26, 0, 0, 1, 0.3, 0, 37, true);
  PERFORM insert_food('Räkor', NULL, v_fisk, v_viktio, 99, 24, 0.2, 0.2, 0.3, 0.1, 0, 111, true);

  -- LEGUMES (zero-point)
  PERFORM insert_food('Svarta bönor kokta', NULL, v_baljvaxter, v_viktio, 91, 9, 17, 0.3, 0.2, 0, 6, 1, true);
  PERFORM insert_food('Kikärtor kokta', NULL, v_baljvaxter, v_viktio, 119, 8, 18, 0.3, 2, 0.2, 8, 7, true);
  PERFORM insert_food('Röda linser kokta', NULL, v_baljvaxter, v_viktio, 116, 9, 20, 1.5, 0.4, 0, 8, 2, true);
  PERFORM insert_food('Bruna bönor kokta', NULL, v_baljvaxter, v_viktio, 122, 7.5, 22, 0.3, 0.5, 0.1, 6, 1, true);

  -- LOW-FAT DAIRY (zero-point)
  PERFORM insert_food('Keso 1,5%', 'Arla', v_mejeri_latt, v_viktio, 92, 12, 3.5, 3.5, 1.5, 1, 0, 350, true);
  PERFORM insert_food('Lättkvarg 0,2%', 'Arla', v_mejeri_latt, v_viktio, 45, 10, 3.5, 3.5, 0.2, 0.1, 0, 50, true);
  PERFORM insert_food('Grekisk yoghurt 0%', 'Arla', v_mejeri_latt, v_viktio, 56, 10, 3.6, 3.6, 0.2, 0.1, 0, 36, true);
  PERFORM insert_food('Yoghurt lätt 0,5%', 'Arla', v_mejeri_latt, v_viktio, 45, 3.5, 5, 5, 0.5, 0.3, 0, 47, true);

  -- MEAT
  PERFORM insert_food('Nötfärs 5%', NULL, v_kott, v_viktio, 125, 20, 0, 0, 5, 2, 0, 60, false);
  PERFORM insert_food('Nötfärs 10%', NULL, v_kott, v_viktio, 176, 18, 0, 0, 10, 4, 0, 65, false);
  PERFORM insert_food('Fläskfärs', NULL, v_flask, v_viktio, 263, 14, 0, 0, 21, 8, 0, 62, false);
  PERFORM insert_food('Bacon', NULL, v_flask, v_viktio, 541, 37, 1.4, 0.6, 42, 14, 0, 1715, false);
  PERFORM insert_food('Skinka kokt', NULL, v_kott, v_viktio, 145, 21, 0.5, 0.5, 6, 2, 0, 1100, false);
  PERFORM insert_food('Wienerkorv', 'SP Chark', v_kott, v_viktio, 262, 12, 6, 0.5, 19, 8, 0, 800, false);

  -- DAIRY
  PERFORM insert_food('Crème fraîche 34%', 'Arla', v_mejeri, v_viktio, 340, 3, 4, 3, 34, 22, 0, 40, false);
  PERFORM insert_food('Crème fraîche 15%', 'Arla', v_mejeri, v_viktio, 165, 2.5, 4, 3, 15, 10, 0, 40, false);
  PERFORM insert_food('Lätt crème fraîche 5%', 'Arla', v_mejeri, v_viktio, 63, 2.5, 4, 3, 5, 3, 0, 40, false);
  PERFORM insert_food('Mellanmjölk 1,5%', 'Arla', v_mejeri, v_viktio, 45, 3.5, 5, 5, 1.5, 1, 0, 44, false);
  PERFORM insert_food('Högre mjölk 3%', 'Arla', v_mejeri, v_viktio, 61, 3.4, 4.8, 4.8, 3, 1.9, 0, 43, false);
  PERFORM insert_food('Ost 17% hushållsost', 'Arla', v_mejeri, v_viktio, 311, 25, 1.4, 0.5, 24, 15, 0, 700, false);
  PERFORM insert_food('Parmesan riven', 'Arla', v_mejeri, v_viktio, 392, 35, 4, 4, 26, 17, 0, 1600, false);
  PERFORM insert_food('Smör', 'Arla', v_mejeri, v_viktio, 717, 0.9, 0.1, 0.1, 81, 52, 0, 11, false);
  PERFORM insert_food('Margarin lätt', 'Bregott', v_mejeri, v_viktio, 320, 0.5, 0.5, 0.5, 35, 16, 0, 300, false);

  -- GRAINS / BREAD / PASTA
  PERFORM insert_food('Havregryn', 'AXA', v_spannmal, v_viktio, 379, 13, 67, 1, 7, 1.2, 10, 2, false);
  PERFORM insert_food('Knäckebröd', 'Wasabröd', v_brod, v_viktio, 357, 9, 70, 1.5, 2.5, 0.4, 8, 450, false);
  PERFORM insert_food('Fullkornsbröd', 'Pågen', v_brod, v_viktio, 247, 9, 42, 4, 3.5, 0.7, 6, 400, false);
  PERFORM insert_food('Pasta torkad', 'Barilla', v_pasta_ris, v_viktio, 363, 12, 73, 3, 1.5, 0.3, 3, 6, false);
  PERFORM insert_food('Basmatiris kokt', 'Uncle Bens', v_pasta_ris, v_viktio, 130, 2.7, 28, 0.1, 0.3, 0, 0.4, 1, false);
  PERFORM insert_food('Quinoa kokt', NULL, v_pasta_ris, v_viktio, 120, 4.4, 21, 0.9, 1.9, 0.2, 2.8, 7, false);
  PERFORM insert_food('Bulgur kokt', 'AXA', v_pasta_ris, v_viktio, 83, 3.1, 19, 0.1, 0.2, 0, 4, 5, false);
  PERFORM insert_food('Potatis kokt', NULL, v_potatis, v_viktio, 87, 2, 20, 0.8, 0.1, 0, 2.2, 5, false);

  -- SWEETS / SNACKS
  PERFORM insert_food('Mörk choklad 70%', 'Marabou', v_sotsaker, v_viktio, 598, 7.8, 46, 30, 43, 24, 11, 20, false);
  PERFORM insert_food('Lösgodis blandat', NULL, v_sotsaker, v_viktio, 350, 5, 80, 50, 1, 0.5, 0, 50, false);
  PERFORM insert_food('Potatischips', 'Estrella', v_snacks, v_viktio, 536, 7, 53, 0.5, 34, 4, 5, 500, false);

  -- BEVERAGES
  PERFORM insert_food('Kaffe svart', NULL, v_drycker, v_viktio, 1, 0.1, 0, 0, 0, 0, 0, 2, false);
  PERFORM insert_food('Mjölk till kaffe', NULL, v_drycker, v_viktio, 45, 3.5, 5, 5, 1.5, 1, 0, 44, false);
  PERFORM insert_food('Apelsinjuice', 'Troc', v_drycker, v_viktio, 45, 0.7, 10, 8, 0.2, 0, 0.2, 1, false);
  PERFORM insert_food('Läsk Cola', 'Coca-Cola', v_drycker, v_viktio, 42, 0, 11, 11, 0, 0, 0, 4, false);
  PERFORM insert_food('Öl 5%', 'Spendrups', v_drycker, v_viktio, 43, 0.5, 3.6, 0, 0, 0, 0, 4, false);
  PERFORM insert_food('Rött vin', NULL, v_drycker, v_viktio, 85, 0.1, 2.6, 0.6, 0, 0, 0, 4, false);

  -- FATS / OILS
  PERFORM insert_food('Olivolja', 'Zeta', v_fett, v_viktio, 884, 0, 0, 0, 100, 14, 0, 2, false);
  PERFORM insert_food('Smör matolja', 'Tropic', v_fett, v_viktio, 900, 0, 0, 0, 100, 16, 0, 0, false);
  PERFORM insert_food('Majonnäs', 'Heinz', v_sas, v_viktio, 680, 1, 1, 0.5, 75, 11, 0, 600, false);
  PERFORM insert_food('Bearnaisesås', 'Toro', v_sas, v_viktio, 320, 2, 4, 2, 33, 5, 0, 900, false);
  PERFORM insert_food('Tomatpuré', 'Mutti', v_sas, v_viktio, 38, 1.5, 8, 4, 0.2, 0, 1.5, 20, false);

  -- NUTS / SEEDS
  PERFORM insert_food('Valnötter', NULL, v_notter, v_viktio, 654, 15, 14, 2.6, 65, 6, 6.7, 2, false);
  PERFORM insert_food('Mandel', NULL, v_notter, v_viktio, 579, 21, 22, 4, 50, 3.8, 12, 1, false);
  PERFORM insert_food('Solroskärnor', NULL, v_notter, v_viktio, 584, 21, 20, 2.6, 51, 4.5, 9, 9, false);

  -- SWEDISH GROCERY PRODUCTS (with barcode)
  PERFORM insert_food_barcode('Arla Keso 1,5% 500g', 'Arla', v_mejeri_latt, v_off, '7310860030011', '500 g', 500, 'burk', 92, 12, 3.5, 3.5, 1.5, 1, 0, 350, true);
  PERFORM insert_food_barcode('Arla Lättkvarg 0,2% 250g', 'Arla', v_mejeri_latt, v_off, '7310860040028', '250 g', 250, 'burk', 45, 10, 3.5, 3.5, 0.2, 0.1, 0, 50, true);
  PERFORM insert_food_barcode('Arla Grekisk yoghurt 0% 500g', 'Arla', v_mejeri_latt, v_off, '7310860050035', '500 g', 500, 'burk', 56, 10, 3.6, 3.6, 0.2, 0.1, 0, 36, true);
  PERFORM insert_food_barcode('Arla Crème fraîche 34% 250g', 'Arla', v_mejeri, v_off, '7310860060042', '250 g', 250, 'burk', 340, 3, 4, 3, 34, 22, 0, 40, false);
  PERFORM insert_food_barcode('Arla Crème fraîche 15% 250g', 'Arla', v_mejeri, v_off, '7310860070059', '250 g', 250, 'burk', 165, 2.5, 4, 3, 15, 10, 0, 40, false);
  PERFORM insert_food_barcode('Arla Lätt crème fraîche 5% 200g', 'Arla', v_mejeri, v_off, '7310860080066', '200 g', 200, 'burk', 63, 2.5, 4, 3, 5, 3, 0, 40, false);
  PERFORM insert_food_barcode('Arla Mellanmjölk 1,5% 1l', 'Arla', v_mejeri, v_off, '7310860090073', '1 l', 1000, 'förpackning', 45, 3.5, 5, 5, 1.5, 1, 0, 44, false);
  PERFORM insert_food_barcode('Barilla Spaghetti 500g', 'Barilla', v_pasta_ris, v_off, '8001205005703', '500 g', 500, 'paket', 363, 12, 73, 3, 1.5, 0.3, 3, 6, false);
  PERFORM insert_food_barcode('Wasabröd Knäckebröd Original 290g', 'Wasabröd', v_brod, v_off, '7310040010018', '290 g', 290, 'paket', 357, 9, 70, 1.5, 2.5, 0.4, 8, 450, false);
  PERFORM insert_food_barcode('AXA Havregryn 1kg', 'AXA', v_spannmal, v_off, '7310520010025', '1 kg', 1000, 'paket', 379, 13, 67, 1, 7, 1.2, 10, 2, false);
  PERFORM insert_food_barcode('Marabou Mörk choklad 70% 200g', 'Marabou', v_sotsaker, v_off, '7613030010032', '200 g', 200, 'kaka', 598, 7.8, 46, 30, 43, 24, 11, 20, false);
  PERFORM insert_food_barcode('Estrella Potatischips 200g', 'Estrella', v_snacks, v_off, '7310180010049', '200 g', 200, 'påse', 536, 7, 53, 0.5, 34, 4, 5, 500, false);
  PERFORM insert_food_barcode('Coca-Cola 1,5l', 'Coca-Cola', v_drycker, v_off, '7310860100080', '1,5 l', 1500, 'flaska', 42, 0, 11, 11, 0, 0, 0, 4, false);
  PERFORM insert_food_barcode('SP Chark Wienerkorv 880g', 'SP Chark', v_kott, v_off, '7311040010056', '880 g', 880, 'förpackning', 262, 12, 6, 0.5, 19, 8, 0, 800, false);
  PERFORM insert_food_barcode('ICA Nötfärs 5% 500g', 'ICA', v_kott, v_off, '7310900010063', '500 g', 500, 'förpackning', 125, 20, 0, 0, 5, 2, 0, 60, false);
  PERFORM insert_food_barcode('Coop Kycklingfilé 1kg', 'Coop', v_kyckling, v_off, '7310800010070', '1 kg', 1000, 'förpackning', 165, 31, 0, 0, 3.6, 1, 0, 74, true);
  PERFORM insert_food_barcode('City Gross Laxfilé 500g', 'City Gross', v_fisk, v_off, '7310700010087', '500 g', 500, 'förpackning', 208, 20, 0, 0, 13, 3, 0, 59, true);
  PERFORM insert_food_barcode('Mutti Krossade tomater 400g', 'Mutti', v_gronsaker, v_off, '8000060010094', '400 g', 400, 'burk', 24, 1.2, 4.3, 3, 0.1, 0, 1.2, 10, true);
  PERFORM insert_food_barcode('Zeta Olivolja 500ml', 'Zeta', v_fett, v_off, '8000010010100', '500 ml', 500, 'flaska', 884, 0, 0, 0, 100, 14, 0, 2, false);
  PERFORM insert_food_barcode('Toro Bearnaisesås pulver', 'Toro', v_sas, v_off, '7310400010117', '100 g', 100, 'paket', 320, 2, 4, 2, 33, 5, 0, 900, false);

  -- BAKING
  PERFORM insert_food('Vetemjöl', 'Kungsörnen', v_bakning, v_viktio, 340, 10, 72, 1, 1.5, 0.3, 3, 2, false);
  PERFORM insert_food('Ströbröd', 'Kungsörnen', v_bakning, v_viktio, 350, 10, 73, 1, 1.5, 0.3, 4, 2, false);
  PERFORM insert_food('Socker', 'Dan Sukker', v_bakning, v_viktio, 387, 0, 100, 100, 0, 0, 0, 0, false);
END $$;

-- Drop helper functions after seeding
DROP FUNCTION IF EXISTS insert_food(text, text, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, boolean);
DROP FUNCTION IF EXISTS insert_food_barcode(text, text, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, boolean);
