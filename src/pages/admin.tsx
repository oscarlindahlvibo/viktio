
import { useState, useEffect } from 'react';
import { useRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Loader2, Shield, Database, Settings, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<'foods' | 'engine' | 'providers' | 'settings'>('foods');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(data === true));
  }, [user]);

  if (loading || (user && isAdmin === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <Shield className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Du har inte behörighet till adminsidan.</p>
        <button onClick={() => router.replace('/app')} className="text-sm text-primary">
          Tillbaka till appen
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Admin</h1>
          </div>
          <button
            onClick={() => router.push('/app')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Tillbaka till appen
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
          {[
            { key: 'foods', label: 'Matdatabas', icon: Database },
            { key: 'engine', label: 'Points-motor', icon: Settings },
            { key: 'providers', label: 'Leverantörer', icon: Package },
            { key: 'settings', label: 'Inställningar', icon: Settings },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border-2 transition-all',
                  tab === t.key
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-card',
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'foods' && <FoodsAdmin />}
        {tab === 'engine' && <EngineAdmin />}
        {tab === 'providers' && <ProvidersAdmin />}
        {tab === 'settings' && <SettingsAdmin />}
      </div>
    </div>
  );
}

function FoodsAdmin() {
  const [foods, setFoods] = useState<
    { id: string; name: string; brand: string | null; status: string; zero_point: boolean; barcode: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadFoods = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('foods')
      .select('id, name, brand, status, zero_point, barcode')
      .ilike('name', `%${search}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    setFoods(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(loadFoods, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Sök i matdatabasen..."
        className="w-full h-12 rounded-xl border border-border bg-card px-4 mb-4"
      />
      <p className="text-sm text-muted-foreground mb-3">{foods.length} livsmedel</p>
      <div className="space-y-2">
        {foods.map((f) => (
          <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
            <div>
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {f.brand && `${f.brand} • `}
                <span className={
                  f.status === 'verified' ? 'text-success' :
                  f.status === 'needs_review' ? 'text-warning' :
                  'text-muted-foreground'
                }>{f.status}</span>
                {f.barcode && ` • ${f.barcode}`}
              </p>
            </div>
            {f.zero_point && (
              <span className="px-2 py-1 rounded-full bg-primary-lighter text-primary text-xs font-bold">0p</span>
            )}
          </div>
        ))}
      </div>
      {loading && <p className="text-center text-muted-foreground py-4">Laddar...</p>}
    </div>
  );
}

function EngineAdmin() {
  const [versions, setVersions] = useState<
    { id: string; version: string; label: string; is_active: boolean; created_at: string }[]
  >([]);
  const [rules, setRules] = useState<
    { id: string; rule_key: string; rule_value: number }[]
  >([]);

  const load = async () => {
    const { data: v } = await supabase
      .from('point_engine_versions')
      .select('*')
      .order('created_at', { ascending: false });
    setVersions(v || []);

    if (v && v.length > 0) {
      const active = v.find((ver) => ver.is_active) || v[0];
      const { data: r } = await supabase
        .from('point_engine_rules')
        .select('id, rule_key, rule_value')
        .eq('engine_version_id', active.id);
      setRules(r || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleActivate = async (id: string) => {
    // Deactivate all, then activate selected
    await supabase
      .from('point_engine_versions')
      .update({ is_active: false })
      .neq('id', id);
    await supabase
      .from('point_engine_versions')
      .update({ is_active: true })
      .eq('id', id);
    toast.success('Motor aktiverad');
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-3">Points-motor versioner</h2>
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
              <div>
                <p className="font-medium">{v.label}</p>
                <p className="text-xs text-muted-foreground">{v.version}</p>
              </div>
              <div className="flex items-center gap-2">
                {v.is_active ? (
                  <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold">Aktiv</span>
                ) : (
                  <button
                    onClick={() => handleActivate(v.id)}
                    className="px-3 py-1 rounded-full bg-muted text-xs font-medium hover:bg-primary hover:text-white"
                  >
                    Aktivera
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Aktiva regler</h2>
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <code className="text-muted-foreground">{r.rule_key}</code>
                <span className="font-mono font-bold">{r.rule_value}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Ändra regler via SQL eller Supabase dashboard. Varje motorversion behåller historiska beräkningar.
        </p>
      </div>
    </div>
  );
}

function ProvidersAdmin() {
  const providers = [
    { name: 'ICA', status: 'Ej ansluten', color: 'text-muted-foreground' },
    { name: 'Coop', status: 'Ej ansluten', color: 'text-muted-foreground' },
    { name: 'City Gross', status: 'Ej ansluten', color: 'text-muted-foreground' },
    { name: 'Mathem', status: 'Ej ansluten', color: 'text-muted-foreground' },
    { name: 'Willys/Axfood', status: 'Ej ansluten', color: 'text-muted-foreground' },
    { name: 'Open Food Facts', status: 'Aktiv (skrivskydd)', color: 'text-success' },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">Leverantörer</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Externa matdatabaser och återförsäljare. Leverantörer utan API-anslutning visas som inaktiva utan att påverka appen.
      </p>
      <div className="space-y-2">
        {providers.map((p) => (
          <div key={p.name} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
            <span className="font-medium">{p.name}</span>
            <span className={`text-sm ${p.color}`}>{p.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsAdmin() {
  const [settings, setSettings] = useState<
    { key: string; value: string }[]
  >([]);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data }) => {
        if (data) {
          setSettings(data.map((s: { key: string; value: string }) => ({
            key: s.key,
            value: typeof s.value === 'string' ? s.value : JSON.stringify(s.value),
          })));
        }
      });
  }, []);

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">App-inställningar</h2>
      <div className="rounded-2xl bg-card border border-border p-4 space-y-2">
        {settings.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-sm">
            <code className="text-muted-foreground">{s.key}</code>
            <span className="font-mono">{s.value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Här kan du byta namn på &quot;points&quot; till något annat, ändra veckopoolens storlek och mer.
      </p>
    </div>
  );
}
