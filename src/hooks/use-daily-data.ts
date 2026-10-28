
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { FoodLogEntry, UserGoal, ActivityLogEntry } from '@/lib/types';
import { setPointEngineConfig } from '@/lib/points';
import type { PointEngineConfig } from '@/lib/types';

const METRIC_KEYS = ['calorie_weight','protein_weight','sugar_weight','saturated_fat_weight','fat_weight','fiber_weight','sodium_weight','min_points','round_precision','points_per_100g_divisor'] as const;

export function useDailyData(date: string) {
  const { user } = useAuth();
  const [logEntries, setLogEntries] = useState<FoodLogEntry[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityLogEntry[]>([]);
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [logRes, activityRes, goalRes] = await Promise.all([
      supabase
        .from('food_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('logged_at', date)
        .order('created_at', { ascending: true }),
      supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('logged_at', date)
        .order('created_at', { ascending: true }),
      supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    setLogEntries((logRes.data as FoodLogEntry[]) || []);
    setActivityEntries((activityRes.data as ActivityLogEntry[]) || []);
    setGoal((goalRes.data as UserGoal) || null);
    setLoading(false);
  }, [user, date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { logEntries, activityEntries, goal, loading, reload: loadData };
}

export function usePointEngineConfig() {
  const [config, setConfig] = useState<PointEngineConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: version } = await supabase
          .from('point_engine_versions')
          .select('id, version, label')
          .eq('is_active', true)
          .maybeSingle();

        if (!version) {
          setLoading(false);
          return;
        }

        const { data: rules } = await supabase
          .from('point_engine_rules')
          .select('rule_key, rule_value')
          .eq('engine_version_id', version.id);

        const ruleMap: Record<string, number> = {};
        (rules || []).forEach((r: { rule_key: string; rule_value: number }) => {
          ruleMap[r.rule_key] = r.rule_value;
        });

        const cfg: PointEngineConfig = {
          version: version.version,
          rules: ruleMap,
        };
        setConfig(cfg);
        setPointEngineConfig(cfg);
      } catch {
        // Use default config
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { config, loading };
}

export function useGoals() {
  const { user } = useAuth();
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setGoal(data as UserGoal);
        setLoading(false);
      });
  }, [user]);

  return { goal, loading };
}

export type MealTotals = {
  points: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export function calculateMealTotals(entries: FoodLogEntry[]): MealTotals {
  return entries.reduce(
    (acc, e) => ({
      points: acc.points + e.points,
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein_g,
      carbs: acc.carbs + e.carbohydrate_g,
      fat: acc.fat + e.fat_g,
      fiber: acc.fiber + e.fiber_g,
    }),
    { points: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

export function groupByMeal(entries: FoodLogEntry[]) {
  return {
    breakfast: entries.filter((e) => e.meal_type === 'breakfast'),
    lunch: entries.filter((e) => e.meal_type === 'lunch'),
    dinner: entries.filter((e) => e.meal_type === 'dinner'),
    snack: entries.filter((e) => e.meal_type === 'snack'),
  };
}

export const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Frukost',
  lunch: 'Lunch',
  dinner: 'Middag',
  snack: 'Mellanmål',
};

export const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};
