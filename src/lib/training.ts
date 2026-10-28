// Training programs and the logic behind strength sessions: weight suggestions and records.

export interface ProgramExercise {
  slug: string;
  sets: number;
  /** Target reps, e.g. "8–12", or seconds for timed exercises. */
  reps: string;
  timed?: boolean;
  restSec: number;
}

export interface ProgramDay {
  name: string;
  exercises: ProgramExercise[];
}

export interface Program {
  key: string;
  name: string;
  description: string;
  level: 'beginner' | 'intermediate';
  location: 'home' | 'gym';
  perWeek: number;
  minutes: number;
  days: ProgramDay[];
}

const ex = (slug: string, sets: number, reps: string, restSec = 75, timed = false): ProgramExercise => ({ slug, sets, reps, restSec, timed });

export const PROGRAMS: Program[] = [
  {
    key: 'home-start',
    name: 'Hemma – kom igång',
    description: 'Helkropp med kroppsvikt. Perfekt start om du inte tränat på ett tag.',
    level: 'beginner',
    location: 'home',
    perWeek: 3,
    minutes: 25,
    days: [
      { name: 'Pass A', exercises: [ex('knaboj', 3, '10–15'), ex('armhavningar-kna', 3, '6–12'), ex('hoftlyft', 3, '12–15'), ex('plankan', 3, '20–40', 45, true), ex('hampelmannen', 2, '30', 45, true)] },
      { name: 'Pass B', exercises: [ex('utfall', 3, '8–12'), ex('dips-stol', 3, '8–12'), ex('superman', 3, '10–12'), ex('dead-bug', 3, '8–12'), ex('vaggsittning', 2, '30–45', 60, true)] },
    ],
  },
  {
    key: 'home-hiit',
    name: 'Hemma – styrka & HIIT',
    description: 'Tuffare hemmaprogram som kombinerar styrka och pulshöjande intervaller.',
    level: 'intermediate',
    location: 'home',
    perWeek: 3,
    minutes: 35,
    days: [
      { name: 'Ben & bål', exercises: [ex('bulgarisk-utfallsbojning', 3, '8–12'), ex('goblet-squat', 3, '10–15'), ex('rumansk-marklyft', 3, '10–12'), ex('mountain-climbers', 3, '30', 30, true), ex('sidoplanka', 3, '30', 30, true)] },
      { name: 'Överkropp & puls', exercises: [ex('armhavningar', 4, '8–15'), ex('hantelrodd', 3, '10–12'), ex('axelpress', 3, '8–12'), ex('burpees', 3, '30', 45, true), ex('plankan', 3, '45', 30, true)] },
      { name: 'Helkropp', exercises: [ex('kettlebell-swing', 4, '15'), ex('knaboj', 3, '15–20'), ex('hantelpress', 3, '10–12'), ex('hopprep', 4, '45', 30, true), ex('dead-bug', 3, '10–12')] },
    ],
  },
  {
    key: 'gym-fullbody',
    name: 'Gym – helkropp',
    description: 'Tre helkroppspass i veckan med basövningar. Bygger styrka och förbränning.',
    level: 'beginner',
    location: 'gym',
    perWeek: 3,
    minutes: 45,
    days: [
      { name: 'Pass A', exercises: [ex('benpress', 3, '10–12', 90), ex('hantelpress', 3, '8–12', 90), ex('latsdrag', 3, '10–12', 90), ex('larcurl', 2, '10–12'), ex('plankan', 3, '30–45', 45, true)] },
      { name: 'Pass B', exercises: [ex('goblet-squat', 3, '10–12', 90), ex('sittande-rodd', 3, '10–12', 90), ex('axelpress', 3, '8–12', 90), ex('hoftlyft', 3, '12–15'), ex('dead-bug', 3, '10')] },
    ],
  },
  {
    key: 'gym-upper-lower',
    name: 'Gym – över/underkropp',
    description: 'Fyra pass i veckan för dig som vill bli starkare. Tunga basövningar med progression.',
    level: 'intermediate',
    location: 'gym',
    perWeek: 4,
    minutes: 55,
    days: [
      { name: 'Underkropp 1', exercises: [ex('knaboj-skivstang', 4, '6–8', 150), ex('rumansk-marklyft', 3, '8–10', 120), ex('benpress', 3, '10–12', 90), ex('tahavningar', 3, '12–15', 60), ex('plankan', 3, '45', 45, true)] },
      { name: 'Överkropp 1', exercises: [ex('bankpress', 4, '6–8', 150), ex('latsdrag', 4, '8–10', 90), ex('axelpress', 3, '8–10', 90), ex('sittande-rodd', 3, '10–12', 90), ex('triceps-pushdown', 2, '12–15', 60)] },
      { name: 'Underkropp 2', exercises: [ex('marklyft', 4, '5–6', 180), ex('bulgarisk-utfallsbojning', 3, '8–10', 90), ex('hip-thrust', 3, '8–12', 90), ex('larcurl', 3, '10–12', 60), ex('sidoplanka', 3, '30', 30, true)] },
      { name: 'Överkropp 2', exercises: [ex('hantelpress', 4, '8–10', 120), ex('chins', 3, '5–10', 120), ex('hantelrodd', 3, '10–12', 90), ex('sidolyft', 3, '12–15', 60), ex('bicepscurl', 2, '10–12', 60)] },
    ],
  },
];

export const programByKey = (key: string | null | undefined) => PROGRAMS.find((p) => p.key === key) ?? null;

export function topOfRange(reps: string): number {
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  return nums.length ? Math.max(...nums) : 0;
}

export interface LoggedSet {
  reps: number | null;
  weight_kg: number | null;
}

// Double progression: when every set reached the top of the rep range, add weight next time.
export function suggestWeight(previous: LoggedSet[], reps: string): number | null {
  const weights = previous.map((s) => s.weight_kg ?? 0).filter((w) => w > 0);
  if (weights.length === 0) return null;
  const last = Math.max(...weights);
  const top = topOfRange(reps);
  const allTop = previous.length > 0 && previous.every((s) => (s.reps ?? 0) >= top);
  if (!allTop) return last;
  return Math.round((last + (last >= 40 ? 2.5 : 1)) * 2) / 2;
}

// Epley estimate of a one-rep max, used to compare sets with different reps.
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (!weightKg || !reps) return 0;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function sessionMet(categories: string[]): number {
  if (categories.length === 0) return 5;
  const hiitShare = categories.filter((c) => c === 'hiit').length / categories.length;
  return 5 + hiitShare * 3;
}
