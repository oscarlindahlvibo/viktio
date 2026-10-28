import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock, Dumbbell, Home, Play } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { PROGRAMS, programByKey, type Program } from '@/lib/training';

export function useActiveProgram() {
  const { user } = useAuth();
  const [state, setState] = useState<{ program: Program | null; nextDay: number; loading: boolean }>({ program: null, nextDay: 0, loading: true });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('training_programs').select('program_key, next_day').eq('user_id', user.id).maybeSingle();
    setState({ program: programByKey(data?.program_key), nextDay: data?.next_day ?? 0, loading: false });
  };

  useEffect(() => {
    load();
  }, [user]);

  return { ...state, reload: load };
}

export function NextSessionCard({ program, nextDay }: { program: Program; nextDay: number }) {
  const day = program.days[nextDay % program.days.length];
  return (
    <div className="rounded-2xl bg-primary p-4 text-white mb-4">
      <p className="text-xs text-white/70 mb-1">{program.name}</p>
      <p className="text-lg font-bold mb-1">Nästa pass: {day.name}</p>
      <p className="text-xs text-white/80 mb-3">
        {day.exercises.length} övningar · ca {program.minutes} min
      </p>
      <Link
        href={`/app/traning/pass?program=${program.key}&day=${nextDay % program.days.length}`}
        className="inline-flex items-center gap-2 rounded-xl bg-white text-primary px-4 py-2 text-sm font-semibold"
      >
        <Play className="h-4 w-4" /> Starta pass
      </Link>
    </div>
  );
}

export function ProgramTab() {
  const { user } = useAuth();
  const { program: active, nextDay, reload } = useActiveProgram();
  const [filter, setFilter] = useState<'all' | 'home' | 'gym'>('all');

  const choose = async (program: Program) => {
    if (!user) return;
    const { error } = await supabase
      .from('training_programs')
      .upsert({ user_id: user.id, program_key: program.key, next_day: 0, started_at: new Date().toISOString() });
    if (error) {
      toast.error('Kunde inte välja program');
      return;
    }
    toast.success(`${program.name} är ditt program`);
    reload();
  };

  const visible = PROGRAMS.filter((p) => filter === 'all' || p.location === filter);

  return (
    <div>
      {active && <NextSessionCard program={active} nextDay={nextDay} />}

      <div className="flex gap-2 mb-3">
        {(['all', 'home', 'gym'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border', filter === f ? 'bg-foreground text-background border-foreground' : 'border-border')}
          >
            {f === 'all' ? 'Alla' : f === 'home' ? 'Hemma' : 'Gym'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((p) => {
          const isActive = active?.key === p.key;
          return (
            <div key={p.key} className={cn('rounded-2xl border p-4 bg-card', isActive ? 'border-primary' : 'border-border')}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                {isActive && <Check className="h-5 w-5 text-primary flex-shrink-0" />}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{p.perWeek} pass/vecka</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />ca {p.minutes} min</span>
                <span className="flex items-center gap-1">{p.location === 'home' ? <Home className="h-3 w-3" /> : <Dumbbell className="h-3 w-3" />}{p.location === 'home' ? 'Hemma' : 'Gym'}</span>
                <span>{p.level === 'beginner' ? 'Nybörjare' : 'Van'}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {p.days.map((d) => (
                  <span key={d.name} className="px-2 py-0.5 rounded-full bg-muted text-xs">{d.name}</span>
                ))}
              </div>
              {!isActive && (
                <Button variant="outline" className="w-full rounded-xl h-10" onClick={() => choose(p)}>
                  Välj program
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Link href="/app/traning/pass" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
        <Play className="h-4 w-4" /> Starta ett eget pass
      </Link>
    </div>
  );
}
