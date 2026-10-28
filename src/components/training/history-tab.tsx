import { useEffect, useMemo, useState } from 'react';
import { Clock, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { estimatedOneRepMax } from '@/lib/training';
import type { TrainingSession, TrainingSet } from '@/lib/types';

export function HistoryTab() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [sets, setSets] = useState<TrainingSet[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', user.id)
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setSessions((data as TrainingSession[]) ?? []));
    supabase
      .from('training_sets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(({ data }) => setSets((data as TrainingSet[]) ?? []));
  }, [user]);

  // Best set per exercise, ranked by estimated one-rep max.
  const records = useMemo(() => {
    const best: Record<string, { name: string; weight: number; reps: number; e1rm: number; date: string }> = {};
    for (const s of sets) {
      if (!s.weight_kg || !s.reps) continue;
      const e1rm = estimatedOneRepMax(s.weight_kg, s.reps);
      if (!best[s.exercise_slug] || e1rm > best[s.exercise_slug].e1rm) {
        best[s.exercise_slug] = { name: s.exercise_name, weight: s.weight_kg, reps: s.reps, e1rm, date: s.created_at };
      }
    }
    return Object.values(best).sort((a, b) => b.e1rm - a.e1rm);
  }, [sets]);

  const setsBySession = useMemo(() => {
    const map: Record<string, TrainingSet[]> = {};
    for (const s of sets) (map[s.session_id] ||= []).push(s);
    return map;
  }, [sets]);

  if (sessions.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-12">Inga pass ännu. Starta ett pass under Program.</p>;
  }

  return (
    <div className="space-y-6">
      {records.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />Personliga rekord</h2>
          <div className="grid grid-cols-2 gap-2">
            {records.slice(0, 8).map((r) => (
              <div key={r.name} className="rounded-2xl bg-card border border-border p-3">
                <p className="text-xs text-muted-foreground truncate">{r.name}</p>
                <p className="font-bold">{r.weight} kg × {r.reps}</p>
                <p className="text-[11px] text-muted-foreground">≈ {r.e1rm} kg max</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-2">Senaste passen</h2>
        <div className="space-y-2">
          {sessions.map((s) => {
            const ss = setsBySession[s.id] ?? [];
            const exercises = [...new Set(ss.map((x) => x.exercise_name))];
            const volume = ss.reduce((sum, x) => sum + (x.weight_kg ?? 0) * (x.reps ?? 0), 0);
            return (
              <div key={s.id} className="rounded-2xl bg-card border border-border p-3">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.started_at).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.duration_min} min</span>
                  <span>{ss.length} set</span>
                  {volume > 0 && <span>{Math.round(volume).toLocaleString('sv-SE')} kg totalt</span>}
                </p>
                {exercises.length > 0 && <p className="text-xs text-muted-foreground mt-1 truncate">{exercises.join(', ')}</p>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
