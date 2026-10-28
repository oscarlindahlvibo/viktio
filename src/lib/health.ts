import type { Sex, ActivityLevel, WeightLossPace } from './types';

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const PACE_DEFICITS: Record<WeightLossPace, number> = {
  slow: 250,
  moderate: 500,
  fast: 750,
};

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!heightCm || !weightKg) return 0;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function calculateBMR(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  if (!weightKg || !heightCm || !ageYears) return 0;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activity]);
}

export function calculateCalorieTarget(tdee: number, pace: WeightLossPace): number {
  return Math.max(tdee - PACE_DEFICITS[pace], 1200);
}

// About 100 kcal of everyday food costs 3 points; zero-point foods (vegetables, fruit, lean protein)
// are expected to cover roughly a quarter of the calorie target.
const POINTS_PER_KCAL = 0.03;
const SHARE_FROM_POINT_FOODS = 0.75;
export const MIN_DAILY_POINTS = 23;
export const MAX_DAILY_POINTS = 60;

export function calculateDailyPoints(calorieTarget: number): number {
  const points = Math.round(calorieTarget * SHARE_FROM_POINT_FOODS * POINTS_PER_KCAL);
  return Math.min(Math.max(points, MIN_DAILY_POINTS), MAX_DAILY_POINTS);
}

export function calculateProteinTarget(weightKg: number): number {
  return Math.round(weightKg * 1.6);
}

export function calculateWeeklyPoints(dailyPoints: number): number {
  return Math.round(dailyPoints * 0.4);
}

export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function estimateProgress(
  currentWeight: number,
  targetWeight: number,
  pace: WeightLossPace,
): { weeksToGoal: number; weeklyChange: number } {
  const weeklyChange = PACE_DEFICITS[pace] / 7700;
  const diff = currentWeight - targetWeight;
  const weeksToGoal = weeklyChange > 0 ? Math.ceil(diff / weeklyChange) : 0;
  return { weeksToGoal, weeklyChange: Math.round(weeklyChange * 100) / 100 };
}

export function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Undervikt', color: 'text-blue-500' };
  if (bmi < 25) return { label: 'Normalvikt', color: 'text-green-500' };
  if (bmi < 30) return { label: 'Övervikt', color: 'text-amber-500' };
  return { label: 'Fetma', color: 'text-red-500' };
}
