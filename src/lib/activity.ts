import type { ActivityLogEntry } from '@/lib/types';

export type Intensity = 'low' | 'moderate' | 'high';

// MET values (Compendium of Physical Activities) at moderate intensity.
export const ACTIVITIES = [
  { name: 'Promenad', met: 3.5 },
  { name: 'Rask promenad', met: 4.5 },
  { name: 'Löpning', met: 9.0 },
  { name: 'Cykling', met: 7.0 },
  { name: 'Simning', met: 7.0 },
  { name: 'Styrketräning', met: 5.0 },
  { name: 'HIIT', met: 8.0 },
  { name: 'Yoga', met: 2.5 },
  { name: 'Dans', met: 5.0 },
  { name: 'Lagidrott', met: 7.0 },
  { name: 'Skidåkning', met: 7.0 },
  { name: 'Annan aktivitet', met: 4.0 },
] as const;

const INTENSITY_FACTOR: Record<Intensity, number> = { low: 0.75, moderate: 1, high: 1.3 };

// Activity earns half the points the same calories would cost as food, capped per day,
// so exercise helps without making it possible to "eat back" everything.
export const ACTIVITY_POINTS_PER_KCAL = 0.015;
export const MAX_DAILY_ACTIVITY_POINTS = 12;

export function metFor(activity: string): number {
  return ACTIVITIES.find((a) => a.name === activity)?.met ?? 4.0;
}

export function estimateKcal(met: number, weightKg: number, minutes: number, intensity: Intensity = 'moderate'): number {
  return Math.round(met * INTENSITY_FACTOR[intensity] * (weightKg || 75) * (minutes / 60));
}

export function activityPoints(kcal: number): number {
  return Math.round(kcal * ACTIVITY_POINTS_PER_KCAL * 10) / 10;
}

export function earnedActivityPoints(entries: Pick<ActivityLogEntry, 'bonus_points'>[]): number {
  const total = entries.reduce((sum, e) => sum + (e.bonus_points || 0), 0);
  return Math.min(Math.round(total * 10) / 10, MAX_DAILY_ACTIVITY_POINTS);
}
