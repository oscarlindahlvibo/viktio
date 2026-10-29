
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { usePointEngineConfig } from '@/hooks/use-daily-data';
import { calculatePointsPer100g, formatPoints } from '@/lib/points';
import type { FoodSearchResult, FoodCategory } from '@/lib/types';
import { Search, ScanLine, X, Loader2, Star, Clock, BookOpen } from 'lucide-react';
import { Link } from '@/lib/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FoodAddSheet } from '@/components/food-add-sheet';

export default function FoodSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mealType = searchParams.get('meal') || 'snack';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentFoods, setRecentFoods] = useState<FoodSearchResult[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const { config } = usePointEngineConfig();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();

  // Load categories
  useEffect(() => {
    supabase
      .from('food_categories')
      .select('*')
      .order('name')
      .then(({ data }) => setCategories((data as FoodCategory[]) || []));
  }, []);

  // Load recent foods
  useEffect(() => {
    if (!user) return;
    supabase
      .from('food_log')
      .select('food_id, name')
      .eq('user_id', user.id)
      .not('food_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data) return;
        const seen = new Set<string>();
        const unique = data.filter((d: { food_id: string; name: string }) => {
          if (seen.has(d.food_id)) return false;
          seen.add(d.food_id);
          return true;
        });
        loadFoodsByIds(unique.slice(0, 6).map((d: { food_id: string }) => d.food_id));
      });
  }, [user]);

  const loadFoodsByIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('foods')
      .select(`
        id, name, brand, image_url, package_size, barcode, zero_point, status, serving_size_g, serving_description,
        category:food_categories(name, slug),
        nutrition:food_nutrition(*)
      `)
      .in('id', ids);

    if (data) {
      setRecentFoods(data.map(mapFoodToResult).filter(Boolean) as FoodSearchResult[]);
    }
  };

  const mapFoodToResult = (f: Record<string, unknown>): FoodSearchResult | null => {
    if (!f) return null;
    const nutrition = (f.nutrition as Record<string, number>[])?.[0];
    if (!nutrition) return null;
    const category = f.category as { name: string; slug: string } | null;
    const pointsPer100g = calculatePointsPer100g(
      {
        id: '',
        food_id: f.id as string,
        kcal: nutrition.kcal || 0,
        protein_g: nutrition.protein_g || 0,
        carbohydrate_g: nutrition.carbohydrate_g || 0,
        sugar_g: nutrition.sugar_g || 0,
        fat_g: nutrition.fat_g || 0,
        saturated_fat_g: nutrition.saturated_fat_g || 0,
        fiber_g: nutrition.fiber_g || 0,
        sodium_mg: nutrition.sodium_mg || 0,
        salt_g: nutrition.salt_g || 0,
        per_amount: nutrition.per_amount || 100,
        unit: String(nutrition.unit || 'g'),
      },
      f.zero_point as boolean,
      f.manual_points as number | null,
      config || undefined,
    );
    const servingG = f.serving_size_g as number | null;
    const pointsPerServing = servingG
      ? pointsPer100g * (servingG / 100)
      : pointsPer100g;
    return {
      id: f.id as string,
      name: f.name as string,
      brand: f.brand as string | null,
      image_url: f.image_url as string | null,
      package_size: f.package_size as string | null,
      barcode: f.barcode as string | null,
      zero_point: f.zero_point as boolean,
      status: f.status as FoodSearchResult['status'],
      kcal: nutrition.kcal || 0,
      protein_g: nutrition.protein_g || 0,
      points_per_100g: pointsPer100g,
      points_per_serving: pointsPerServing,
      serving_description: f.serving_description as string | null,
      category_name: category?.name,
      category_slug: category?.slug,
    };
  };

  const performSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);

    // Search local database
    const { data: localData } = await supabase
      .from('foods')
      .select(`
        id, name, brand, image_url, package_size, barcode, zero_point, status, serving_size_g, serving_description, manual_points,
        category:food_categories(name, slug),
        nutrition:food_nutrition(*)
      `)
      .ilike('name', `%${q}%`)
      .limit(20);

    const localResults = (localData || []).map(mapFoodToResult).filter(Boolean) as FoodSearchResult[];

    // Search external (Open Food Facts) in parallel
    let externalResults: FoodSearchResult[] = [];
    try {
      const { data, error: fnError } = await supabase.functions.invoke('food-search', { body: { q } });
      if (!fnError && data) {
        const localIds = new Set(localResults.map((r) => r.id));
        const localBarcodes = new Set(localResults.map((r) => r.barcode).filter(Boolean));
        externalResults = (data.results || [])
          .filter((r: { barcode?: string | null }) => !localBarcodes.has(r.barcode ?? ''))
          .map((r: {
            name: string; brand: string | null; image_url: string | null;
            package_size: string | null; barcode: string; kcal: number;
            protein_g: number; carbohydrate_g: number; fat_g: number;
            saturated_fat_g: number; fiber_g: number; sugar_g: number;
            sodium_mg: number; serving_description: string | null;
          }) => {
            const pointsPer100g = calculatePointsPer100g(
              {
                id: '', food_id: '',
                kcal: r.kcal, protein_g: r.protein_g,
                carbohydrate_g: r.carbohydrate_g, sugar_g: r.sugar_g,
                fat_g: r.fat_g, saturated_fat_g: r.saturated_fat_g,
                fiber_g: r.fiber_g, sodium_mg: r.sodium_mg,
                salt_g: 0, per_amount: 100, unit: 'g',
              },
              false, null, config || undefined,
            );
            return {
              id: `off_${r.barcode || r.name}`,
              name: r.name,
              brand: r.brand,
              image_url: r.image_url,
              package_size: r.package_size,
              barcode: r.barcode,
              zero_point: false,
              status: 'estimated' as const,
              kcal: r.kcal,
              protein_g: r.protein_g,
              points_per_100g: pointsPer100g,
              points_per_serving: pointsPer100g,
              serving_description: r.serving_description,
              nutrition: {
                kcal: r.kcal, protein_g: r.protein_g, carbohydrate_g: r.carbohydrate_g, sugar_g: r.sugar_g,
                fat_g: r.fat_g, saturated_fat_g: r.saturated_fat_g, fiber_g: r.fiber_g, sodium_mg: r.sodium_mg,
                per_amount: 100, unit: 'g',
              },
              category_name: undefined,
              category_slug: undefined,
            };
          });
      }
    } catch {
      // External search failed, continue with local only
    }

    setResults([...localResults, ...externalResults]);
    setLoading(false);
  }, [config]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => performSearch(query), 250);
    } else {
      setResults([]);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      {/* Search header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök mat, produkt eller recept"
            className="h-12 rounded-xl pl-10"
          />
        </div>
      </div>

      {query.length < 2 ? (
        <div className="space-y-6 animate-fade-in">
          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/app/mat/skanna"
              className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border tap-scale"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-2">
                <ScanLine className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">Skanna streckkod</p>
                <p className="text-xs text-muted-foreground">Använd kameran</p>
              </div>
            </Link>
            <Link
              href="/app/recept"
              className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border tap-scale"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-3">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">Sök recept</p>
                <p className="text-xs text-muted-foreground">Hitta inspiration</p>
              </div>
            </Link>
          </div>

          {/* Recent foods */}
          {recentFoods.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground">Senaste</h3>
              </div>
              <div className="space-y-2">
                {recentFoods.map((food) => (
                  <FoodResultRow
                    key={food.id}
                    food={food}
                    onClick={() => setSelectedFood(food)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Zero-point categories */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-muted-foreground">Noll-points mat</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.filter((c) => c.zero_point).map((cat) => (
                <div
                  key={cat.id}
                  className="px-3 py-1.5 rounded-full bg-primary-lighter text-primary text-sm font-medium"
                >
                  {cat.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 animate-fade-in">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Inga resultat för &quot;{query}&quot;</p>
              <Button
                variant="outline"
                onClick={() => router.push(`/app/mat/skanna?manual=1&name=${encodeURIComponent(query)}`)}
                className="rounded-xl"
              >
                Lägg till mat manuellt
              </Button>
            </div>
          )}
          {!loading && results.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground px-1">
                {results.length} resultat
              </p>
              {results.map((food) => (
                <FoodResultRow
                  key={food.id}
                  food={food}
                  onClick={() => setSelectedFood(food)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Add sheet */}
      {selectedFood && (
        <FoodAddSheet
          food={selectedFood}
          mealType={mealType}
          onClose={() => setSelectedFood(null)}
          onAdded={() => {
            setSelectedFood(null);
            toast.success('Tillagt!');
            router.push('/app');
          }}
        />
      )}
    </div>
  );
}

function FoodResultRow({ food, onClick }: { food: FoodSearchResult; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all tap-scale text-left"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted flex-shrink-0 overflow-hidden">
        {food.image_url ? (
          <img src={food.image_url} alt={food.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl">{food.zero_point ? '🥗' : '🍽️'}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{food.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {food.brand && <span className="truncate">{food.brand}</span>}
          {food.package_size && <span>• {food.package_size}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{Math.round(food.kcal)} kcal/100g</span>
          <span className="text-xs text-muted-foreground">• {Math.round(food.protein_g)}g protein</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        {food.zero_point ? (
          <span className="text-sm font-bold text-primary">0</span>
        ) : (
          <span className="text-sm font-bold">{formatPoints(food.points_per_100g)}</span>
        )}
        <p className="text-[10px] text-muted-foreground">per 100g</p>
      </div>
    </button>
  );
}
