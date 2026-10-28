import { useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { loadReminders, remindersSupported, saveReminders, type Reminder } from '@/lib/reminders';

const pad = (n: number) => String(n).padStart(2, '0');

export function ReminderSettings() {
  const [reminders, setReminders] = useState<Reminder[]>(loadReminders);
  const [dirty, setDirty] = useState(false);

  const update = (id: number, patch: Partial<Reminder>) => {
    setReminders((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const handleSave = async () => {
    const scheduled = await saveReminders(reminders);
    setDirty(false);
    if (scheduled) toast.success('Påminnelser sparade');
    else if (remindersSupported()) toast.error('Tillåt notiser för Viktio i telefonens inställningar');
  };

  return (
    <Card className="p-5 rounded-2xl mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Påminnelser</h2>
      </div>
      {!remindersSupported() && (
        <p className="text-xs text-muted-foreground mb-3">Påminnelser fungerar i Viktio-appen för iPhone och Android.</p>
      )}
      <div className="divide-y divide-border">
        {reminders.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{r.label}</p>
              {r.weekday && <p className="text-xs text-muted-foreground">Varje måndag</p>}
            </div>
            <input
              type="time"
              value={`${pad(r.hour)}:${pad(r.minute)}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (Number.isFinite(h) && Number.isFinite(m)) update(r.id, { hour: h, minute: m });
              }}
              className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
            />
            <Switch checked={r.enabled} onCheckedChange={(v) => update(r.id, { enabled: v })} />
          </div>
        ))}
      </div>
      {dirty && (
        <Button onClick={handleSave} className="w-full h-11 rounded-xl mt-3">
          Spara påminnelser
        </Button>
      )}
    </Card>
  );
}
