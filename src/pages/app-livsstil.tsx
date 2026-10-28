import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Droplets, Flame, Minus, Moon, Plus, Ruler, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useLifestyle } from '@/hooks/use-lifestyle';
import { useDailyData, calculateMealTotals } from '@/hooks/use-daily-data';
import { earnedActivityPoints } from '@/lib/activity';
import { GLASS_ML, HABIT_SUGGESTIONS, lifeScore, MOOD_EMOJI, STRESS_LABELS, waterGoalMl } from '@/lib/lifestyle';
import { ScoreRing } from '@/components/lifestyle-card';

const today = () => new Date().toISOString().slice(0, 10);

export default function LifestylePage() {
  const router = useRouter();
  const params = useSearchParams();
  const date = params.get('date') || today();
  const { profile } = useAuth();
  const life = useLifestyle(date);
  const daily = useDailyData(date);
  const [newHabit, setNewHabit] = useState('');
  const [stepsInput, setStepsInput] = useState('');

  const { checkin } = life;
  const goal = waterGoalMl(profile?.current_weight_kg);
  const water = checkin.water_ml ?? 0;
  const totals = calculateMealTotals(daily.logEntries);
  const budget = (daily.goal?.daily_points_budget || 30) + earnedActivityPoints(daily.activityEntries);

  const score = lifeScore({
    pointsUsed: totals.points,
    pointsBudget: budget,
    foodLogged: daily.logEntries.length > 0,
    waterMl: water,
    waterGoalMl: goal,
    sleepHours: checkin.sleep_hours ?? null,
    steps: checkin.steps ?? null,
    activeMinutes: daily.activityEntries.reduce((s, a) => s + a.duration_min, 0),
    habitsDone: life.habitsDoneToday,
    habitsTotal: life.habits.length,
  });

  useEffect(() => {
    setStepsInput(checkin.steps != null ? String(checkin.steps) : '');
  }, [checkin.steps]);

  const unusedSuggestions = HABIT_SUGGESTIONS.filter((s) => !life.habits.some((h) => h.name === s.name));

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Livsstil</h1>
          <p className="text-xs text-muted-foreground">
            {date === today() ? 'Idag' : new Date(`${date}T12:00:00`).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Score */}
      <Card className="p-5 rounded-2xl mb-4">
        <div className="flex items-center gap-4 mb-4">
          <ScoreRing score={score.score} size={80} />
          <div>
            <p className="font-semibold">Livsstilspoäng</p>
            <p className="text-xs text-muted-foreground">Hur balanserad dagen är – mat, vatten, sömn, rörelse och vanor.</p>
          </div>
        </div>
        <div className="space-y-2">
          {score.parts.map((p) => (
            <div key={p.key} className="flex items-center gap-3 text-sm">
              <span className="w-16 text-muted-foreground">{p.label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(p.value / p.max) * 100}%` }} />
              </div>
              <span className="w-12 text-right text-xs">{p.value}/{p.max}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Water */}
      <Card className="p-5 rounded-2xl mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Droplets className="h-4 w-4 text-chart-2" />
          <h2 className="font-semibold flex-1">Vatten</h2>
          <span className="text-sm text-muted-foreground">mål {(goal / 1000).toFixed(2).replace('.', ',')} l</span>
        </div>
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" className="rounded-xl h-12 w-12" onClick={() => life.updateCheckin({ water_ml: Math.max(water - GLASS_ML, 0) })}>
            <Minus className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-3xl font-bold">{water / GLASS_ML}</p>
            <p className="text-xs text-muted-foreground">glas à 2,5 dl</p>
          </div>
          <Button size="icon" className="rounded-xl h-12 w-12" onClick={() => life.updateCheckin({ water_ml: water + GLASS_ML })}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      {/* Sleep */}
      <Card className="p-5 rounded-2xl mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Moon className="h-4 w-4 text-primary" />
          <h2 className="font-semibold flex-1">Sömn i natt</h2>
          <span className="text-lg font-bold">{checkin.sleep_hours != null ? `${String(checkin.sleep_hours).replace('.', ',')} h` : '–'}</span>
        </div>
        <input
          type="range"
          min={3}
          max={12}
          step={0.5}
          value={checkin.sleep_hours ?? 7.5}
          onChange={(e) => life.updateCheckin({ sleep_hours: parseFloat(e.target.value) })}
          className="w-full accent-[hsl(var(--primary))]"
        />
        <p className="text-xs text-muted-foreground mt-3 mb-2">Hur sov du?</p>
        <ScaleButtons value={checkin.sleep_quality ?? null} labels={['Dåligt', '', 'Okej', '', 'Mycket bra']} onChange={(v) => life.updateCheckin({ sleep_quality: v })} />
      </Card>

      {/* Mood & stress */}
      <Card className="p-5 rounded-2xl mb-4">
        <h2 className="font-semibold mb-3">Humör</h2>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {MOOD_EMOJI.map((emoji, i) => (
            <button
              key={i}
              onClick={() => life.updateCheckin({ mood: i + 1 })}
              className={cn('h-12 rounded-xl text-2xl border-2', checkin.mood === i + 1 ? 'border-primary bg-primary-lighter' : 'border-border')}
            >
              {emoji}
            </button>
          ))}
        </div>
        <h2 className="font-semibold mb-2">Stress</h2>
        <ScaleButtons value={checkin.stress ?? null} labels={STRESS_LABELS} onChange={(v) => life.updateCheckin({ stress: v })} />
      </Card>

      {/* Steps */}
      <Card className="p-5 rounded-2xl mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Steg</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-2">Hämtas automatiskt om du kopplat Apple Hälsa eller Health Connect under Profil.</p>
        <div className="flex gap-2">
          <Input inputMode="numeric" value={stepsInput} onChange={(e) => setStepsInput(e.target.value)} placeholder="Antal steg" className="h-11 rounded-xl" />
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => {
              const n = parseInt(stepsInput.replace(/\s/g, ''));
              if (Number.isFinite(n)) life.updateCheckin({ steps: n }).then(() => toast.success('Steg sparade'));
            }}
          >
            Spara
          </Button>
        </div>
      </Card>

      {/* Habits */}
      <Card className="p-5 rounded-2xl mb-4">
        <h2 className="font-semibold mb-3">Vanor</h2>
        {life.habits.length === 0 && <p className="text-sm text-muted-foreground mb-3">Små vanor gör stor skillnad. Välj en eller två att börja med.</p>}
        <div className="space-y-2 mb-3">
          {life.habits.map((h) => {
            const done = life.habitDates[h.id]?.includes(date);
            const s = life.streakFor(h.id);
            return (
              <div key={h.id} className="flex items-center gap-3">
                <button
                  onClick={() => life.toggleHabit(h.id)}
                  className={cn('flex-1 flex items-center gap-3 p-3 rounded-xl border-2 text-left text-sm', done ? 'border-primary bg-primary-lighter' : 'border-border')}
                >
                  <span className="text-lg">{h.icon ?? '✅'}</span>
                  <span className="flex-1">{h.name}</span>
                  {s > 0 && <span className="text-xs font-semibold text-primary">🔥 {s}</span>}
                </button>
                <button onClick={() => life.removeHabit(h.id)} className="p-2 text-muted-foreground" aria-label="Ta bort vana">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
        {unusedSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {unusedSuggestions.slice(0, 6).map((s) => (
              <button key={s.name} onClick={() => life.addHabit(s.name, s.icon)} className="px-3 py-1.5 rounded-full border border-border text-xs">
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} placeholder="Egen vana" className="h-11 rounded-xl" />
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => {
              life.addHabit(newHabit);
              setNewHabit('');
            }}
          >
            Lägg till
          </Button>
        </div>
      </Card>

      <Measurements />
    </div>
  );
}

function ScaleButtons({ value, labels, onChange }: { value: number | null; labels: string[]; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} onClick={() => onChange(v)} className={cn('h-10 rounded-xl border-2 text-sm font-medium', value === v ? 'border-primary bg-primary text-white' : 'border-border')}>
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

const MEASURES = [
  { key: 'waist_cm', label: 'Midja', unit: 'cm' },
  { key: 'hip_cm', label: 'Höft', unit: 'cm' },
  { key: 'chest_cm', label: 'Bröst', unit: 'cm' },
  { key: 'arm_cm', label: 'Överarm', unit: 'cm' },
  { key: 'thigh_cm', label: 'Lår', unit: 'cm' },
  { key: 'body_fat_pct', label: 'Fettprocent', unit: '%' },
] as const;

type MeasureKey = (typeof MEASURES)[number]['key'];
type Measurement = { id: string; logged_at: string } & Partial<Record<MeasureKey, number | null>>;

function Measurements() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Measurement[]>([]);
  const [form, setForm] = useState<Partial<Record<MeasureKey, string>>>({});
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('measurements').select('*').eq('user_id', user.id).order('logged_at', { ascending: true });
    setRows((data as Measurement[]) ?? []);
  };

  useEffect(() => {
    load();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const values = Object.fromEntries(
      Object.entries(form)
        .map(([k, v]) => [k, parseFloat(String(v).replace(',', '.'))])
        .filter(([, v]) => Number.isFinite(v)),
    );
    if (Object.keys(values).length === 0) return;
    const { error } = await supabase.from('measurements').insert({ user_id: user.id, ...values });
    if (error) {
      toast.error('Kunde inte spara måtten');
      return;
    }
    toast.success('Mått sparade');
    setForm({});
    setOpen(false);
    load();
  };

  // Change since the first measurement, per measure.
  const changes = useMemo(
    () =>
      MEASURES.map((m) => {
        const values = rows.map((r) => r[m.key]).filter((v): v is number => v != null);
        if (values.length === 0) return null;
        return { ...m, latest: values[values.length - 1], change: values.length > 1 ? values[values.length - 1] - values[0] : null };
      }).filter(Boolean) as { key: string; label: string; unit: string; latest: number; change: number | null }[],
    [rows],
  );

  return (
    <Card className="p-5 rounded-2xl mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Ruler className="h-4 w-4 text-primary" />
        <h2 className="font-semibold flex-1">Kroppsmått</h2>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOpen(!open)}>
          {open ? 'Stäng' : 'Mät nu'}
        </Button>
      </div>
      {changes.length === 0 && !open && <p className="text-sm text-muted-foreground">Mått visar framsteg även när vågen står still. Mät en gång i månaden.</p>}
      {changes.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {changes.map((c) => (
            <div key={c.key} className="rounded-xl bg-muted/60 p-2 text-center">
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
              <p className="font-bold text-sm">{String(c.latest).replace('.', ',')} {c.unit}</p>
              {c.change != null && c.change !== 0 && (
                <p className={cn('text-[11px] font-medium', c.change < 0 ? 'text-primary' : 'text-muted-foreground')}>
                  {c.change > 0 ? '+' : ''}{String(Math.round(c.change * 10) / 10).replace('.', ',')} {c.unit}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {open && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {MEASURES.map((m) => (
              <label key={m.key} className="text-xs text-muted-foreground">
                {m.label} ({m.unit})
                <Input inputMode="decimal" value={form[m.key] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [m.key]: e.target.value }))} className="h-10 rounded-xl mt-1" />
              </label>
            ))}
          </div>
          <Button className="w-full h-11 rounded-xl" onClick={save}>Spara mått</Button>
        </div>
      )}
    </Card>
  );
}
