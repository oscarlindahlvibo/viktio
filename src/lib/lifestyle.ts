import { toLocalDate } from './dates';

// Lifestyle tracking: water goal, habit streaks and the daily life score.

export const GLASS_ML = 250;

export function waterGoalMl(weightKg: number | null | undefined): number {
  const ml = (weightKg || 70) * 30;
  return Math.min(Math.max(Math.round(ml / GLASS_ML) * GLASS_ML, 1500), 3500);
}

export const MOOD_EMOJI = ['😞', '🙁', '😐', '🙂', '😄'];
export const STRESS_LABELS = ['Mycket låg', 'Låg', 'Medel', 'Hög', 'Mycket hög'];

export const HABIT_SUGGESTIONS = [
  { name: 'Grönsaker till varje måltid', icon: '🥦' },
  { name: '10 minuters promenad efter middagen', icon: '🚶' },
  { name: 'Frukt istället för godis', icon: '🍎' },
  { name: 'Ingen skärm sista timmen före sömn', icon: '📵' },
  { name: 'Ett glas vatten före varje måltid', icon: '💧' },
  { name: 'Stretcha 5 minuter', icon: '🧘' },
  { name: 'Planera morgondagens måltider', icon: '📝' },
  { name: 'Ät långsamt, utan mobil', icon: '🍽️' },
];

const toDate = (d: string) => new Date(`${d}T12:00:00`);
const addDays = (d: string, n: number) => {
  const x = toDate(d);
  x.setDate(x.getDate() + n);
  return toLocalDate(x);
};

// Consecutive days up to today; an unchecked today doesn't break a streak that ran until yesterday.
export function streak(dates: Iterable<string>, today: string): number {
  const set = new Set(dates);
  let day = set.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (set.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export interface LifeScoreInput {
  pointsUsed: number;
  pointsBudget: number;
  foodLogged: boolean;
  waterMl: number;
  waterGoalMl: number;
  sleepHours: number | null;
  steps: number | null;
  activeMinutes: number;
  habitsDone: number;
  habitsTotal: number;
}

export interface LifeScore {
  score: number;
  parts: { key: string; label: string; value: number; max: number }[];
}

export function lifeScore(i: LifeScoreInput): LifeScore {
  const over = Math.max(i.pointsUsed - i.pointsBudget, 0);
  const food = i.foodLogged ? Math.max(30 - over * 2, 0) : 0;
  const water = Math.min(i.waterMl / (i.waterGoalMl || 2000), 1) * 15;
  const sleep =
    i.sleepHours == null ? 0 : i.sleepHours >= 7 && i.sleepHours <= 9 ? 20 : i.sleepHours >= 6 && i.sleepHours <= 10 ? 12 : 5;
  const movement = Math.min(Math.max((i.steps ?? 0) / 8000, i.activeMinutes / 30), 1) * 20;
  const habits = i.habitsTotal > 0 ? (i.habitsDone / i.habitsTotal) * 15 : 0;

  const parts = [
    { key: 'food', label: 'Mat', value: food, max: 30 },
    { key: 'water', label: 'Vatten', value: water, max: 15 },
    { key: 'sleep', label: 'Sömn', value: sleep, max: 20 },
    { key: 'movement', label: 'Rörelse', value: movement, max: 20 },
    ...(i.habitsTotal > 0 ? [{ key: 'habits', label: 'Vanor', value: habits, max: 15 }] : []),
  ];
  const max = parts.reduce((s, p) => s + p.max, 0);
  const total = parts.reduce((s, p) => s + p.value, 0);
  return { score: Math.round((total / max) * 100), parts: parts.map((p) => ({ ...p, value: Math.round(p.value) })) };
}
