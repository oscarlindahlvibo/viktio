
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { SavedMeal } from '@/lib/types';
import { formatPoints } from '@/lib/points';
import { Plus, Clock, Trash2, X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link } from '@/lib/navigation';

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Frukost' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Middag' },
  { value: 'snack', label: 'Mellanmål' },
];

export default function SavedMealsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mealType = searchParams.get('meal') || '';
  const { user } = useAuth();
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [newMealType, setNewMealType] = useState('breakfast');
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);

  const loadMeals = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setMeals((data as SavedMeal[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadMeals();
  }, [user]);

  const handleCreateMeal = async () => {
    if (!user || !newMealName) return;
    const { data, error } = await supabase
      .from('saved_meals')
      .insert({
        user_id: user.id,
        name: newMealName,
        meal_type: newMealType,
        total_points: 0,
      })
      .select('id')
      .single();
    if (error) {
      toast.error('Kunde inte skapa måltid');
      return;
    }
    toast.success('Måltid skapad!');
    setShowCreate(false);
    setNewMealName('');
    loadMeals();
    // Navigate to meal detail
    router.push(`/app/mat/sparade/${data.id}`);
  };

  const handleDeleteMeal = async (id: string) => {
    const { error } = await supabase.from('saved_meals').delete().eq('id', id);
    if (error) {
      toast.error('Kunde inte ta bort');
    } else {
      toast.success('Borttagen');
      loadMeals();
    }
  };

  const handleQuickAdd = async (meal: SavedMeal) => {
    if (!user) return;
    // Get meal items
    const { data: items } = await supabase
      .from('saved_meal_items')
      .select('*')
      .eq('saved_meal_id', meal.id);

    if (!items || items.length === 0) {
      toast.error('Måltiden har inga matvaror än');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const targetMealType = mealType || meal.meal_type || 'snack';

    // Add all items to food log
    const inserts = items.map((item) => ({
      user_id: user.id,
      saved_meal_id: meal.id,
      name: item.name,
      meal_type: targetMealType,
      quantity: item.quantity,
      unit: item.unit,
      weight_g: item.weight_g,
      kcal: item.kcal,
      protein_g: item.protein_g,
      carbohydrate_g: 0,
      fat_g: 0,
      fiber_g: 0,
      points: item.points,
      logged_at: today,
    }));

    const { error } = await supabase.from('food_log').insert(inserts);
    if (error) {
      toast.error('Kunde inte lägga till');
    } else {
      toast.success(`${meal.name} tillagd!`);
      router.push('/app');
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mina måltider</h1>
          <p className="text-sm text-muted-foreground">Spara och återanvänd dina favoriter</p>
        </div>
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <Button
        onClick={() => setShowCreate(true)}
        className="w-full h-12 rounded-xl mb-4"
      >
        <Plus className="h-5 w-5 mr-2" />
        Skapa ny måltid
      </Button>

      {showCreate && (
        <div className="rounded-2xl bg-card border border-border p-4 mb-4 space-y-3 animate-scale-in">
          <div>
            <label className="text-sm font-medium">Namn</label>
            <Input
              value={newMealName}
              onChange={(e) => setNewMealName(e.target.value)}
              placeholder="t.ex. Min vanliga frukost"
              className="h-12 rounded-xl"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">Måltidstyp</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {MEAL_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setNewMealType(m.value)}
                  className={`py-2 rounded-xl text-sm font-medium border-2 ${
                    newMealType === m.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-border'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateMeal} className="flex-1 rounded-xl">Skapa</Button>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl">Avbryt</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Laddar...</div>
      ) : meals.length === 0 ? (
        <div className="text-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">Inga sparade måltider än</p>
          <p className="text-sm text-muted-foreground">Skapa en måltid för att snabbt kunna lägga till flera matvaror samtidigt.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meals.map((meal) => (
            <div
              key={meal.id}
              className="rounded-2xl bg-card border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold">{meal.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {meal.meal_type ? MEAL_OPTIONS.find((m) => m.value === meal.meal_type)?.label : 'Mellanmål'}
                    {' • '}
                    {formatPoints(meal.total_points)} points
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/app/mat/sparade/${meal.id}`}
                    className="px-3 py-2 rounded-xl text-sm font-medium text-primary bg-primary-lighter tap-scale"
                  >
                    Redigera
                  </Link>
                  <button
                    onClick={() => handleQuickAdd(meal)}
                    className="px-3 py-2 rounded-xl text-sm font-medium bg-primary text-white tap-scale"
                  >
                    Lägg till
                  </button>
                  <button
                    onClick={() => handleDeleteMeal(meal.id)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
