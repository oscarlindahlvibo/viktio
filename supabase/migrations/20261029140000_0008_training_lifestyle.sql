/*
# Viktio — Training, lifestyle and health sync

- Exercise library with instructions, level and where it can be done.
- Strength training: a session with logged sets (reps × weight) per exercise.
- Daily check-in: water, sleep, mood, stress and steps.
- Habits with daily completion logs (for streaks).
- One synced row per day and source in activity_log for Apple Health / Health Connect.
*/

-- ============================================================
-- EXERCISE LIBRARY
-- ============================================================

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions text[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS level text CHECK (level IN ('beginner','intermediate','advanced'));
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS location text CHECK (location IN ('home','gym','both','outdoors'));
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS met numeric;
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_slug ON exercises(slug);

DELETE FROM exercises
WHERE slug IS NULL
  AND id NOT IN (SELECT exercise_id FROM workout_sessions WHERE exercise_id IS NOT NULL);

INSERT INTO exercises (slug, name, category, muscle_group, equipment, location, level, met, description, instructions) VALUES
  ('knaboj', 'Knäböj', 'strength', 'Ben och säte', 'Inget', 'both', 'beginner', 5,
    'Grundövningen för ben och säte.',
    ARRAY['Stå axelbrett med tårna lätt utåt.', 'Skjut höften bakåt och böj knäna som om du sätter dig på en stol.', 'Håll bröstet uppe och knäna i linje med tårna.', 'Gå ner så långt du kan med rak rygg och pressa upp genom hälarna.']),
  ('utfall', 'Utfallssteg', 'strength', 'Ben och säte', 'Inget', 'both', 'beginner', 5,
    'Stärker ben, säte och balans.',
    ARRAY['Ta ett långt steg framåt.', 'Sänk bakre knät mot golvet tills båda knäna är i ca 90 grader.', 'Håll överkroppen upprätt.', 'Tryck ifrån med främre foten tillbaka till start och byt ben.']),
  ('hoftlyft', 'Höftlyft', 'strength', 'Säte och baksida lår', 'Inget', 'both', 'beginner', 4,
    'Aktiverar sätet och avlastar ländryggen.',
    ARRAY['Ligg på rygg med böjda knän och fötterna i golvet.', 'Spänn magen och pressa upp höften tills kroppen är rak från knä till axel.', 'Kläm ihop sätet i toppen en sekund.', 'Sänk kontrollerat.']),
  ('armhavningar', 'Armhävningar', 'strength', 'Bröst, axlar och triceps', 'Inget', 'both', 'intermediate', 5,
    'Klassisk överkroppsövning.',
    ARRAY['Händerna lite bredare än axlarna, kroppen rak som en planka.', 'Sänk bröstet mot golvet med armbågarna ca 45 grader från kroppen.', 'Pressa upp till raka armar utan att svanka.']),
  ('armhavningar-kna', 'Armhävningar på knä', 'strength', 'Bröst, axlar och triceps', 'Inget', 'both', 'beginner', 4,
    'Lättare variant av armhävningar.',
    ARRAY['Stå på knäna med händerna under axlarna.', 'Håll en rak linje från knä till huvud.', 'Sänk bröstet mot golvet och pressa upp.']),
  ('plankan', 'Plankan', 'core', 'Mage och bål', 'Inget', 'both', 'beginner', 3,
    'Statisk övning för hela bålen.',
    ARRAY['Vila på underarmarna med armbågarna under axlarna.', 'Sträck ut benen och lyft höften så kroppen blir rak.', 'Spänn mage och säte och andas lugnt.', 'Håll positionen utan att höften sjunker.']),
  ('sidoplanka', 'Sidoplanka', 'core', 'Sneda magmuskler', 'Inget', 'both', 'intermediate', 3,
    'Stärker bålens sidor.',
    ARRAY['Ligg på sidan med armbågen under axeln.', 'Lyft höften så kroppen blir rak.', 'Håll och byt sida.']),
  ('dead-bug', 'Dead bug', 'core', 'Mage', 'Inget', 'both', 'beginner', 3,
    'Skonsam magövning med fokus på kontroll.',
    ARRAY['Ligg på rygg med armarna mot taket och knäna i 90 grader.', 'Pressa ländryggen mot golvet.', 'Sträck ut motsatt arm och ben långsamt, utan att ryggen lyfter.', 'Tillbaka och byt sida.']),
  ('superman', 'Superman', 'strength', 'Ländrygg och säte', 'Inget', 'both', 'beginner', 3,
    'Stärker ryggens baksida.',
    ARRAY['Ligg på mage med armarna framåt.', 'Lyft armar, bröst och ben några centimeter från golvet.', 'Håll två sekunder och sänk kontrollerat.']),
  ('dips-stol', 'Dips mot stol', 'strength', 'Triceps', 'Stol eller bänk', 'both', 'beginner', 4,
    'Tränar baksidan av armarna.',
    ARRAY['Sätt händerna på stolskanten bakom dig.', 'Sänk kroppen genom att böja armbågarna rakt bakåt.', 'Pressa upp till nästan raka armar.']),
  ('tahavningar', 'Tåhävningar', 'strength', 'Vader', 'Inget', 'both', 'beginner', 3,
    'Stärker vaderna.',
    ARRAY['Stå på ett trappsteg med hälarna utanför kanten.', 'Res dig upp på tå så högt du kan.', 'Sänk hälarna långsamt under kanten.']),
  ('vaggsittning', 'Väggsittning', 'strength', 'Lår', 'Vägg', 'both', 'beginner', 4,
    'Statisk benövning.',
    ARRAY['Luta ryggen mot en vägg.', 'Glid ner tills knäna är i 90 grader.', 'Håll positionen med vikten på hälarna.']),
  ('bulgarisk-utfallsbojning', 'Bulgarisk utfallsböj', 'strength', 'Ben och säte', 'Bänk eller stol', 'both', 'intermediate', 5,
    'Enbensövning för starka ben.',
    ARRAY['Ställ bakre foten på en bänk bakom dig.', 'Sänk bakre knät mot golvet med upprätt överkropp.', 'Pressa upp genom främre hälen. Gör alla reps och byt ben.']),
  ('mountain-climbers', 'Mountain climbers', 'hiit', 'Helkropp', 'Inget', 'both', 'intermediate', 8,
    'Pulshöjande bålövning.',
    ARRAY['Starta i armhävningsposition.', 'Dra växelvis knäna mot bröstet i högt tempo.', 'Håll höften låg och bålen stabil.']),
  ('burpees', 'Burpees', 'hiit', 'Helkropp', 'Inget', 'both', 'intermediate', 8,
    'Effektiv helkroppsövning för kondition.',
    ARRAY['Gå ner på huk och sätt händerna i golvet.', 'Hoppa bak till armhävningsposition.', 'Hoppa fram med fötterna och hoppa upp med armarna upp.']),
  ('hampelmannen', 'Hampelmannen', 'hiit', 'Helkropp', 'Inget', 'both', 'beginner', 7,
    'Uppvärmning och kondition.',
    ARRAY['Stå med fötterna ihop och armarna längs sidan.', 'Hoppa isär med benen och för armarna över huvudet.', 'Hoppa tillbaka till start i jämnt tempo.']),
  ('knaboj-skivstang', 'Knäböj med skivstång', 'strength', 'Ben och säte', 'Skivstång', 'gym', 'intermediate', 6,
    'Basövning för ben och säte med tung belastning.',
    ARRAY['Lägg stången på övre delen av ryggen, inte på nacken.', 'Stå axelbrett, andas in och spänn magen.', 'Böj i höft och knä till minst parallellt, med knäna över tårna.', 'Pressa upp med rak rygg.']),
  ('marklyft', 'Marklyft', 'strength', 'Rygg, säte och ben', 'Skivstång', 'gym', 'intermediate', 6,
    'Helkroppsövning för baksidan.',
    ARRAY['Stå med mittfoten under stången.', 'Greppa stången strax utanför benen, platt rygg.', 'Spänn magen och lyft genom att pressa golvet ifrån dig.', 'Res dig helt och sänk kontrollerat med stången nära benen.']),
  ('rumansk-marklyft', 'Rumänsk marklyft', 'strength', 'Baksida lår och säte', 'Skivstång eller hantlar', 'both', 'intermediate', 5,
    'Fokus på baksida lår.',
    ARRAY['Stå med lätt böjda knän och vikten framför låren.', 'Skjut höften bakåt med rak rygg tills du känner stretch i baksida lår.', 'Res dig genom att föra höften framåt.']),
  ('bankpress', 'Bänkpress', 'strength', 'Bröst, axlar och triceps', 'Skivstång', 'gym', 'intermediate', 5,
    'Basövning för överkroppen.',
    ARRAY['Ligg på bänken med ögonen under stången och fötterna i golvet.', 'Greppa lite bredare än axlarna och dra ihop skulderbladen.', 'Sänk stången kontrollerat till nedre delen av bröstet.', 'Pressa upp till raka armar.']),
  ('hantelpress', 'Hantelpress', 'strength', 'Bröst, axlar och triceps', 'Hantlar', 'both', 'beginner', 5,
    'Bröstpress med hantlar.',
    ARRAY['Ligg på bänk eller golv med en hantel i varje hand vid bröstet.', 'Pressa upp hantlarna tills armarna är raka.', 'Sänk kontrollerat.']),
  ('axelpress', 'Axelpress med hantlar', 'strength', 'Axlar och triceps', 'Hantlar', 'both', 'beginner', 5,
    'Stärker axlarna.',
    ARRAY['Sitt eller stå med hantlarna i axelhöjd.', 'Pressa upp tills armarna är raka över huvudet.', 'Sänk kontrollerat utan att svanka.']),
  ('sidolyft', 'Sidolyft', 'strength', 'Axlar', 'Hantlar', 'both', 'beginner', 4,
    'Isolerar axlarnas sida.',
    ARRAY['Stå med en lätt hantel i varje hand.', 'Lyft armarna ut åt sidan till axelhöjd med lätt böjda armbågar.', 'Sänk långsamt.']),
  ('hantelrodd', 'Hantelrodd', 'strength', 'Rygg och biceps', 'Hantel och bänk', 'both', 'beginner', 5,
    'Stärker övre ryggen.',
    ARRAY['Stöd ena knät och handen mot en bänk.', 'Dra hanteln mot höften med armbågen nära kroppen.', 'Sänk kontrollerat och byt sida efter alla reps.']),
  ('latsdrag', 'Latsdrag', 'strength', 'Rygg och biceps', 'Kabelmaskin', 'gym', 'beginner', 5,
    'Bygger en bred och stark rygg.',
    ARRAY['Greppa stången brett och sitt med låren under dynan.', 'Dra stången mot övre bröstet med skulderbladen nedåt.', 'Släpp upp kontrollerat till raka armar.']),
  ('sittande-rodd', 'Sittande rodd', 'strength', 'Rygg', 'Kabelmaskin', 'gym', 'beginner', 5,
    'Stärker mellersta ryggen.',
    ARRAY['Sitt med lätt böjda knän och rak rygg.', 'Dra handtaget mot magen och kläm ihop skulderbladen.', 'Sträck armarna kontrollerat.']),
  ('benpress', 'Benpress', 'strength', 'Ben och säte', 'Maskin', 'gym', 'beginner', 5,
    'Tung benövning med stöd för ryggen.',
    ARRAY['Sätt fötterna axelbrett mitt på plattan.', 'Sänk plattan tills knäna är i ca 90 grader.', 'Pressa upp utan att låsa knäna helt.']),
  ('larcurl', 'Lårcurl', 'strength', 'Baksida lår', 'Maskin', 'gym', 'beginner', 4,
    'Isolerar baksida lår.',
    ARRAY['Ställ in maskinen så knäna är i linje med leden.', 'Böj benen så långt det går.', 'Sträck ut långsamt.']),
  ('hip-thrust', 'Hip thrust', 'strength', 'Säte', 'Skivstång och bänk', 'gym', 'intermediate', 5,
    'Den mest effektiva sätesövningen.',
    ARRAY['Luta övre ryggen mot en bänk med stången över höften.', 'Pressa upp höften tills kroppen är rak från knä till axel.', 'Kläm sätet i toppen och sänk kontrollerat.']),
  ('goblet-squat', 'Goblet squat', 'strength', 'Ben och säte', 'Hantel eller kettlebell', 'both', 'beginner', 5,
    'Knäböj med vikt framför bröstet.',
    ARRAY['Håll en hantel eller kettlebell mot bröstet.', 'Gör en djup knäböj med upprätt överkropp.', 'Pressa upp genom hälarna.']),
  ('kettlebell-swing', 'Kettlebell swing', 'hiit', 'Säte och helkropp', 'Kettlebell', 'both', 'intermediate', 8,
    'Explosiv höftövning som höjer pulsen.',
    ARRAY['Stå brett med kettlebellen framför dig.', 'Svinga den mellan benen med rak rygg.', 'Skjut fram höften explosivt så klockan flyger upp till brösthöjd.', 'Låt den falla tillbaka och upprepa.']),
  ('bicepscurl', 'Bicepscurl', 'strength', 'Biceps', 'Hantlar', 'both', 'beginner', 4,
    'Isolerar biceps.',
    ARRAY['Stå med hantlarna längs sidan, handflatorna framåt.', 'Böj armbågarna och lyft hantlarna mot axlarna.', 'Sänk långsamt utan att svinga.']),
  ('triceps-pushdown', 'Triceps pushdown', 'strength', 'Triceps', 'Kabelmaskin', 'gym', 'beginner', 4,
    'Isolerar triceps.',
    ARRAY['Greppa repet eller stången i kabelmaskinen.', 'Håll armbågarna mot sidan och pressa ner till raka armar.', 'Släpp upp kontrollerat.']),
  ('chins', 'Chins', 'strength', 'Rygg och biceps', 'Räcke', 'both', 'advanced', 6,
    'Kroppsviktsövning för ryggen.',
    ARRAY['Häng i räcket med axelbrett grepp.', 'Dra dig upp tills hakan är över räcket.', 'Sänk kontrollerat till raka armar.']),
  ('roddmaskin', 'Roddmaskin', 'cardio', 'Helkropp', 'Roddmaskin', 'gym', 'beginner', 7,
    'Skonsam kondition för hela kroppen.',
    ARRAY['Tryck ifrån med benen först.', 'Luta dig lätt bakåt och dra handtaget mot nedre bröstet.', 'Gå tillbaka i omvänd ordning: armar, kropp, ben.']),
  ('crosstrainer', 'Crosstrainer', 'cardio', 'Helkropp', 'Crosstrainer', 'gym', 'beginner', 6,
    'Ledvänlig konditionsträning.',
    ARRAY['Håll en jämn takt där du kan prata men blir andfådd.', 'Använd både armar och ben.']),
  ('hopprep', 'Hopprep', 'hiit', 'Helkropp och vader', 'Hopprep', 'both', 'intermediate', 10,
    'Intensiv kondition på liten yta.',
    ARRAY['Hoppa lätt på framfoten med små hopp.', 'Snurra repet med handlederna, inte armarna.']),
  ('katt-ko', 'Katt och ko', 'mobility', 'Rygg', 'Inget', 'both', 'beginner', 2.5,
    'Rörlighet för ryggraden.',
    ARRAY['Stå på alla fyra.', 'Runda ryggen uppåt och för hakan mot bröstet.', 'Svanka sedan lugnt och lyft blicken.', 'Följ andningen.']),
  ('hoftbojarstretch', 'Höftböjarstretch', 'mobility', 'Höft', 'Inget', 'both', 'beginner', 2.5,
    'Motverkar stelhet från stillasittande.',
    ARRAY['Stå på ena knät med andra foten framför dig.', 'Skjut höften framåt tills du känner stretch framtill i höften.', 'Håll 30–45 sekunder per sida.']),
  ('barnets-position', 'Barnets position', 'mobility', 'Rygg och höft', 'Inget', 'both', 'beginner', 2.5,
    'Avslappnande stretch.',
    ARRAY['Sitt på hälarna med knäna isär.', 'Fäll fram överkroppen och sträck armarna framåt.', 'Andas djupt och slappna av.']),
  ('promenad', 'Promenad', 'cardio', 'Helkropp', 'Inget', 'outdoors', 'beginner', 3.5,
    'Den enklaste träningen – varje steg räknas.',
    ARRAY['Gå i en takt där du blir lite varm men kan prata.']),
  ('lopning', 'Löpning', 'cardio', 'Helkropp', 'Inget', 'outdoors', 'intermediate', 9,
    'Effektiv konditionsträning.',
    ARRAY['Börja lugnt och värm upp 5 minuter.', 'Håll en takt du orkar hela passet.', 'Varva gärna med gång om du är nybörjare.'])
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, muscle_group = EXCLUDED.muscle_group,
  equipment = EXCLUDED.equipment, location = EXCLUDED.location, level = EXCLUDED.level,
  met = EXCLUDED.met, description = EXCLUDED.description, instructions = EXCLUDED.instructions;

-- ============================================================
-- STRENGTH TRAINING SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  program_key text,
  program_day int,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_min int,
  activity_log_id uuid REFERENCES activity_log(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_slug text NOT NULL,
  exercise_name text NOT NULL,
  set_number int NOT NULL,
  reps int,
  weight_kg numeric,
  duration_sec int,
  completed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_user ON training_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_sets_user_exercise ON training_sets(user_id, exercise_slug);

-- The user's chosen training program.
CREATE TABLE IF NOT EXISTS training_programs (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  program_key text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  next_day int NOT NULL DEFAULT 0
);

-- ============================================================
-- LIFESTYLE
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  water_ml int NOT NULL DEFAULT 0,
  sleep_hours numeric,
  sleep_quality int CHECK (sleep_quality BETWEEN 1 AND 5),
  mood int CHECK (mood BETWEEN 1 AND 5),
  stress int CHECK (stress BETWEEN 1 AND 5),
  steps int,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (habit_id, date)
);

-- ============================================================
-- HEALTH SYNC
-- ============================================================

-- Synced data (e.g. steps from Apple Health) is one row per user, day and source.
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_log_synced
  ON activity_log (user_id, logged_at, source) WHERE source LIKE 'health%';

ALTER TABLE weight_entries ADD COLUMN IF NOT EXISTS source text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_weight_entries_synced
  ON weight_entries (user_id, logged_at) WHERE source = 'health';

-- ============================================================
-- ROW LEVEL SECURITY: every table is private to its owner
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['training_sessions','training_sets','training_programs','daily_checkins','habits','habit_logs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "own_rows" ON %I', t);
    EXECUTE format('CREATE POLICY "own_rows" ON %I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
  END LOOP;
END $$;
