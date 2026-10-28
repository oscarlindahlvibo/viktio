import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { streak } from '@/lib/lifestyle';
import type { DailyCheckin, Habit } from '@/lib/types';
import { toLocalDate } from '@/lib/dates';

export function useLifestyle(date: string) {
  const { user } = useAuth();
  const [checkin, setCheckin] = useState<Partial<DailyCheckin>>({});
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitDates, setHabitDates] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const since = new Date(`${date}T12:00:00`);
    since.setDate(since.getDate() - 90);
    const [c, h, l] = await Promise.all([
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', date).maybeSingle(),
      supabase.from('habits').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
      supabase.from('habit_logs').select('habit_id, date').eq('user_id', user.id).gte('date', toLocalDate(since)),
    ]);
    setCheckin((c.data as DailyCheckin) ?? {});
    setHabits((h.data as Habit[]) ?? []);
    const byHabit: Record<string, string[]> = {};
    (l.data ?? []).forEach((r: { habit_id: string; date: string }) => (byHabit[r.habit_id] ||= []).push(r.date));
    setHabitDates(byHabit);
    setLoading(false);
  }, [user, date]);

  useEffect(() => {
    load();
  }, [load]);

  const updateCheckin = async (patch: Partial<DailyCheckin>) => {
    if (!user) return;
    setCheckin((c) => ({ ...c, ...patch }));
    await supabase
      .from('daily_checkins')
      .upsert({ user_id: user.id, date, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' });
  };

  const toggleHabit = async (habitId: string) => {
    if (!user) return;
    const done = habitDates[habitId]?.includes(date);
    setHabitDates((m) => ({ ...m, [habitId]: done ? (m[habitId] ?? []).filter((d) => d !== date) : [...(m[habitId] ?? []), date] }));
    if (done) await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', date);
    else await supabase.from('habit_logs').insert({ habit_id: habitId, user_id: user.id, date });
  };

  const addHabit = async (name: string, icon?: string) => {
    if (!user || !name.trim()) return;
    await supabase.from('habits').insert({ user_id: user.id, name: name.trim(), icon: icon ?? '✅' });
    load();
  };

  const removeHabit = async (habitId: string) => {
    await supabase.from('habits').update({ active: false }).eq('id', habitId);
    setHabits((list) => list.filter((h) => h.id !== habitId));
  };

  const habitsDoneToday = habits.filter((h) => habitDates[h.id]?.includes(date)).length;
  const streakFor = (habitId: string) => streak(habitDates[habitId] ?? [], date);

  return { checkin, habits, habitDates, habitsDoneToday, streakFor, loading, updateCheckin, toggleHabit, addHabit, removeHabit, reload: load };
}
