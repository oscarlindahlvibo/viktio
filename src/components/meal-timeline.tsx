
import { Link } from '@/lib/navigation';
import { useState } from 'react';
import type { FoodLogEntry } from '@/lib/types';
import { MEAL_LABELS } from '@/hooks/use-daily-data';
import { formatPoints } from '@/lib/points';
import { Trash2, Plus, Coffee, Sun, Moon, Apple, ChevronRight, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditLogEntrySheet } from './edit-log-entry-sheet';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MealTimelineProps {
  meals: Record<string, FoodLogEntry[]>;
  onDelete: (id: string) => void;
  date: string;
  onUpdated?: () => void;
}

const MEAL_ICONS: Record<string, typeof Coffee> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Apple,
};

export function MealTimeline({ meals, onDelete, date, onUpdated }: MealTimelineProps) {
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null);
  const [savingMealType, setSavingMealType] = useState<string | null>(null);
  const [mealName, setMealName] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);

  const handleEditClose = () => {
    setEditingEntry(null);
    if (onUpdated) onUpdated();
  };

  const handleSaveMealAsFavorite = async (mealType: string) => {
    if (!mealName) return;
    setSavingMeal(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Inte inloggad');
      setSavingMeal(false);
      return;
    }

    const entries = meals[mealType] || [];
    const totalPoints = entries.reduce((sum, e) => sum + e.points, 0);

    const { data: savedMeal, error: mealError } = await supabase
      .from('saved_meals')
      .insert({
        user_id: user.id,
        name: mealName,
        meal_type: mealType,
        total_points: totalPoints,
      })
      .select('id')
      .single();

    if (mealError || !savedMeal) {
      toast.error('Kunde inte spara måltid');
      setSavingMeal(false);
      return;
    }

    const items = entries.map((e) => ({
      saved_meal_id: savedMeal.id,
      food_id: e.food_id,
      recipe_id: e.recipe_id,
      name: e.name,
      quantity: e.quantity,
      unit: e.unit,
      weight_g: e.weight_g,
      points: e.points,
      kcal: e.kcal,
      protein_g: e.protein_g,
    }));

    const { error: itemsError } = await supabase.from('saved_meal_items').insert(items);

    setSavingMeal(false);
    if (itemsError) {
      toast.error('Kunde inte spara matvaror');
    } else {
      toast.success('Sparad som favorit');
      setSavingMealType(null);
      setMealName('');
    }
  };

  return (
    <div className="space-y-3">
      {mealTypes.map((mealType) => {
        const entries = meals[mealType] || [];
        const mealPoints = entries.reduce((sum, e) => sum + e.points, 0);
        const Icon = MEAL_ICONS[mealType];
        const isToday = date === new Date().toISOString().slice(0, 10);

        return (
          <div key={mealType} className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-lighter">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold">{MEAL_LABELS[mealType]}</span>
              </div>
              <span className="text-sm font-bold text-primary">{formatPoints(mealPoints)}</span>
            </div>

            {entries.length > 0 ? (
              <div className="px-4 pb-2 space-y-1">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 border-t border-border/50 group"
                  >
                    <button
                      onClick={() => setEditingEntry(entry)}
                      className="flex-1 min-w-0 text-left tap-scale"
                    >
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{entry.name}</p>
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.weight_g ? `${entry.weight_g}g • ` : ''}
                        {Math.round(entry.kcal)} kcal • {Math.round(entry.protein_g)}g protein
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatPoints(entry.points)}</span>
                      <button
                        onClick={() => onDelete(entry.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 pb-3">
                <p className="text-xs text-muted-foreground py-1">Inget loggat</p>
              </div>
            )}

            {entries.length > 0 && savingMealType === mealType && (
              <div className="px-4 py-3 border-t border-border/50 space-y-2 animate-scale-in">
                <Input
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder="Namn på favoritmåltid"
                  className="h-11 rounded-xl"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSaveMealAsFavorite(mealType)}
                    disabled={savingMeal || !mealName}
                    className="flex-1 h-11 rounded-xl"
                  >
                    {savingMeal ? 'Sparar...' : 'Spara'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setSavingMealType(null); setMealName(''); }}
                    className="h-11 rounded-xl"
                  >
                    Avbryt
                  </Button>
                </div>
              </div>
            )}

            {entries.length > 0 && savingMealType !== mealType && (
              <button
                onClick={() => { setSavingMealType(mealType); setMealName(`${MEAL_LABELS[mealType]} ${new Date().toLocaleDateString('sv-SE')}`); }}
                className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-muted-foreground border-t border-border/50 hover:bg-muted/50 transition-colors w-full"
              >
                <Bookmark className="h-3 w-3" />
                Spara som favoritmåltid
              </button>
            )}

            {isToday && (
              <Link
                href={`/app/mat/sok?meal=${mealType}`}
                className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-primary border-t border-border/50 hover:bg-primary-lighter/50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Lägg till
              </Link>
            )}
          </div>
        );
      })}

      {editingEntry && (
        <EditLogEntrySheet
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onUpdated={handleEditClose}
        />
      )}
    </div>
  );
}
