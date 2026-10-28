// Re-runs ingredient matching for recipes, e.g. after importing new foods.
// Service role only. Body: { "recipe_id": "<uuid>" } for one recipe, or { "all": true } for every
// recipe with unmatched ingredients. Pass "rematch": true to redo already matched ingredients too.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json, readParams } from '../_shared/http.ts';
import { matchRecipe } from '../_shared/ingredients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return json({ error: 'Endast för administratörer' }, { status: 403 });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const params = (await readParams(req)) as Record<string, unknown>;
  const onlyUnmatched = !params.rematch;

  let recipeIds: string[];
  if (params.recipe_id) {
    recipeIds = [String(params.recipe_id)];
  } else if (params.all) {
    let q = db.from('recipe_ingredients').select('recipe_id');
    if (onlyUnmatched) q = q.eq('confidence', 'unmatched');
    const { data, error } = await q;
    if (error) return json({ error: error.message }, { status: 500 });
    recipeIds = [...new Set((data ?? []).map((r) => r.recipe_id as string))];
  } else {
    return json({ error: 'recipe_id eller all krävs' }, { status: 400 });
  }

  let ingredients = 0;
  for (const id of recipeIds) ingredients += await matchRecipe(db, id, onlyUnmatched);
  return json({ recipes: recipeIds.length, ingredients });
});
