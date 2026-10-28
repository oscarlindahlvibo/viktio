import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Weekday } from '@capacitor/local-notifications';

// Reminders are scheduled on the device itself, so they work without a push server.
export interface Reminder {
  id: number;
  label: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  weekday?: Weekday;
  enabled: boolean;
}

const STORAGE_KEY = 'viktio.reminders.v1';

export const DEFAULT_REMINDERS: Reminder[] = [
  { id: 101, label: 'Frukost', title: 'Dags för frukost', body: 'Logga din frukost så håller du koll på dagens poäng.', hour: 8, minute: 0, enabled: true },
  { id: 102, label: 'Lunch', title: 'Lunchdags', body: 'Glöm inte att logga lunchen.', hour: 12, minute: 0, enabled: true },
  { id: 103, label: 'Middag', title: 'Middag', body: 'Logga middagen – du ser direkt hur många poäng du har kvar.', hour: 18, minute: 0, enabled: true },
  { id: 104, label: 'Vatten', title: 'Drick ett glas vatten', body: 'Ett glas nu tar dig närmare dagens vattenmål.', hour: 15, minute: 0, enabled: false },
  { id: 105, label: 'Kvällens check-in', title: 'Hur var dagen?', body: 'Logga sömn, humör och vanor på en minut.', hour: 21, minute: 0, enabled: true },
  { id: 106, label: 'Veckovägning', title: 'Dags att väga dig', body: 'Samma tid varje vecka ger den mest rättvisande kurvan.', hour: 7, minute: 30, weekday: Weekday.Monday, enabled: true },
];

export const remindersSupported = () => Capacitor.isNativePlatform();

export function loadReminders(): Reminder[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Pick<Reminder, 'id' | 'hour' | 'minute' | 'enabled'>[] | null;
    if (!saved) return DEFAULT_REMINDERS;
    return DEFAULT_REMINDERS.map((r) => ({ ...r, ...saved.find((s) => s.id === r.id) }));
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export async function saveReminders(reminders: Reminder[]): Promise<boolean> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders.map(({ id, hour, minute, enabled }) => ({ id, hour, minute, enabled }))));
  } catch {
    // Storage unavailable; scheduling below still applies for this session.
  }
  if (!remindersSupported()) return false;

  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return false;

  await LocalNotifications.cancel({ notifications: DEFAULT_REMINDERS.map((r) => ({ id: r.id })) });
  const active = reminders.filter((r) => r.enabled);
  if (active.length > 0) {
    await LocalNotifications.schedule({
      notifications: active.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        schedule: { on: { hour: r.hour, minute: r.minute, ...(r.weekday ? { weekday: r.weekday } : {}) }, allowWhileIdle: true },
      })),
    });
  }
  return true;
}
