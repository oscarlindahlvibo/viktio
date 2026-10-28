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

## Supabase

Databasschema och seed-data finns i `supabase/migrations`. API:t ligger som Edge Functions i `supabase/functions`:

| Funktion        | Vad den gör                                                          |
| --------------- | -------------------------------------------------------------------- |
| `food-search`   | Söker livsmedel i Open Food Facts på namn (`q`) eller streckkod (`barcode`) |
| `import-recipe` | Söker recept på Köket.se (`query`) eller importerar ett recept från en URL (`url`) |

### Egen server (vibo-server)

Viktio kör en egen självhostad Supabase-stack på `vibo-server` i `~/viktio/supabase` (Docker Compose-projekt `supabase-viktio`). Publik adress: `https://supabase.viktio.vibogruppen.se`.

| Del          | Port (endast 127.0.0.1) |
| ------------ | ----------------------- |
| API-gateway  | 38000                   |
| Postgres     | 35432 (session), 36543 (transaction) |

Hemligheter ligger i `~/viktio/supabase/.env` på servern. Nginx-konfigurationen finns i `~/viktio/nginx/`.

Uppdatera Edge Functions:

```bash
tar cf - -C supabase/functions _shared food-search import-recipe | ssh vibo-server 'cd ~/viktio/supabase/volumes/functions && tar xf - && docker restart supabase-viktio-edge-functions'
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
