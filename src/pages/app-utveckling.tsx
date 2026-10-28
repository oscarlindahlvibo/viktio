
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { updateWeightAndGoals } from '@/lib/goals';
import { useAuth } from '@/components/providers/auth-provider';
import type { WeightEntry, Profile, UserGoal } from '@/lib/types';
import { Plus, TrendingDown, Target, Award, X, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import { calculateBMI, bmiCategory } from '@/lib/health';

export default function DevelopmentPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'weight' | 'progress'>('weight');

  // Add weight form
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [note, setNote] = useState('');

  const loadWeightEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: true });
    setWeightEntries((data as WeightEntry[]) || []);

    const { data: g } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setGoal(g as UserGoal);
    setLoading(false);
  };

  useEffect(() => {
    loadWeightEntries();
  }, [user]);

  const handleAddWeight = async () => {
    if (!user || !weight) return;
    const { error } = await supabase.from('weight_entries').insert({
      user_id: user.id,
      weight_kg: parseFloat(weight),
      waist_cm: waist ? parseFloat(waist) : null,
      note: note || null,
      logged_at: new Date().toISOString(),
    });

    if (error) {
      toast.error('Kunde inte spara');
    } else {
      // A new weight changes the calorie target, so the points budget follows it.
      await updateWeightAndGoals(user.id, parseFloat(weight)).catch(() => undefined);
      await refreshProfile();
      toast.success('Vikt sparad!');
      setShowAdd(false);
      setWeight('');
      setWaist('');
      setNote('');
      loadWeightEntries();
    }
  };

  const handleDeleteWeight = async (id: string) => {
    await supabase.from('weight_entries').delete().eq('id', id);
    loadWeightEntries();
    toast.success('Borttagen');
  };

  const chartData = useMemo(() => {
    return weightEntries.map((e) => ({
      date: new Date(e.logged_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
      weight: parseFloat(e.weight_kg.toFixed(1)),
    }));
  }, [weightEntries]);

  const currentWeight = weightEntries.length > 0
    ? parseFloat(weightEntries[weightEntries.length - 1].weight_kg.toFixed(1))
    : profile?.current_weight_kg || 0;
  const startWeight = weightEntries.length > 0
    ? parseFloat(weightEntries[0].weight_kg.toFixed(1))
    : profile?.current_weight_kg || 0;
  const targetWeight = profile?.target_weight_kg || 0;
  const totalLost = Math.round((startWeight - currentWeight) * 10) / 10;
  const toGoal = Math.round((currentWeight - targetWeight) * 10) / 10;
  const bmi = profile ? calculateBMI(currentWeight, profile.height_cm || 0) : 0;
  const bmiCat = bmiCategory(bmi);

  const milestones = [
    { label: '-5 kg', achieved: totalLost >= 5 },
    { label: '-10 kg', achieved: totalLost >= 10 },
    { label: '5% av kroppsvikt', achieved: totalLost >= startWeight * 0.05 },
    { label: '10% av kroppsvikt', achieved: totalLost >= startWeight * 0.1 },
    { label: 'Målvikt', achieved: currentWeight <= targetWeight },
  ];

  // Weekly report data
  const weeklyReport = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().slice(0, 10);
    return {
      startDate,
      weightChange: weightEntries.length >= 2
        ? Math.round((currentWeight - (weightEntries[Math.max(0, weightEntries.length - 8)]?.weight_kg || currentWeight)) * 10) / 10
        : 0,
    };
  }, [weightEntries, currentWeight]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Laddar...</div>;
  }

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Utveckling</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('weight')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${tab === 'weight' ? 'bg-primary text-white' : 'bg-muted'}`}
        >
          Vikt
        </button>
        <button
          onClick={() => setTab('progress')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${tab === 'progress' ? 'bg-primary text-white' : 'bg-muted'}`}
        >
          Veckorapport
        </button>
      </div>

      {tab === 'weight' && (
        <>
          {/* Weight summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-2xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Startvikt</p>
              <p className="text-lg font-bold">{startWeight}</p>
              <p className="text-xs text-muted-foreground">kg</p>
            </div>
            <div className="rounded-2xl bg-primary-lighter p-3 text-center">
              <p className="text-xs text-primary mb-1">Idag</p>
              <p className="text-lg font-bold text-primary">{currentWeight}</p>
              <p className="text-xs text-primary">kg</p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Målvikt</p>
              <p className="text-lg font-bold">{targetWeight}</p>
              <p className="text-xs text-muted-foreground">kg</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="rounded-2xl bg-card border border-border p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium flex items-center gap-1">
                <TrendingDown className="h-4 w-4 text-success" />
                {totalLost > 0 ? `−${totalLost} kg` : `${totalLost} kg`}
              </span>
              <span className="text-sm text-muted-foreground">
                {toGoal > 0 ? `${toGoal} kg kvar` : 'Mål uppnått!'}
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{
                  width: `${Math.min((totalLost / Math.max(startWeight - targetWeight, 0.1)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 1 && (
            <div className="rounded-2xl bg-card border border-border p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3">Viktkurva</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* BMI */}
          {bmi > 0 && (
            <div className="rounded-2xl bg-card border border-border p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">BMI</span>
                <span className={`text-sm font-bold ${bmiCat.color}`}>{bmi} – {bmiCat.label}</span>
              </div>
            </div>
          )}

          {/* Milestones */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Milstolpar
            </h3>
            <div className="space-y-2">
              {milestones.map((m) => (
                <div
                  key={m.label}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    m.achieved ? 'bg-primary-lighter border-primary/30' : 'bg-card border-border'
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    m.achieved ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {m.achieved ? '✓' : '○'}
                  </div>
                  <span className={`text-sm font-medium ${m.achieved ? 'text-primary' : 'text-muted-foreground'}`}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={() => setShowAdd(true)} className="w-full h-12 rounded-xl mb-4">
            <Plus className="h-5 w-5 mr-2" />
            Logga vikt
          </Button>

          {/* Recent entries */}
          <div className="space-y-2">
            {weightEntries.slice(-5).reverse().map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                <div>
                  <p className="font-semibold text-sm">{e.weight_kg} kg</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.logged_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}
                    {e.waist_cm && ` • midja ${e.waist_cm} cm`}
                  </p>
                  {e.note && <p className="text-xs text-muted-foreground mt-1">{e.note}</p>}
                </div>
                <button
                  onClick={() => handleDeleteWeight(e.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add weight sheet */}
          {showAdd && (
            <div className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center animate-fade-in">
              <div className="w-full max-w-md bg-background rounded-t-3xl p-5 animate-slide-up pb-28">
                <div className="flex justify-center pt-1 pb-3">
                  <div className="h-1.5 w-10 rounded-full bg-muted" />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Logga vikt</h2>
                  <button onClick={() => setShowAdd(false)} className="p-2 rounded-xl hover:bg-muted">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Vikt (kg)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="t.ex. 97,4"
                      className="h-12 rounded-xl"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Midja (cm) – frivilligt</label>
                    <Input
                      type="number"
                      value={waist}
                      onChange={(e) => setWaist(e.target.value)}
                      placeholder="Valfritt"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Anteckning – frivilligt</label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Valfritt"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <Button onClick={handleAddWeight} className="w-full h-12 rounded-xl">
                    Spara
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'progress' && (
        <WeeklyReport
          userId={user?.id || ''}
          goal={goal}
          weeklyWeightChange={weeklyReport.weightChange}
        />
      )}
    </div>
  );
}

function WeeklyReport({ userId, goal, weeklyWeightChange }: { userId: string; goal: UserGoal | null; weeklyWeightChange: number }) {
  const [report, setReport] = useState<{
    avgPoints: number;
    daysInTarget: number;
    avgProtein: number;
    workouts: number;
  } | null>(null);
  const [chartData, setChartData] = useState<{ day: string; points: number }[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const startDate = sevenDaysAgo.toISOString().slice(0, 10);

      const { data: logs } = await supabase
        .from('food_log')
        .select('points, protein_g, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', startDate);

      const { data: activities } = await supabase
        .from('activity_log')
        .select('id')
        .eq('user_id', userId)
        .gte('logged_at', startDate);

      if (!logs) return;

      // Group by day
      const byDay: Record<string, { points: number; protein: number }> = {};
      const dayLabels: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('sv-SE', { weekday: 'short' });
        dayLabels.push(label);
        byDay[key] = { points: 0, protein: 0 };
      }

      logs.forEach((log: { points: number; protein_g: number; logged_at: string }) => {
        if (byDay[log.logged_at]) {
          byDay[log.logged_at].points += log.points;
          byDay[log.logged_at].protein += log.protein_g;
        }
      });

      const dailyBudget = goal?.daily_points_budget || 30;
      const daysInTarget = Object.values(byDay).filter((d) => d.points <= dailyBudget).length;
      const avgPoints = Object.values(byDay).reduce((sum, d) => sum + d.points, 0) / 7;
      const avgProtein = Object.values(byDay).reduce((sum, d) => sum + d.protein, 0) / 7;

      setReport({
        avgPoints: Math.round(avgPoints * 10) / 10,
        daysInTarget,
        avgProtein: Math.round(avgProtein),
        workouts: activities?.length || 0,
      });

      const chartArr = Object.entries(byDay).map(([key, val], idx) => ({
        day: dayLabels[idx],
        points: Math.round(val.points * 10) / 10,
      }));
      setChartData(chartArr);
    })();
  }, [userId, goal]);

  if (!report) {
    return <div className="text-center py-8 text-muted-foreground">Laddar rapport...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Veckorapport</h2>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Snitt points/dag</p>
          <p className="text-2xl font-bold">{report.avgPoints}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Dagar inom budget</p>
          <p className="text-2xl font-bold text-primary">{report.daysInTarget}/7</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Snitt protein/dag</p>
          <p className="text-2xl font-bold">{report.avgProtein}g</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Träningspass</p>
          <p className="text-2xl font-bold">{report.workouts}</p>
        </div>
      </div>

      {/* Weight change */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Viktändring denna vecka</span>
        </div>
        <p className="text-2xl font-bold mt-1">
          {weeklyWeightChange > 0 ? '+' : ''}{weeklyWeightChange} kg
        </p>
      </div>

      {/* Points chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <h3 className="text-sm font-semibold mb-3">Points per dag</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="points" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insights */}
      <div className="rounded-2xl bg-primary-lighter p-4">
        <h3 className="text-sm font-semibold text-primary mb-2">Insikter</h3>
        <div className="space-y-2">
          <p className="text-sm text-primary/80">
            Du låg inom din pointbudget {report.daysInTarget} av 7 dagar.
          </p>
          {report.avgProtein < (goal?.protein_target_g || 100) && (
            <p className="text-sm text-primary/80">
              Ditt proteinsnitt ({report.avgProtein}g) ligger under ditt mål ({Math.round(goal?.protein_target_g || 0)}g). Försök lägga till mer protein i frukosten.
            </p>
          )}
          {report.workouts === 0 && (
            <p className="text-sm text-primary/80">
              Du har inte loggat någon träning denna vecka. En kort prommenad är ett bra början!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
