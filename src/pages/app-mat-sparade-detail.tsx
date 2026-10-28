
import { useState, useEffect } from 'react';
import { useRouter, useParams } from '@/lib/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { usePointEngineConfig } from '@/hooks/use-daily-data';
import { calculatePointsFromNutrition, formatPoints } from '@/lib/points';
import type { SavedMealItem } from '@/lib/types';
import { Plus, Trash2, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SavedMealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const mealId = params.id as string;
  const { user } = useAuth();
  const { config } = usePointEngineConfig();
  const [mealName, setMealName] = useState('');
  const [items, setItems] = useState<SavedMealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { id: string; name: string; brand: string | null; kcal: number; protein_g: number; zero_point: boolean; manual_points: number | null; nutrition?: { per_amount: number; kcal: number; protein_g: number; carbohydrate_g: number; fat_g: number; saturated_fat_g: number; fiber_g: number; sodium_mg: number; sugar_g: number } }[]
  >([]);

  const loadMeal = async () => {
    const { data: meal } = await supabase
      .from('saved_meals')
      .select('name, total_points')
      .eq('id', mealId)
      .maybeSingle();
    if (meal) setMealName(meal.name);

    const { data: mealItems } = await supabase
      .from('saved_meal_items')
      .select('*')
      .eq('saved_meal_id', mealId);
    setItems((mealItems as SavedMealItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadMeal();
  }, [mealId]);

  const handleSearch = async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('foods')
      .select(`
        id, name, brand, zero_point, manual_points,
        nutrition:food_nutrition(kcal, protein_g, carbohydrate_g, fat_g, saturated_fat_g, fiber_g, sodium_mg, sugar_g, per_amount)
      `)
      .ilike('name', `%${q}%`)
      .limit(15);
    setSearchResults((data as unknown as typeof searchResults) || []);
  };

  const handleAddItem = async (food: typeof searchResults[0]) => {
    const weightG = 100;
    const nutrition = food.nutrition;
    const points = nutrition
      ? calculatePointsFromNutrition(
          {
            id: '',
            food_id: food.id,
            kcal: nutrition.kcal,
            protein_g: nutrition.protein_g,
            carbohydrate_g: nutrition.carbohydrate_g,
            sugar_g: nutrition.sugar_g,
            fat_g: nutrition.fat_g,
            saturated_fat_g: nutrition.saturated_fat_g,
            fiber_g: nutrition.fiber_g,
            sodium_mg: nutrition.sodium_mg,
            salt_g: 0,
            per_amount: nutrition.per_amount,
            unit: 'g',
          },
          weightG,
          food.zero_point,
          food.manual_points,
          config || undefined,
        )
      : 0;

    const kcal = nutrition ? Math.round(nutrition.kcal) : 0;
    const protein = nutrition ? Math.round(nutrition.protein_g) : 0;

    await supabase.from('saved_meal_items').insert({
      saved_meal_id: mealId,
      food_id: food.id,
      name: food.name,
      quantity: 1,
      unit: 'serving',
      weight_g: weightG,
      points,
      kcal,
      protein_g: protein,
    });

    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    loadMeal();
    updateTotalPoints();
    toast.success('Tillagd');
  };

  const handleDeleteItem = async (itemId: string) => {
    await supabase.from('saved_meal_items').delete().eq('id', itemId);
    loadMeal();
    updateTotalPoints();
  };

  const updateTotalPoints = async () => {
    const total = items.reduce((sum, i) => sum + i.points, 0);
    await supabase.from('saved_meals').update({ total_points: total }).eq('id', mealId);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Laddar...</div>;
  }

  const totalPoints = items.reduce((sum, i) => sum + i.points, 0);

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{mealName}</h1>
          <p className="text-sm text-muted-foreground">{formatPoints(totalPoints)} points totalt</p>
        </div>
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </div>

      <Button
        onClick={() => setShowSearch(true)}
        className="w-full h-12 rounded-xl mb-4"
      >
        <Plus className="h-5 w-5 mr-2" />
        Lägg till matvara
      </Button>

      {items.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Inga matvaror än</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border">
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.weight_g}g • {item.kcal} kcal • {item.protein_g}g protein
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{formatPoints(item.points)}</span>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search overlay */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-background animate-fade-in">
          <div className="px-4 pt-6 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setShowSearch(false)} className="p-2 rounded-xl hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                  placeholder="Sök matvara"
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              {searchResults.map((food) => (
                <button
                  key={food.id}
                  onClick={() => handleAddItem(food)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-card border border-border hover:border-primary/30 tap-scale text-left"
                >
                  <div>
                    <p className="font-medium text-sm">{food.name}</p>
                    {food.brand && <p className="text-xs text-muted-foreground">{food.brand}</p>}
                  </div>
                  <Plus className="h-5 w-5 text-primary" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
