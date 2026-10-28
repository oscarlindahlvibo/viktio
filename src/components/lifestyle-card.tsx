import { ChevronRight, Droplets, Moon, Footprints } from 'lucide-react';
import { Link } from '@/lib/navigation';
import { GLASS_ML, lifeScore, MOOD_EMOJI, waterGoalMl } from '@/lib/lifestyle';
import { useLifestyle } from '@/hooks/use-lifestyle';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={6} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="fill-none stroke-primary transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{score}</span>
    </div>
  );
}

interface Props {
  date: string;
  pointsUsed: number;
  pointsBudget: number;
  foodLogged: boolean;
  activeMinutes: number;
}

export function LifestyleCard({ date, pointsUsed, pointsBudget, foodLogged, activeMinutes }: Props) {
  const { profile } = useAuth();
  const { checkin, habits, habitsDoneToday, updateCheckin } = useLifestyle(date);
  const goal = waterGoalMl(profile?.current_weight_kg);
  const water = checkin.water_ml ?? 0;
  const glasses = Math.round(goal / GLASS_ML);
  const { score } = lifeScore({
    pointsUsed,
    pointsBudget,
    foodLogged,
    waterMl: water,
    waterGoalMl: goal,
    sleepHours: checkin.sleep_hours ?? null,
    steps: checkin.steps ?? null,
    activeMinutes,
    habitsDone: habitsDoneToday,
    habitsTotal: habits.length,
  });

  return (
    <div className="rounded-2xl bg-card border border-border p-4 mb-4">
      <Link href={`/app/livsstil?date=${date}`} className="flex items-center gap-4 mb-3">
        <ScoreRing score={score} />
        <div className="flex-1">
          <p className="font-semibold">Livsstilspoäng</p>
          <p className="text-xs text-muted-foreground">Mat, vatten, sömn, rörelse och vanor</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>

      <div className="flex items-center gap-2 mb-3">
        <Droplets className="h-4 w-4 text-chart-2 flex-shrink-0" />
        <div className="flex flex-1 flex-wrap gap-1">
          {Array.from({ length: glasses }, (_, i) => (
            <button
              key={i}
              aria-label={`${i + 1} glas`}
              onClick={() => updateCheckin({ water_ml: (i + 1) * GLASS_ML === water ? i * GLASS_ML : (i + 1) * GLASS_ML })}
              className={cn('h-6 w-4 rounded-sm border', (i + 1) * GLASS_ML <= water ? 'bg-chart-2 border-chart-2' : 'border-border')}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{(water / 1000).toFixed(1).replace('.', ',')} / {(goal / 1000).toFixed(1).replace('.', ',')} l</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Link href={`/app/livsstil?date=${date}`} className="rounded-xl bg-muted/60 p-2">
          <Moon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          {checkin.sleep_hours != null ? `${String(checkin.sleep_hours).replace('.', ',')} h` : 'Sömn'}
        </Link>
        <Link href={`/app/livsstil?date=${date}`} className="rounded-xl bg-muted/60 p-2">
          <span className="block text-base leading-4 mb-1">{checkin.mood ? MOOD_EMOJI[checkin.mood - 1] : '🙂'}</span>
          {checkin.mood ? 'Humör' : 'Hur mår du?'}
        </Link>
        <Link href={`/app/livsstil?date=${date}`} className="rounded-xl bg-muted/60 p-2">
          <Footprints className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          {checkin.steps != null ? checkin.steps.toLocaleString('sv-SE') : 'Steg'}
        </Link>
      </div>
      {habits.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">Vanor idag: {habitsDoneToday} av {habits.length}</p>
      )}
    </div>
  );
}
