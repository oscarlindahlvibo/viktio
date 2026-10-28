import { useEffect, useState } from 'react';
import { HeartPulse, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import {
  connectHealth,
  disconnectHealth,
  healthPlatformName,
  isHealthAvailable,
  isHealthConnected,
  lastHealthSync,
  STEP_BASELINE,
  syncHealth,
} from '@/lib/health-sync';

export function HealthSettings() {
  const { user, profile } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(isHealthConnected);
  const [busy, setBusy] = useState(false);
  const name = healthPlatformName();

  useEffect(() => {
    isHealthAvailable().then(setAvailable);
  }, []);

  const handleConnect = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const ok = await connectHealth();
      setConnected(ok);
      if (!ok) {
        toast.error(`Viktio fick inte tillgång till ${name}`);
        return;
      }
      const result = await syncHealth(user.id, profile?.current_weight_kg ?? 75);
      toast.success(`${name} kopplat – ${result.days} dagar synkade`);
    } catch {
      toast.error(`Kunde inte koppla ${name}`);
    } finally {
      setBusy(false);
    }
  };

  const sync = lastHealthSync();

  return (
    <Card className="p-5 rounded-2xl mb-4">
      <div className="flex items-center gap-2 mb-1">
        <HeartPulse className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{name}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Hämtar steg och vikt automatiskt. Steg över {STEP_BASELINE.toLocaleString('sv-SE')} per dag ger extra poäng.
      </p>
      {available === false ? (
        <p className="text-sm text-muted-foreground">Finns i Viktio-appen för iPhone och Android.</p>
      ) : connected ? (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm">
            Kopplat{sync && <span className="text-muted-foreground"> · synkat {new Date(sync).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}</span>}
          </p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { disconnectHealth(); setConnected(false); }}>
            Koppla från
          </Button>
        </div>
      ) : (
        <Button onClick={handleConnect} disabled={busy || available === null} className="w-full h-11 rounded-xl">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Koppla ${name}`}
        </Button>
      )}
    </Card>
  );
}
