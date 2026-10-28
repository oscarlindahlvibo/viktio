
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Recipe, RecipeIngredient } from '@/lib/types';
import { formatPoints } from '@/lib/points';
import { ChevronLeft, Clock, Users, Flame, AlertTriangle, ExternalLink, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const recipeId = params.id as string;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState(4);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .maybeSingle();
      setRecipe(r as Recipe);
      if (r) setServings((r as Recipe).servings);

      const { data: ing } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipeId);
      setIngredients((ing as RecipeIngredient[]) || []);
      setLoading(false);
    })();
  }, [recipeId]);

  const scalingFactor = recipe ? servings / recipe.servings : 1;

  const scaledTotals = useMemo(() => {
    const totalPoints = ingredients.reduce((sum, i) => sum + i.points, 0) * scalingFactor;
    const totalKcal = ingredients.reduce((sum, i) => sum + i.kcal, 0) * scalingFactor;
    const totalProtein = ingredients.reduce((sum, i) => sum + i.protein_g, 0) * scalingFactor;
    const totalCarbs = ingredients.reduce((sum, i) => sum + i.carbohydrate_g, 0) * scalingFactor;
    const totalFat = ingredients.reduce((sum, i) => sum + i.fat_g, 0) * scalingFactor;
    return {
      points: totalPoints,
      kcal: totalKcal / servings,
      protein: totalProtein / servings,
      carbs: totalCarbs / servings,
      fat: totalFat / servings,
    };
  }, [ingredients, servings, scalingFactor]);

  const handleAddToDiary = async () => {
    if (!user) return;
    setAdding(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data: engineVersion } = await supabase
      .from('point_engine_versions')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    const { error } = await supabase.from('food_log').insert({
      user_id: user.id,
      recipe_id: recipeId,
      name: `${recipe?.name} (${servings} port)`,
      meal_type: 'dinner',
      quantity: servings,
      unit: 'portioner',
      kcal: Math.round(scaledTotals.kcal * servings),
      protein_g: Math.round(scaledTotals.protein * servings),
      carbohydrate_g: Math.round(scaledTotals.carbs * servings),
      fat_g: Math.round(scaledTotals.fat * servings),
      fiber_g: 0,
      points: Math.round(scaledTotals.points * 10) / 10,
      engine_version_id: engineVersion?.id || null,
      logged_at: today,
    });

    setAdding(false);
    if (error) {
      toast.error('Kunde inte lägga till');
    } else {
      toast.success(`${recipe?.name} tillagd!`);
      router.push('/app');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Laddar...</div>;
  }

  if (!recipe) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Recept hittades inte</div>;
  }

  const totalTime = (recipe.prep_time_min || 0) + (recipe.cook_time_min || 0);

  return (
    <div className="min-h-screen pb-24">
      {/* Hero image */}
      <div className="relative h-56 bg-muted">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-6xl">🍽️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 p-2 rounded-xl bg-black/50 backdrop-blur text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {recipe.source_name && recipe.source_name !== 'Viktio' && (
          <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur text-white text-xs font-medium">
            {recipe.source_name}
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-xl font-bold text-white">{recipe.name}</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Meta info */}
        <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {totalTime} min
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {recipe.servings} port
          </span>
          <span className="flex items-center gap-1">
            <Flame className="h-4 w-4" />
            {Math.round(recipe.kcal_per_serving)} kcal/port
          </span>
        </div>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {recipe.tags.map((tag) => (
              <span key={tag} className="px-2 py-1 rounded-full bg-muted text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Servings adjuster */}
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">Portioner</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted tap-scale"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-xl font-bold w-8 text-center">{servings}</span>
              <button
                onClick={() => setServings((s) => s + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted tap-scale"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Nutrition per serving */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-muted p-2">
              <p className="text-xs text-muted-foreground">Points</p>
              <p className="font-bold text-primary">{formatPoints(scaledTotals.points / servings)}</p>
            </div>
            <div className="rounded-xl bg-muted p-2">
              <p className="text-xs text-muted-foreground">kcal</p>
              <p className="font-bold">{Math.round(scaledTotals.kcal)}</p>
            </div>
            <div className="rounded-xl bg-muted p-2">
              <p className="text-xs text-muted-foreground">protein</p>
              <p className="font-bold">{Math.round(scaledTotals.protein)}g</p>
            </div>
            <div className="rounded-xl bg-muted p-2">
              <p className="text-xs text-muted-foreground">fett</p>
              <p className="font-bold">{Math.round(scaledTotals.fat)}g</p>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="mb-4">
          <h2 className="text-lg font-bold mb-3">Ingredienser</h2>
          <div className="space-y-2">
            {ingredients.map((ing) => {
              const scaledWeight = (ing.weight_g || 0) * scalingFactor;
              const scaledPoints = ing.points * scalingFactor;
              return (
                <div
                  key={ing.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-card border border-border"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{ing.raw_text || 'Okänd ingrediens'}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(scaledWeight)}g
                      {ing.confidence === 'low' && ' • Kontrollera ingrediens'}
                      {ing.confidence === 'unmatched' && ' • Hittades inte, räknas som 0'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatPoints(scaledPoints)}</span>
                </div>
              );
            })}
          </div>
          {ingredients.some((i) => i.confidence === 'low' || i.confidence === 'unmatched') && (
            <div className="mt-3 rounded-xl bg-warning/10 p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <span className="text-xs text-warning">
                Vissa ingredienser behöver kontrolleras. Points baseras delvis på uppskattade värden.
              </span>
            </div>
          )}
        </div>

        {/* Instructions */}
        {recipe.instructions && (
          <div className="mb-4">
            <h2 className="text-lg font-bold mb-3">Tillagning</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{recipe.instructions}</p>
          </div>
        )}

        {/* External source link */}
        {recipe.source_url && recipe.source_name && recipe.source_name !== 'Viktio' && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-xl bg-primary-lighter text-primary text-sm font-medium mb-4"
          >
            <ExternalLink className="h-4 w-4" />
            Visa tillagning hos {recipe.source_name}
          </a>
        )}

        {/* Add to diary button */}
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
          <button
            onClick={handleAddToDiary}
            disabled={adding}
            className="w-full h-14 rounded-2xl bg-primary text-white font-semibold flex items-center justify-center gap-2 tap-scale disabled:opacity-50 shadow-lg"
          >
            {adding ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Lägg till i dagbok ({formatPoints(scaledTotals.points / servings)} points/port)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
