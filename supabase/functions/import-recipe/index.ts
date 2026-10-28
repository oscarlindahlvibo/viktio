import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json, readParams } from '../_shared/http.ts';
import { matchRecipe } from '../_shared/ingredients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await readParams(req);
    const url = body.url;
    const searchQuery = body.query;
    const authHeader = req.headers.get('Authorization') ?? '';

    if (searchQuery && !url) {
      return await searchRecipeByName(searchQuery);
    }

    if (!url) {
      return json({ error: 'URL eller sökord krävs' }, { status: 400 });
    }

    return await importRecipeFromUrl(url, authHeader);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Okänt fel' }, { status: 500 });
  }
});
async function searchRecipeByName(query: string) {
  const results = await searchRecipesOnline(query);
  return json({ searchResults: results });
}

async function searchRecipesOnline(query: string) {
  const allResults: { name: string; url: string; source: string; image?: string; cooking_time?: string }[] = [];

  try {
    const response = await fetch(
      `https://koket.se/api/search?query=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      },
    );

    if (response.ok) {
      const data = await response.json();
      const items: Array<{
        name?: string;
        url?: string;
        type?: string;
        image?: { url?: string };
        cooking_time?: string;
      }> = data.items || [];

      for (const item of items) {
        if (item.name && item.url) {
          allResults.push({
            name: item.name,
            url: `https://koket.se${item.url}`,
            source: 'Köket.se',
            image: item.image?.url ? `https://koket.se/images/${item.image.url}` : undefined,
            cooking_time: item.cooking_time,
          });
        }
      }
    }
  } catch {
    // API failed
  }

  return allResults.slice(0, 20);
}

async function importRecipeFromUrl(url: string, authHeader: string) {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return json({ error: 'Inte inloggad' }, { status: 401 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return json({ error: 'Ogiltig URL' }, { status: 400 });
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return json({ error: 'Ogiltig URL' }, { status: 400 });
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    return json({ error: 'Kunde inte hämta sidan' }, { status: 502 });
  }

  const html = await response.text();

  // Extract JSON-LD
  const jsonLdMatches = html.match(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );
  let recipeData: {
    name?: string;
    image?: string | string[];
    recipeYield?: string | number;
    recipeIngredient?: string[];
    recipeInstructions?: string | Array<{ text?: string }>;
    nutrition?: {
      calories?: string;
      proteinContent?: string;
      carbohydrateContent?: string;
      fatContent?: string;
      fiberContent?: string;
    };
    author?: { name?: string } | string;
    prepTime?: string;
    cookTime?: string;
  } | null = null;

  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      try {
        const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const parsed = JSON.parse(jsonStr);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (
            item['@type'] === 'Recipe' ||
            (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
          ) {
            recipeData = item;
            break;
          }
          if (item['@graph']) {
            const graphItems = Array.isArray(item['@graph'])
              ? item['@graph']
              : [item['@graph']];
            for (const g of graphItems) {
              if (g['@type'] === 'Recipe') {
                recipeData = g;
                break;
              }
            }
          }
        }
        if (recipeData) break;
      } catch {
        // Invalid JSON, try next
      }
    }
  }

  if (!recipeData) {
    return json(
      { error: 'Hittade inget Schema.org-recept på sidan' },
      { status: 422 },
    );
  }

  const name = recipeData.name || 'Importerat recept';
  const image = Array.isArray(recipeData.image)
    ? recipeData.image[0]
    : recipeData.image;
  const imageUrl =
    typeof image === 'string'
      ? image
      : (image as { url?: string } | undefined)?.url || null;
  const servings =
    typeof recipeData.recipeYield === 'string'
      ? parseInt(recipeData.recipeYield.match(/\d+/)?.[0] || '4')
      : recipeData.recipeYield || 4;
  const ingredients = recipeData.recipeIngredient || [];
  const instructions = Array.isArray(recipeData.recipeInstructions)
    ? recipeData.recipeInstructions.map((i) => i.text || '').join('\n')
    : typeof recipeData.recipeInstructions === 'string'
      ? recipeData.recipeInstructions
      : '';
  const author =
    typeof recipeData.author === 'string'
      ? recipeData.author
      : recipeData.author?.name || null;
  const prepTime = parseISODuration(recipeData.prepTime);
  const cookTime = parseISODuration(recipeData.cookTime);

  let sourceName = parsedUrl.hostname.replace('www.', '');
  if (sourceName.includes('ica')) sourceName = 'ICA';
  else if (sourceName.includes('coop')) sourceName = 'Coop';
  else if (sourceName.includes('citygross')) sourceName = 'City Gross';

  const { data: source } = await supabase
    .from('recipe_sources')
    .select('id')
    .ilike('slug', sourceName.toLowerCase().replace(/\s+/g, '_'))
    .maybeSingle();

  let sourceId = source?.id;
  if (!sourceId) {
    const { data: newSource } = await supabase
      .from('recipe_sources')
      .insert({
        name: sourceName,
        slug: sourceName.toLowerCase().replace(/\s+/g, '_'),
      })
      .select('id')
      .single();
    sourceId = newSource?.id;
  }

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      name,
      image_url: imageUrl,
      prep_time_min: prepTime,
      cook_time_min: cookTime,
      servings,
      source_id: sourceId,
      source_url: url,
      source_name: sourceName,
      author,
      instructions: instructions || null,
      tags: ['imported'],
      meal_type: 'any',
      status: 'imported',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (recipeError || !recipe) {
    return json(
      { error: 'Kunde inte spara recept' },
      { status: 500 },
    );
  }

  await supabase.from('recipe_ingredients').insert(
    ingredients.map((ing) => ({ recipe_id: recipe.id, raw_text: ing, confidence: 'unmatched' })),
  );

  // Matching writes nutrition and totals through service-role-only functions.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await matchRecipe(admin, recipe.id);

  return json({ id: recipe.id, name });
}

function parseISODuration(iso?: string): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  return hours * 60 + minutes || null;
}
