import { supabase } from '@/lib/supabase/client';
import {
  calculateAge,
  calculateBMI,
  calculateBMR,
  calculateCalorieTarget,
  calculateDailyPoints,
  calculateProteinTarget,
  calculateTDEE,
  calculateWeeklyPoints,
} from '@/lib/health';
import type { ActivityLevel, Sex, WeightLossPace } from '@/lib/types';

export interface GoalInput {
  sex: Sex;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  pace: WeightLossPace;
}

export function computeGoals(input: GoalInput) {
  const age = calculateAge(input.dateOfBirth);
  const bmr = calculateBMR(input.sex, input.weightKg, input.heightCm, age);
  const tdee = calculateTDEE(bmr, input.activityLevel);
  const calorieTarget = calculateCalorieTarget(tdee, input.pace);
  const dailyPoints = calculateDailyPoints(calorieTarget);
  return {
    bmi: calculateBMI(input.weightKg, input.heightCm),
    bmr,
    tdee,
    calorie_target: calorieTarget,
    daily_points_budget: dailyPoints,
    weekly_points_pool: calculateWeeklyPoints(dailyPoints),
    protein_target_g: calculateProteinTarget(input.weightKg),
  };
}

export async function saveGoals(userId: string, goals: ReturnType<typeof computeGoals>) {
  const { data: existing } = await supabase.from('user_goals').select('id').eq('user_id', userId).maybeSingle();
  const { error } = existing
    ? await supabase.from('user_goals').update({ ...goals, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await supabase.from('user_goals').insert({ user_id: userId, ...goals });
  if (error) throw error;
}

// Keeps the profile weight and the points budget in step with a newly logged weight.
export async function updateWeightAndGoals(userId: string, weightKg: number) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('sex, date_of_birth, height_cm, activity_level, weight_loss_pace')
    .eq('id', userId)
    .maybeSingle();
  await supabase.from('profiles').update({ current_weight_kg: weightKg }).eq('id', userId);
  if (!profile?.sex || !profile.date_of_birth || !profile.height_cm) return;
  await saveGoals(
    userId,
    computeGoals({
      sex: profile.sex,
      dateOfBirth: profile.date_of_birth,
      heightCm: profile.height_cm,
      weightKg,
      activityLevel: profile.activity_level ?? 'moderate',
      pace: profile.weight_loss_pace ?? 'moderate',
    }),
  );
}
