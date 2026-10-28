import { supabase } from '@/lib/supabase/client';
import { callFunction } from '@/lib/api';
import { toLocalDate } from '@/lib/dates';

export const PRIVACY_POLICY_VERSION = '2026-10-29';

// Every table holding a user's personal data, keyed by the column that links it to the user.
const PERSONAL_TABLES: [table: string, userColumn: string][] = [
  ['profiles', 'id'],
  ['user_goals', 'user_id'],
  ['weight_entries', 'user_id'],
  ['measurements', 'user_id'],
  ['food_log', 'user_id'],
  ['activity_log', 'user_id'],
  ['saved_meals', 'user_id'],
  ['user_recipes', 'user_id'],
  ['workouts', 'user_id'],
  ['workout_sessions', 'user_id'],
  ['meal_plans', 'user_id'],
  ['shopping_lists', 'user_id'],
  ['ingredient_mappings', 'user_id'],
  ['daily_checkins', 'user_id'],
  ['habits', 'user_id'],
  ['habit_logs', 'user_id'],
];

export async function exportMyData(userId: string, email?: string) {
  const data: Record<string, unknown> = { exported_at: new Date().toISOString(), email };
  for (const [table, column] of PERSONAL_TABLES) {
    const { data: rows, error } = await supabase.from(table).select('*').eq(column, userId);
    if (!error) data[table] = rows;
  }
  const { data: foods } = await supabase.from('foods').select('*, food_nutrition(*)').eq('created_by', userId);
  data.my_foods = foods;
  const { data: recipes } = await supabase.from('recipes').select('*, recipe_ingredients(*)').eq('created_by', userId);
  data.my_recipes = recipes;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], `viktio-data-${toLocalDate()}.json`, { type: 'application/json' });
  // The native apps' web views can't download blobs, so hand the file to the share sheet there.
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Min Viktio-data' });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteMyAccount() {
  await callFunction<{ deleted: boolean }>('delete-account', {});
  await supabase.auth.signOut();
}
