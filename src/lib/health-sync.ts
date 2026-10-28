import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { supabase } from '@/lib/supabase/client';
import { activityPoints } from '@/lib/activity';

const CONNECTED_KEY = 'viktio.health.connected';
const LAST_SYNC_KEY = 'viktio.health.lastSync';
const SYNC_DAYS = 7;

// Everyday walking is already part of the activity level in the budget, so only steps above
// this baseline earn activity points. ~40 kcal per 1 000 steps for a 75 kg person.
export const STEP_BASELINE = 6000;
const KCAL_PER_STEP_AT_75KG = 0.04;

export function stepKcal(steps: number, weightKg: number): number {
  return Math.round(Math.max(steps - STEP_BASELINE, 0) * KCAL_PER_STEP_AT_75KG * ((weightKg || 75) / 75));
}

export const healthPlatformName = () => (Capacitor.getPlatform() === 'android' ? 'Health Connect' : 'Apple Hälsa');

export async function isHealthAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await Health.isAvailable()).available;
  } catch {
    return false;
  }
}

export function isHealthConnected(): boolean {
  try {
    return localStorage.getItem(CONNECTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function lastHealthSync(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export async function connectHealth(): Promise<boolean> {
  const status = await Health.requestAuthorization({ read: ['steps', 'weight'] });
  // iOS never reveals denied read access, so treat the request itself as consent there.
  const ok = Capacitor.getPlatform() === 'ios' || status.readAuthorized.includes('steps');
  try {
    localStorage.setItem(CONNECTED_KEY, ok ? '1' : '0');
  } catch {
    // ignore
  }
  return ok;
}

export function disconnectHealth() {
  try {
    localStorage.removeItem(CONNECTED_KEY);
  } catch {
    // ignore
  }
}

const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Pulls steps and weight for the last week into daily check-ins, activity points and weight entries.
export async function syncHealth(userId: string, weightKg: number): Promise<{ days: number; weights: number }> {
  if (!isHealthConnected() || !(await isHealthAvailable())) return { days: 0, weights: 0 };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (SYNC_DAYS - 1));
  const range = { startDate: start.toISOString(), endDate: new Date().toISOString(), limit: 20000 };

  const { samples: stepSamples } = await Health.readSamples({ dataType: 'steps', ...range });
  const stepsByDay: Record<string, number> = {};
  for (const s of stepSamples) stepsByDay[localDate(s.startDate)] = (stepsByDay[localDate(s.startDate)] || 0) + s.value;

  const days = Object.keys(stepsByDay);
  if (days.length > 0) {
    await supabase.from('daily_checkins').upsert(
      days.map((date) => ({ user_id: userId, date, steps: Math.round(stepsByDay[date]), updated_at: new Date().toISOString() })),
      { onConflict: 'user_id,date' },
    );
    await supabase.from('activity_log').delete().eq('user_id', userId).eq('source', 'health_steps').in('logged_at', days);
    const rows = days
      .map((date) => {
        const kcal = stepKcal(stepsByDay[date], weightKg);
        return {
          user_id: userId,
          activity: `${Math.round(stepsByDay[date]).toLocaleString('sv-SE')} steg`,
          duration_min: 0,
          estimated_kcal: kcal,
          bonus_points: activityPoints(kcal),
          source: 'health_steps',
          logged_at: date,
        };
      })
      .filter((r) => r.estimated_kcal > 0);
    if (rows.length > 0) await supabase.from('activity_log').insert(rows);
  }

  const { samples: weightSamples } = await Health.readSamples({ dataType: 'weight', ...range, limit: 50 });
  let weights = 0;
  if (weightSamples.length > 0) {
    const { data: existing } = await supabase
      .from('weight_entries')
      .select('logged_at')
      .eq('user_id', userId)
      .eq('source', 'health')
      .gte('logged_at', range.startDate);
    const seen = new Set((existing ?? []).map((e) => new Date(e.logged_at).toISOString()));
    const fresh = weightSamples.filter((w) => !seen.has(new Date(w.startDate).toISOString()));
    if (fresh.length > 0) {
      await supabase.from('weight_entries').insert(
        fresh.map((w) => ({ user_id: userId, weight_kg: Math.round(w.value * 10) / 10, logged_at: w.startDate, source: 'health' })),
      );
      weights = fresh.length;
    }
  }

  try {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
  return { days: days.length, weights };
}
