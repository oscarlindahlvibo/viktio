
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useDailyData, usePointEngineConfig, calculateMealTotals, groupByMeal, MEAL_LABELS } from '@/hooks/use-daily-data';
import { PointsRing } from '@/components/points-ring';
import { QuickActions } from '@/components/quick-actions';
import { MealTimeline } from '@/components/meal-timeline';
import { DateSelector } from '@/components/date-selector';
import { supabase } from '@/lib/supabase/client';
import { formatPoints } from '@/lib/points';
import { earnedActivityPoints } from '@/lib/activity';
import { Loader2, Dumbbell, Flame, Settings } from 'lucide-react';
import { Link } from '@/lib/navigation';
import { toast } from 'sonner';

function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { logEntries, activityEntries, goal, loading, reload } = useDailyData(date);
  usePointEngineConfig();

  const totals = useMemo(() => calculateMealTotals(logEntries), [logEntries]);
  const meals = useMemo(() => groupByMeal(logEntries), [logEntries]);

  const activityPointsEarned = earnedActivityPoints(activityEntries);
  const baseBudget = goal?.daily_points_budget || 30;
  const dailyBudget = baseBudget + activityPointsEarned;
  const weeklyPool = goal?.weekly_points_pool || 0;
  const usedPoints = totals.points;
  const remainingPoints = Math.max(dailyBudget - usedPoints, 0);
  const proteinTarget = goal?.protein_target_g || 0;
  const proteinUsed = totals.protein;

  // Weekly pool: points eaten above each day's budget (incl. earned activity points), Monday–Sunday.
  const [weeklyOverage, setWeeklyOverage] = useState(0);
  useEffect(() => {
    if (!profile) return;
    const weekStart = mondayOf(date);
    Promise.all([
      supabase.from('food_log').select('points, logged_at').eq('user_id', profile.id).gte('logged_at', weekStart).lte('logged_at', date),
      supabase.from('activity_log').select('bonus_points, logged_at').eq('user_id', profile.id).gte('logged_at', weekStart).lte('logged_at', date),
    ]).then(([food, activity]) => {
      const eaten: Record<string, number> = {};
      (food.data ?? []).forEach((e: { points: number; logged_at: string }) => {
        eaten[e.logged_at] = (eaten[e.logged_at] || 0) + e.points;
      });
      const earned: Record<string, { bonus_points: number }[]> = {};
      (activity.data ?? []).forEach((a: { bonus_points: number; logged_at: string }) => {
        (earned[a.logged_at] ||= []).push(a);
      });
      const overage = Object.entries(eaten).reduce(
        (sum, [day, points]) => sum + Math.max(points - baseBudget - earnedActivityPoints(earned[day] ?? []), 0),
        0,
      );
      setWeeklyOverage(overage);
    });
  }, [profile, date, baseBudget, logEntries, activityEntries]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 10) return 'God morgon';
    if (hour < 13) return 'God dag';
    if (hour < 18) return 'God eftermiddag';
    return 'God kväll';
  }, []);

  const handleDeleteEntry = async (id: string) => {
    const { error } = await supabase.from('food_log').delete().eq('id', id);
    if (error) {
      toast.error('Kunde inte ta bort');
    } else {
      toast.success('Borttagen');
      reload();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activityKcal = activityEntries.reduce((sum, a) => sum + a.estimated_kcal, 0);

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Greeting */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="text-2xl font-bold">{profile?.first_name || 'Hej'}</h1>
        </div>
        <Link href="/app/profil" className="flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border tap-scale">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Link>
      </div>

      {/* Date selector */}
      <DateSelector date={date} onChange={setDate} />

      {/* Points Ring */}
      <div className="flex justify-center mb-6 mt-4">
        <PointsRing
          used={usedPoints}
          budget={dailyBudget}
          remaining={remainingPoints}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Använda</p>
          <p className="text-lg font-bold">{formatPoints(usedPoints)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Kvar</p>
          <p className="text-lg font-bold text-primary">{formatPoints(remainingPoints)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Veckopool</p>
          <p className="text-lg font-bold">{formatPoints(Math.max(weeklyPool - weeklyOverage, 0))}</p>
        </div>
      </div>

      {/* Protein progress */}
      <div className="rounded-2xl bg-card border border-border p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Protein</span>
          <span className="text-sm font-bold">
            {Math.round(proteinUsed)} / {Math.round(proteinTarget)} g
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min((proteinUsed / (proteinTarget || 1)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Activity summary */}
      {activityEntries.length > 0 && (
        <div className="rounded-2xl bg-primary-lighter p-4 mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Dumbbell className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">Träning idag</p>
            <p className="text-xs text-primary/70">
              {activityEntries.length} aktivitet{activityEntries.length > 1 ? 'er' : ''} • {Math.round(activityKcal)} kcal
              {activityPointsEarned > 0 && ` • +${formatPoints(activityPointsEarned)} points`}
            </p>
          </div>
          <Flame className="h-5 w-5 text-primary/50" />
        </div>
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Meal Timeline */}
      <div className="mt-6">
        <h2 className="text-lg font-bold mb-3">Dagens måltider</h2>
        <MealTimeline
          meals={meals}
          onDelete={handleDeleteEntry}
          date={date}
          onUpdated={reload}
        />
      </div>
    </div>
  );
}
