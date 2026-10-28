import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/lib/types';

const CATEGORY_LABELS: Record<string, string> = {
  strength: 'Styrka',
  core: 'Bål',
  hiit: 'Intervall',
  cardio: 'Kondition',
  mobility: 'Rörlighet',
};
const LEVEL_LABELS: Record<string, string> = { beginner: 'Nybörjare', intermediate: 'Medel', advanced: 'Avancerad' };
const LOCATION_LABELS: Record<string, string> = { home: 'Hemma', gym: 'Gym', both: 'Hemma & gym', outdoors: 'Utomhus' };

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  useEffect(() => {
    supabase
      .from('exercises')
      .select('*')
      .not('slug', 'is', null)
      .order('name')
      .then(({ data }) => setExercises((data as Exercise[]) ?? []));
  }, []);
  return exercises;
}

export function ExerciseDetail({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end justify-center animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-t-3xl p-5 pb-10 animate-slide-up max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold">{exercise.name}</h2>
            <p className="text-xs text-muted-foreground">
              {exercise.muscle_group} · {exercise.equipment || 'Inget'} · {exercise.level ? LEVEL_LABELS[exercise.level] : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        {exercise.description && <p className="text-sm text-muted-foreground mb-4">{exercise.description}</p>}
        <h3 className="text-sm font-semibold mb-2">Så gör du</h3>
        <ol className="space-y-2">
          {exercise.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-lighter text-primary text-xs font-bold">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function ExerciseLibrary({ onPick }: { onPick?: (exercise: Exercise) => void }) {
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [selected, setSelected] = useState<Exercise | null>(null);

  const filtered = useMemo(
    () =>
      exercises.filter(
        (e) =>
          (category === 'all' || e.category === category) &&
          (!query || `${e.name} ${e.muscle_group ?? ''}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [exercises, query, category],
  );

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök övning eller muskel" className="pl-9 h-11 rounded-xl" />
      </div>
      <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
        {['all', ...Object.keys(CATEGORY_LABELS)].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap', category === c ? 'bg-foreground text-background border-foreground' : 'border-border')}
          >
            {c === 'all' ? 'Alla' : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((ex) => (
          <button
            key={ex.id}
            onClick={() => (onPick ? onPick(ex) : setSelected(ex))}
            className="w-full text-left p-3 rounded-2xl bg-card border border-border flex items-center justify-between gap-3"
          >
            <div>
              <p className="font-medium text-sm">{ex.name}</p>
              <p className="text-xs text-muted-foreground">
                {ex.muscle_group} · {ex.location ? LOCATION_LABELS[ex.location] : ''}
              </p>
            </div>
            <span className="px-2 py-1 rounded-full bg-muted text-xs font-medium">{CATEGORY_LABELS[ex.category] ?? ex.category}</span>
          </button>
        ))}
      </div>
      {selected && <ExerciseDetail exercise={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
