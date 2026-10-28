# Viktio

Viktnedgång, nutrition och träning – en webbapp och en iOS-/Android-app som delar samma kodbas.

- **Frontend:** Vite + React + TypeScript, Tailwind, shadcn/ui, React Router
- **Backend:** Supabase (Postgres, Auth, Edge Functions)
- **Mobil:** Capacitor 7 (iOS via Swift Package Manager, Android via Gradle)

## Kom igång

```bash
npm install
cp .env.example .env   # fyll i VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

## Funktioner

- **Poäng:** personlig dagsbudget utifrån kaloribehov (`src/lib/health.ts`), veckopool måndag–söndag, poäng per livsmedel enligt `src/lib/points.ts`.
- **Aktivitetspoäng:** träning räknas om till kcal med MET × vikt × tid och ger halva matens poängtakt, max 12 poäng per dag (`src/lib/activity.ts`).
- **Apple Hälsa / Health Connect:** steg och vikt synkas vid appstart; steg över 6 000 per dag ger poäng (`src/lib/health-sync.ts`).
- **Träning:** program, pass med set/reps/vikt, vilotimer, viktförslag och personliga rekord (`src/lib/training.ts`).
- **Livsstil:** vatten, sömn, humör, stress, steg, vanor med streaks, kroppsmått och en livsstilspoäng 0–100 (`src/lib/lifestyle.ts`).
- **Påminnelser:** lokala notiser i apparna, inga push-nycklar behövs (`src/lib/reminders.ts`).
- **Integritet:** samtycke vid registrering, dataexport och radering av konto (`src/lib/privacy.ts`, funktionen `delete-account`).

## Tester

```bash
npm test
```

## Lokal utveckling med egen databas

Med Docker igång startar en lokal Supabase med alla migreringar:

```bash
npx supabase start
```

Peka sedan appen mot den med en `.env.development.local` (`VITE_SUPABASE_URL=http://127.0.0.1:54321` och anon-nyckeln som `supabase status` visar).

## Supabase

Databasschema och seed-data finns i `supabase/migrations`. API:t ligger som Edge Functions i `supabase/functions`:

| Funktion        | Vad den gör                                                          |
| --------------- | -------------------------------------------------------------------- |
| `food-search`   | Söker livsmedel i Open Food Facts på namn (`q`) eller streckkod (`barcode`) |
| `import-recipe` | Söker recept på Köket.se (`query`) eller importerar ett recept från en URL (`url`) och matchar ingredienserna |
| `match-recipes` | Matchar om ingredienser mot livsmedel (`recipe_id` eller `all`, valfritt `rematch`). Kräver service role-nyckeln |

### Egen server (vibo-server)

Viktio kör en egen självhostad Supabase-stack på `vibo-server` i `~/viktio/supabase` (Docker Compose-projekt `supabase-viktio`). Publik adress: `https://supabase.viktio.vibogruppen.se`.

| Del          | Port (endast 127.0.0.1) |
| ------------ | ----------------------- |
| API-gateway  | 38000                   |
| Postgres     | 35432 (session), 36543 (transaction) |

Hemligheter ligger i `~/viktio/supabase/.env` på servern. Nginx-konfigurationen finns i `~/viktio/nginx/`.

Webbappen körs på `https://viktio.vibogruppen.se` från containern `viktio-web` (`~/viktio/web`, port 25180). Driftsätt en ny version:

```bash
npm run build && rsync -a --delete dist/ vibo-server:viktio/web/dist/
```

Uppdatera Edge Functions:

```bash
tar cf - -C supabase/functions _shared food-search import-recipe | ssh vibo-server 'cd ~/viktio/supabase/volumes/functions && tar xf - && docker restart supabase-viktio-edge-functions'
```

### Livsmedel och receptpoäng

Livsmedelsverkets livsmedelsdatabas (~2 600 livsmedel) importeras med `scripts/livsmedelsverket.mjs`. Importen är en upsert och kan köras om när Livsmedelsverket uppdaterar sina data:

```bash
node scripts/livsmedelsverket.mjs fetch lmv.json
node scripts/livsmedelsverket.mjs sql lmv.json | ssh vibo-server 'docker exec -i supabase-viktio-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction'
```

Nollpoängsvaror sätts konservativt i skriptet (`categorize`): ren frukt, grönsaker, baljväxter, fisk, ägg, mager fågel och mager naturell yoghurt.

Importerade recept får sina ingredienser tolkade ("2 dl havregryn" → 70 g) och matchade mot livsmedel i `supabase/functions/_shared/ingredients.ts`, med fuzzy-sökning i databasfunktionen `match_food`. Poängen räknas av `food_points_100g`, som följer samma formel som `src/lib/points.ts`.

### Admin

Adminsidan (`/admin`) och ändringar av delad data (poängmotor, inställningar, livsmedel och recept som inte är ens egna) kräver att kontot finns i tabellen `app_admins`. Ge ett konto admin:

```bash
ssh vibo-server "docker exec supabase-viktio-db psql -U postgres -d postgres -c \"insert into app_admins (user_id) select id from auth.users where email = 'namn@example.se'\""
```

Kör en ny migrering:

```bash
ssh vibo-server 'docker exec -i supabase-viktio-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction' < supabase/migrations/<fil>.sql
```

## Mobilappar

```bash
npm run ios       # bygger webben, synkar och öppnar Xcode
npm run android   # bygger webben, synkar och öppnar Android Studio
```

Efter ändringar i webbkoden räcker `npm run cap:sync`. App-id: `se.vibogruppen.viktio`.

**Apple Hälsa:** HealthKit-rättigheten finns i `ios/App/App/App.entitlements`. Första gången du bygger till en riktig iPhone behöver du välja ditt team under *Signing & Capabilities* i Xcode, så att HealthKit läggs till i provisioneringsprofilen.

**Health Connect** kräver Android 8 eller senare (minSdk 26). På Android 13 och äldre måste användaren installera appen Health Connect från Play Butik.
