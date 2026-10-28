
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { FoodLogEntry, MealType } from '@/lib/types';
import { X, Minus, Plus, Trash2, Bookmark, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatPoints } from '@/lib/points';

interface EditLogEntrySheetProps {
  entry: FoodLogEntry;
  onClose: () => void;
  onUpdated: () => void;
}

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Frukost' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Middag' },
  { value: 'snack', label: 'Mellanmål' },
];

export function EditLogEntrySheet({ entry, onClose, onUpdated }: EditLogEntrySheetProps) {
  const [selectedMeal, setSelectedMeal] = useState<MealType>(entry.meal_type);
  const [amount, setAmount] = useState<number>(Number(entry.quantity) || 1);
  const [unit, setUnit] = useState(entry.unit || 'g');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSaveMeal, setShowSaveMeal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealTypeForSave, setMealTypeForSave] = useState<MealType>(entry.meal_type);

  const weightG = useMemo(() => {
    if (unit === 'g' || unit === 'ml') return amount;
    if (unit === 'piece') return amount * 60;
    return amount * 100;
  }, [unit, amount]);

  // Scale nutrition based on new weight vs original
  const originalWeight = Number(entry.weight_g) || 100;
  const scale = weightG / originalWeight;

  const scaledNutrition = useMemo(() => ({
    kcal: Math.round(Number(entry.kcal) * scale),
    protein: Math.round(Number(entry.protein_g) * scale),
    carbs: Math.round(Number(entry.carbohydrate_g) * scale),
    fat: Math.round(Number(entry.fat_g) * scale),
    fiber: Math.round(Number(entry.fiber_g) * scale),
    points: Math.round(Number(entry.points) * scale * 10) / 10,
  }), [entry, scale, weightG]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('food_log')
      .update({
        meal_type: selectedMeal,
        quantity: amount,
        unit,
        weight_g: weightG,
        kcal: scaledNutrition.kcal,
        protein_g: scaledNutrition.protein,
        carbohydrate_g: scaledNutrition.carbs,
        fat_g: scaledNutrition.fat,
        fiber_g: scaledNutrition.fiber,
        points: scaledNutrition.points,
      })
      .eq('id', entry.id);

    setSaving(false);
    if (error) {
      toast.error('Kunde inte uppdatera');
    } else {
      toast.success('Uppdaterad');
      onUpdated();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('food_log').delete().eq('id', entry.id);
    setDeleting(false);
    if (error) {
      toast.error('Kunde inte ta bort');
    } else {
      toast.success('Borttagen');
      onUpdated();
    }
  };

  const handleSaveAsMeal = async () => {
    if (!mealName) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Inte inloggad');
      setSaving(false);
      return;
    }

    const { data: savedMeal, error: mealError } = await supabase
      .from('saved_meals')
      .insert({
        user_id: user.id,
        name: mealName,
        meal_type: mealTypeForSave,
        total_points: scaledNutrition.points,
      })
      .select('id')
      .single();

    if (mealError || !savedMeal) {
      toast.error('Kunde inte spara måltid');
      setSaving(false);
      return;
    }

    const { error: itemError } = await supabase.from('saved_meal_items').insert({
      saved_meal_id: savedMeal.id,
      food_id: entry.food_id,
      recipe_id: entry.recipe_id,
      name: entry.name,
      quantity: amount,
      unit,
      weight_g: weightG,
      points: scaledNutrition.points,
      kcal: scaledNutrition.kcal,
      protein_g: scaledNutrition.protein,
    });

    setSaving(false);
    if (itemError) {
      toast.error('Kunde inte spara matvara');
    } else {
      toast.success('Sparad som favorit');
      setShowSaveMeal(false);
      setMealName('');
    }
  };

  const adjustAmount = (delta: number) => {
    setAmount((a) => Math.max(1, Math.round((a + delta) * 10) / 10));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar pb-28">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-muted" />
        </div>

        <div className="px-5 pb-3 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-bold">{entry.name}</h2>
            <p className="text-xs text-muted-foreground">Redigera matlogg</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
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

        {/* Amount */}
        <div className="px-5 mb-4">
          <p className="text-sm font-medium mb-2">Mängd ({unit})</p>
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
              <p className="text-xs text-muted-foreground">{weightG}g</p>
            </div>
            <button
              onClick={() => adjustAmount(unit === 'g' || unit === 'ml' ? 25 : 1)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted tap-scale"
            >
              <Plus className="h-5 w-5" />
            </button>
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
              <p className="font-bold">{scaledNutrition.kcal}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">protein</p>
              <p className="font-bold">{scaledNutrition.protein}g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">kolh.</p>
              <p className="font-bold">{scaledNutrition.carbs}g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">fett</p>
              <p className="font-bold">{scaledNutrition.fat}g</p>
            </div>
          </div>
        </div>

        {/* Points */}
        <div className="px-5 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold">Points</span>
            <span className="text-3xl font-bold text-primary">{formatPoints(scaledNutrition.points)}</span>
          </div>
        </div>

        {/* Save as favorite meal */}
        {showSaveMeal ? (
          <div className="mx-5 mb-4 rounded-2xl bg-card border border-border p-4 space-y-3 animate-scale-in">
            <p className="text-sm font-medium">Spara som favoritmåltid</p>
            <Input
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="t.ex. Min vanliga frukost"
              className="h-12 rounded-xl"
              autoFocus
            />
            <div className="grid grid-cols-4 gap-2">
              {MEAL_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMealTypeForSave(m.value)}
                  className={cn(
                    'py-2 rounded-xl text-xs font-medium border-2 transition-all',
                    mealTypeForSave === m.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveAsMeal} disabled={saving || !mealName} className="flex-1 rounded-xl">
                {saving ? 'Sparar...' : 'Spara'}
              </Button>
              <Button variant="outline" onClick={() => setShowSaveMeal(false)} className="rounded-xl">
                Avbryt
              </Button>
            </div>
          </div>
        ) : null}

        {/* Action buttons */}
        <div className="px-5 pb-8 safe-bottom space-y-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-primary text-white font-semibold text-base flex items-center justify-center gap-2 tap-scale disabled:opacity-50"
          >
            {saving ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="h-5 w-5" />
                Spara ändringar
              </>
            )}
          </button>

          {!showSaveMeal && (
            <button
              onClick={() => setShowSaveMeal(true)}
              className="w-full h-12 rounded-2xl bg-card border border-border font-medium text-sm flex items-center justify-center gap-2 tap-scale"
            >
              <Bookmark className="h-4 w-4" />
              Spara som favoritmåltid
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full h-12 rounded-2xl bg-destructive/10 text-destructive font-medium text-sm flex items-center justify-center gap-2 tap-scale disabled:opacity-50"
          >
            {deleting ? (
              <div className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Ta bort
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
