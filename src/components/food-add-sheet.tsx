
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { usePointEngineConfig } from '@/hooks/use-daily-data';
import { calculatePointsFromNutrition, formatPoints } from '@/lib/points';
import type { FoodSearchResult, MealType } from '@/lib/types';
import { X, Minus, Plus, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { toLocalDate } from '@/lib/dates';

interface FoodAddSheetProps {
  food: FoodSearchResult;
  mealType: string;
  onClose: () => void;
  onAdded: () => void;
}

const UNITS = [
  { key: 'g', label: 'gram', defaultAmount: 100 },
  { key: 'serving', label: 'portioner', defaultAmount: 1 },
  { key: 'ml', label: 'ml', defaultAmount: 100 },
  { key: 'piece', label: 'styck', defaultAmount: 1 },
];

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Frukost' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Middag' },
  { value: 'snack', label: 'Mellanmål' },
];

export function FoodAddSheet({ food, mealType, onClose, onAdded }: FoodAddSheetProps) {
  const { user } = useAuth();
  const { config } = usePointEngineConfig();
  const [unit, setUnit] = useState('g');
  const [amount, setAmount] = useState(100);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(mealType as MealType);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(() => toLocalDate());

  // Fetch full nutrition for this food
  const [nutrition, setNutrition] = useState<{
    kcal: number; protein_g: number; carbohydrate_g: number; sugar_g: number;
    fat_g: number; saturated_fat_g: number; fiber_g: number; sodium_mg: number;
    per_amount: number; unit: string;
  } | null>(null);

  useEffect(() => {
    if (food.nutrition) {
      setNutrition(food.nutrition);
      return;
    }
    supabase
      .from('food_nutrition')
      .select('*')
      .eq('food_id', food.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNutrition(data as typeof nutrition);
      });
  }, [food.id, food.nutrition]);

  // When unit changes, set default amount
  useEffect(() => {
    const u = UNITS.find((u) => u.key === unit);
    if (u) setAmount(u.defaultAmount);
  }, [unit]);

  const weightG = useMemo(() => {
    if (unit === 'g' || unit === 'ml') return amount;
    if (unit === 'serving' && food.serving_description) {
      return amount * (food.serving_description.includes('g')
        ? parseFloat(food.serving_description) || 100
        : 100);
    }
    if (unit === 'piece') return amount * 60; // estimate ~60g per piece
    return amount * 100;
  }, [unit, amount, food.serving_description]);

  const calculatedPoints = useMemo(() => {
    if (food.zero_point) return 0;
    if (!nutrition) return 0;
    return calculatePointsFromNutrition(
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
        unit: nutrition.unit,
      },
      weightG,
      food.zero_point,
      null,
      config || undefined,
    );
  }, [nutrition, weightG, food, config]);

  const calculatedNutrition = useMemo(() => {
    if (!nutrition) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const factor = weightG / (nutrition.per_amount || 100);
    return {
      kcal: Math.round(nutrition.kcal * factor),
      protein: Math.round(nutrition.protein_g * factor),
      carbs: Math.round(nutrition.carbohydrate_g * factor),
      fat: Math.round(nutrition.fat_g * factor),
    };
  }, [nutrition, weightG]);

  const handleAdd = async () => {
    if (!user) return;
    setSaving(true);

    let foodId = food.id;

    // If this is an external food (Open Food Facts), save it to DB first
    if (foodId.startsWith('off_') && nutrition) {
      // Reuse a product that someone already saved from the same barcode.
      const existing = food.barcode
        ? (await supabase.from('foods').select('id').eq('barcode', food.barcode).limit(1).maybeSingle()).data
        : null;
      if (existing) {
        foodId = existing.id;
      } else {
        const { data: newFood, error: foodError } = await supabase
          .from('foods')
          .insert({
            name: food.name,
            brand: food.brand || null,
            barcode: food.barcode || null,
            package_size: food.package_size || null,
            image_url: food.image_url || null,
            status: 'user_created',
            zero_point: false,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (foodError || !newFood) {
          toast.error('Kunde inte spara maten');
          setSaving(false);
          return;
        }

        foodId = newFood.id;

        await supabase.from('food_nutrition').insert({
          food_id: foodId,
          kcal: nutrition.kcal,
          protein_g: nutrition.protein_g,
          carbohydrate_g: nutrition.carbohydrate_g,
          sugar_g: nutrition.sugar_g,
          fat_g: nutrition.fat_g,
          saturated_fat_g: nutrition.saturated_fat_g,
          fiber_g: nutrition.fiber_g,
          sodium_mg: nutrition.sodium_mg,
          salt_g: 0,
          per_amount: nutrition.per_amount || 100,
          unit: nutrition.unit || 'g',
        });
      }
    }

    const { data: engineVersion } = await supabase
      .from('point_engine_versions')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    const { error } = await supabase.from('food_log').insert({
      user_id: user.id,
      food_id: foodId,
      name: food.name,
      meal_type: selectedMeal,
      quantity: amount,
      unit,
      weight_g: weightG,
      kcal: calculatedNutrition.kcal,
      protein_g: calculatedNutrition.protein,
      carbohydrate_g: calculatedNutrition.carbs,
      fat_g: calculatedNutrition.fat,
      fiber_g: nutrition ? Math.round(nutrition.fiber_g * (weightG / (nutrition.per_amount || 100))) : 0,
      points: calculatedPoints,
      engine_version_id: engineVersion?.id || null,
      nutrition_snapshot: nutrition,
      logged_at: date,
    });

    setSaving(false);
    if (error) {
      toast.error('Kunde inte lägga till: ' + error.message);
    } else {
      onAdded();
    }
  };

  const adjustAmount = (delta: number) => {
    setAmount((a) => Math.max(1, Math.round((a + delta) * 10) / 10));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar pb-28">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-bold">{food.name}</h2>
            {food.brand && <p className="text-sm text-muted-foreground">{food.brand}</p>}
            {food.package_size && <p className="text-xs text-muted-foreground">{food.package_size}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {food.zero_point && (
          <div className="mx-5 mb-3 rounded-xl bg-primary-lighter p-3 flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Noll-points mat</span>
          </div>
        )}

        {food.status === 'estimated' && (
          <div className="mx-5 mb-3 rounded-xl bg-warning/10 p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm text-warning">Points baseras delvis på uppskattade värden.</span>
          </div>
        )}

        {/* Unit selector */}
        <div className="px-5 mb-4">
          <p className="text-sm font-medium mb-2">Enhet</p>
          <div className="grid grid-cols-4 gap-2">
            {UNITS.map((u) => (
              <button
                key={u.key}
                onClick={() => setUnit(u.key)}
                className={cn(
                  'py-2 rounded-xl text-sm font-medium border-2 transition-all',
                  unit === u.key
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-card',
                )}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="px-5 mb-4">
          <p className="text-sm font-medium mb-2">Mängd</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustAmount(unit === 'g' || unit === 'ml' ? -25 : -1)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted tap-scale"
            >
              <Minus className="h-5 w-5" />
            </button>
            <div className="flex-1 text-center">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full text-center text-2xl font-bold bg-transparent outline-none"
              />
              <p className="text-xs text-muted-foreground">
                {unit === 'g' || unit === 'ml' ? `${weightG}g` : unit === 'serving' ? `${weightG}g` : `${weightG}g uppskattat`}
              </p>
            </div>
            <button
              onClick={() => adjustAmount(unit === 'g' || unit === 'ml' ? 25 : 1)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted tap-scale"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Meal type */}
        <div className="px-5 mb-4">
          <p className="text-sm font-medium mb-2">Måltid</p>
          <div className="grid grid-cols-4 gap-2">
            {MEAL_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => setSelectedMeal(m.value)}
                className={cn(
                  'py-2 rounded-xl text-sm font-medium border-2 transition-all',
                  selectedMeal === m.value
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-card',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nutrition summary */}
        <div className="mx-5 mb-4 rounded-2xl bg-muted p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Näringsvärden</span>
            <span className="text-xs text-muted-foreground">per {weightG}g</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">kcal</p>
              <p className="font-bold">{calculatedNutrition.kcal}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">protein</p>
              <p className="font-bold">{calculatedNutrition.protein}g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">kolh.</p>
              <p className="font-bold">{calculatedNutrition.carbs}g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">fett</p>
              <p className="font-bold">{calculatedNutrition.fat}g</p>
            </div>
          </div>
        </div>

        {/* Points + Add button */}
        <div className="px-5 pb-8 safe-bottom">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-semibold">Points</span>
            <span className="text-3xl font-bold text-primary">{formatPoints(calculatedPoints)}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-primary text-white font-semibold text-base flex items-center justify-center gap-2 tap-scale disabled:opacity-50"
          >
            {saving ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Lägg till
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
