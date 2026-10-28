import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Info, Loader2, Plus, Timer, Trash2, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { activityPoints, estimateKcal } from '@/lib/activity';
import { formatPoints } from '@/lib/points';
import { estimatedOneRepMax, programByKey, sessionMet, suggestWeight, type ProgramExercise } from '@/lib/training';
import { ExerciseDetail, ExerciseLibrary, useExercises } from '@/components/training/exercise-library';
import type { Exercise, TrainingSet } from '@/lib/types';

interface SetRow {
  reps: string;
  weight: string;
  done: boolean;
}

interface SessionExercise {
  slug: string;
  name: string;
  category: string;
  target: string;
  timed: boolean;
  restSec: number;
  suggestion: number | null;
  previous: string | null;
  sets: SetRow[];
}

const DRAFT_KEY = 'viktio.training.draft.v1';

function readDraft(key: string): { startedAt: string; exercises: SessionExercise[] } | null {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    return draft?.key === key ? draft : null;
  } catch {
    return null;
  }
}

export default function TrainingSessionPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const programKey = params.get('program');
  const dayIndex = Number(params.get('day') ?? 0);
  const program = programByKey(programKey);
  const day = program?.days[dayIndex] ?? null;
  const draftKey = `${programKey ?? 'free'}:${dayIndex}`;

  const library = useExercises();
  const [exercises, setExercises] = useState<SessionExercise[] | null>(null);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [picking, setPicking] = useState(false);
  const [info, setInfo] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ minutes: number; points: number; kcal: number; records: string[] } | null>(null);
  const history = useRef<TrainingSet[]>([]);

  const bySlug = useMemo(() => Object.fromEntries(library.map((e) => [e.slug, e])), [library]);

  const buildExercise = (pe: ProgramExercise, ex: Exercise | undefined): SessionExercise => {
    const prevSets = latestSessionSets(history.current, pe.slug);
    const suggestion = pe.timed ? null : suggestWeight(prevSets, pe.reps);
    return {
      slug: pe.slug,
      name: ex?.name ?? pe.slug,
      category: ex?.category ?? 'strength',
      target: pe.reps,
      timed: !!pe.timed,
      restSec: pe.restSec,
      suggestion,
      previous: prevSets.length
        ? prevSets.map((s) => (s.weight_kg ? `${s.weight_kg}×${s.reps}` : `${s.reps}`)).join(', ')
        : null,
      sets: Array.from({ length: pe.sets }, () => ({ reps: '', weight: suggestion ? String(suggestion) : '', done: false })),
    };
  };

  // Load history once the library is ready, then restore a draft or build from the program.
  useEffect(() => {
    if (!user || library.length === 0 || exercises) return;
    (async () => {
      const { data } = await supabase
        .from('training_sets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000);
      history.current = (data as TrainingSet[]) ?? [];

      const draft = readDraft(draftKey);
      if (draft) {
        setStartedAt(draft.startedAt);
        setExercises(draft.exercises);
        return;
      }
      setExercises(day ? day.exercises.map((pe) => buildExercise(pe, bySlug[pe.slug])) : []);
    })();
  }, [user, library]);

  useEffect(() => {
    if (!exercises) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ key: draftKey, startedAt, exercises }));
    } catch {
      // Draft persistence is best effort.
    }
  }, [exercises]);

  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= rest.endsAt) {
        setRest(null);
        navigator.vibrate?.(300);
        toast('Vilan är slut – nästa set!');
      }
    }, 250);
    return () => clearInterval(id);
  }, [rest]);

  const updateSet = (ei: number, si: number, patch: Partial<SetRow>) => {
    setExercises((list) =>
      list!.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })),
    );
  };

  const toggleDone = (ei: number, si: number) => {
    const ex = exercises![ei];
    const set = ex.sets[si];
    if (!set.done && !set.reps) updateSet(ei, si, { reps: String(parseInt(ex.target) || '') });
    updateSet(ei, si, { done: !set.done });
    if (!set.done) setRest({ endsAt: Date.now() + ex.restSec * 1000, total: ex.restSec });
  };

  const addExercise = (ex: Exercise) => {
    setPicking(false);
    const pe: ProgramExercise = { slug: ex.slug!, sets: 3, reps: ex.category === 'core' || ex.category === 'hiit' ? '30' : '8–12', restSec: 75, timed: ex.category === 'core' || ex.category === 'hiit' };
    setExercises((list) => [...(list ?? []), buildExercise(pe, ex)]);
  };

  const discard = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    router.replace('/app/traning');
  };

  const finish = async () => {
    if (!user || !exercises) return;
    const done = exercises.flatMap((e) => e.sets.filter((s) => s.done).map((s, i) => ({ e, s, i })));
    if (done.length === 0) {
      toast.error('Bocka av minst ett set först');
      return;
    }
    setSaving(true);
    try {
      const minutes = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
      const met = sessionMet(exercises.filter((e) => e.sets.some((s) => s.done)).map((e) => e.category));
      const kcal = estimateKcal(met, profile?.current_weight_kg ?? 75, Math.min(minutes, 120));
      const points = activityPoints(kcal);
      const name = day ? `${program!.name}: ${day.name}` : 'Eget pass';

      const { data: activity } = await supabase
        .from('activity_log')
        .insert({ user_id: user.id, activity: name, duration_min: minutes, intensity: 'moderate', estimated_kcal: kcal, bonus_points: points, source: 'training', logged_at: new Date().toISOString().slice(0, 10) })
        .select('id')
        .single();

      const { data: session, error } = await supabase
        .from('training_sessions')
        .insert({ user_id: user.id, name, program_key: programKey, program_day: day ? dayIndex : null, started_at: startedAt, finished_at: new Date().toISOString(), duration_min: minutes, activity_log_id: activity?.id ?? null })
        .select('id')
        .single();
      if (error || !session) throw error;

      await supabase.from('training_sets').insert(
        exercises.flatMap((e) =>
          e.sets
            .filter((s) => s.done)
            .map((s, i) => ({
              session_id: session.id,
              user_id: user.id,
              exercise_slug: e.slug,
              exercise_name: e.name,
              set_number: i + 1,
              reps: e.timed ? null : parseInt(s.reps) || null,
              duration_sec: e.timed ? parseInt(s.reps) || null : null,
              weight_kg: parseFloat(s.weight.replace(',', '.')) || null,
            })),
        ),
      );

      if (program && day) {
        await supabase.from('training_programs').update({ next_day: (dayIndex + 1) % program.days.length }).eq('user_id', user.id);
      }

      // New personal records compared with everything logged before this session.
      const records: string[] = [];
      for (const e of exercises) {
        const best = Math.max(0, ...e.sets.filter((s) => s.done).map((s) => estimatedOneRepMax(parseFloat(s.weight.replace(',', '.')) || 0, parseInt(s.reps) || 0)));
        const before = Math.max(0, ...history.current.filter((h) => h.exercise_slug === e.slug).map((h) => estimatedOneRepMax(h.weight_kg ?? 0, h.reps ?? 0)));
        if (best > 0 && best > before && before > 0) records.push(e.name);
      }

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      setSummary({ minutes, points, kcal, records });
    } catch {
      toast.error('Kunde inte spara passet');
    } finally {
      setSaving(false);
    }
  };

  if (summary) {
    return (
      <div className="px-4 pt-16 pb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold mb-1">Bra jobbat!</h1>
        <p className="text-muted-foreground mb-6">Passet är sparat.</p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Tid" value={`${summary.minutes} min`} />
          <Stat label="kcal" value={String(summary.kcal)} />
          <Stat label="Points" value={`+${formatPoints(summary.points)}`} highlight />
        </div>
        {summary.records.length > 0 && (
          <div className="rounded-2xl bg-primary-lighter p-4 mb-6 text-left">
            <p className="font-semibold text-primary flex items-center gap-2 mb-1"><Trophy className="h-4 w-4" />Nya personliga rekord</p>
            <p className="text-sm text-primary/80">{summary.records.join(', ')}</p>
          </div>
        )}
        <Button className="w-full h-12 rounded-xl" onClick={() => router.replace('/app/traning')}>Klar</Button>
      </div>
    );
  }

  if (!exercises) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const doneSets = exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;

  return (
    <div className="px-4 pt-6 pb-40">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-bold">{day?.name ?? 'Eget pass'}</p>
          {program && <p className="text-xs text-muted-foreground">{program.name}</p>}
        </div>
        <button onClick={discard} className="p-2 -mr-2 rounded-xl hover:bg-muted text-muted-foreground" aria-label="Avbryt pass">
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-muted mb-5 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
      </div>

      <div className="space-y-4">
        {exercises.map((e, ei) => (
          <div key={`${e.slug}-${ei}`} className="rounded-2xl bg-card border border-border p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="font-semibold">{e.name}</p>
                <p className="text-xs text-muted-foreground">
                  {e.sets.length} × {e.target} {e.timed ? 'sek' : 'reps'} · vila {e.restSec} s
                </p>
              </div>
              {bySlug[e.slug] && (
                <button onClick={() => setInfo(bySlug[e.slug])} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Instruktioner">
                  <Info className="h-4 w-4" />
                </button>
              )}
            </div>
            {(e.previous || e.suggestion) && (
              <p className="text-xs text-primary mb-2">
                {e.previous && <>Förra gången: {e.previous}</>}
                {e.suggestion && <> · Förslag: {e.suggestion} kg</>}
              </p>
            )}
            <div className="space-y-2 mt-2">
              <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 text-[11px] text-muted-foreground px-1">
                <span>Set</span>
                {!e.timed && <span>kg</span>}
                <span className={e.timed ? 'col-span-2' : ''}>{e.timed ? 'Sekunder' : 'Reps'}</span>
                <span />
              </div>
              {e.sets.map((s, si) => (
                <div key={si} className={cn('grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center', s.done && 'opacity-70')}>
                  <span className="text-sm font-medium text-center">{si + 1}</span>
                  {!e.timed && (
                    <input
                      inputMode="decimal"
                      value={s.weight}
                      placeholder="–"
                      onChange={(ev) => updateSet(ei, si, { weight: ev.target.value })}
                      className="h-10 rounded-lg border border-border bg-background text-center text-sm"
                    />
                  )}
                  <input
                    inputMode="numeric"
                    value={s.reps}
                    placeholder={e.target}
                    onChange={(ev) => updateSet(ei, si, { reps: ev.target.value })}
                    className={cn('h-10 rounded-lg border border-border bg-background text-center text-sm', e.timed && 'col-span-2')}
                  />
                  <button
                    onClick={() => toggleDone(ei, si)}
                    className={cn('h-10 w-10 rounded-lg flex items-center justify-center border', s.done ? 'bg-primary border-primary text-white' : 'border-border')}
                    aria-label="Klart"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setExercises((list) => list!.map((x, i) => (i === ei ? { ...x, sets: [...x.sets, { reps: '', weight: x.sets[x.sets.length - 1]?.weight ?? '', done: false }] } : x)))}
                className="text-xs text-primary font-medium mt-1"
              >
                + Lägg till set
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setPicking(true)} className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
        <Plus className="h-4 w-4" /> Lägg till övning
      </button>

      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40 space-y-2">
        {rest && (
          <div className="rounded-2xl bg-foreground text-background p-3 flex items-center gap-3 shadow-lg">
            <Timer className="h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Vila {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}</p>
              <div className="h-1 rounded-full bg-background/20 mt-1 overflow-hidden">
                <div className="h-full bg-background" style={{ width: `${(restLeft / rest.total) * 100}%` }} />
              </div>
            </div>
            <button onClick={() => setRest({ ...rest, endsAt: rest.endsAt + 15000, total: rest.total + 15 })} className="text-xs font-medium px-2">+15 s</button>
            <button onClick={() => setRest(null)} className="text-xs font-medium px-2">Hoppa över</button>
          </div>
        )}
        <Button onClick={finish} disabled={saving} className="w-full h-12 rounded-xl text-base font-semibold shadow-lg">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : `Avsluta pass (${doneSets}/${totalSets} set)`}
        </Button>
      </div>

      {picking && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end justify-center" onClick={() => setPicking(false)}>
          <div className="w-full max-w-md bg-background rounded-t-3xl p-5 pb-10 max-h-[85vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Lägg till övning</h2>
              <button onClick={() => setPicking(false)} className="p-2 rounded-xl hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <ExerciseLibrary onPick={addExercise} />
          </div>
        </div>
      )}
      {info && <ExerciseDetail exercise={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold', highlight && 'text-primary')}>{value}</p>
    </div>
  );
}

// The sets from the most recent session that included the exercise.
function latestSessionSets(history: TrainingSet[], slug: string) {
  const latest = history.find((h) => h.exercise_slug === slug);
  if (!latest) return [];
  return history
    .filter((h) => h.session_id === latest.session_id && h.exercise_slug === slug)
    .sort((a, b) => a.set_number - b.set_number)
    .map((h) => ({ reps: h.reps ?? h.duration_sec, weight_kg: h.weight_kg }));
}
