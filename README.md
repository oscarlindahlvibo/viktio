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

Driftsätt mot ditt projekt:

```bash
npx supabase link --project-ref <ditt-projekt>
npx supabase db push
npx supabase functions deploy food-search
npx supabase functions deploy import-recipe
```

## Mobilappar

```bash
npm run ios       # bygger webben, synkar och öppnar Xcode
npm run android   # bygger webben, synkar och öppnar Android Studio
```

Efter ändringar i webbkoden räcker `npm run cap:sync`. App-id: `se.vibogruppen.viktio`.
