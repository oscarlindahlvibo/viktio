
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { ActivityLogEntry, Exercise } from '@/lib/types';
import { Plus, Dumbbell, Clock, Flame, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ACTIVITIES = [
  { name: 'Promenad', kcalPerMin: 4 },
  { name: 'Löpning', kcalPerMin: 10 },
  { name: 'Cykling', kcalPerMin: 7 },
  { name: 'Simning', kcalPerMin: 8 },
  { name: 'Styrketräning', kcalPerMin: 5 },
  { name: 'Lagidrott', kcalPerMin: 7 },
  { name: 'Annan aktivitet', kcalPerMin: 5 },
];

const INTENSITY_OPTIONS = [
  { value: 'low', label: 'Låg' },
  { value: 'moderate', label: 'Måttlig' },
  { value: 'high', label: 'Hög' },
] as const;

export default function TrainingPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'activity' | 'workout'>('activity');

  // Add activity form
  const [activityName, setActivityName] = useState('Promenad');
  const [duration, setDuration] = useState('30');
  const [distance, setDistance] = useState('');
  const [intensity, setIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');

  const today = new Date().toISOString().slice(0, 10);

  const loadActivities = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('logged_at', today)
      .order('created_at', { ascending: false });
    setActivities((data as ActivityLogEntry[]) || []);
    setLoading(false);
  };

  const loadExercises = async () => {
    const { data } = await supabase.from('exercises').select('*').limit(20);
    setExercises((data as Exercise[]) || []);
  };

  useEffect(() => {
    loadActivities();
    loadExercises();
  }, [user]);

  const handleAddActivity = async () => {
    if (!user || !duration) return;
    const dur = parseInt(duration);
    const activityDef = ACTIVITIES.find((a) => a.name === activityName);
    const intensityMult = intensity === 'low' ? 0.7 : intensity === 'high' ? 1.3 : 1;
    const kcal = Math.round((activityDef?.kcalPerMin || 5) * dur * intensityMult);

    const { error } = await supabase.from('activity_log').insert({
      user_id: user.id,
      activity: activityName,
      duration_min: dur,
      distance_km: distance ? parseFloat(distance) : null,
      intensity,
      estimated_kcal: kcal,
      bonus_points: 0,
      source: 'manual',
      logged_at: today,
    });

    if (error) {
      toast.error('Kunde inte lägga till');
    } else {
      toast.success(`${activityName} tillagd!`);
      setShowAdd(false);
      setDuration('30');
      setDistance('');
      loadActivities();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('activity_log').delete().eq('id', id);
    loadActivities();
    toast.success('Borttagen');
  };

  const totalKcal = activities.reduce((sum, a) => sum + a.estimated_kcal, 0);
  const totalMin = activities.reduce((sum, a) => sum + a.duration_min, 0);

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Träning</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('activity')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all',
            tab === 'activity' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          Aktiviteter
        </button>
        <button
          onClick={() => setTab('workout')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all',
            tab === 'workout' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          Övningar
        </button>
      </div>

      {tab === 'activity' && (
        <>
          {/* Summary */}
          {activities.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-2xl bg-card border border-border p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total tid</p>
                <p className="text-2xl font-bold">{totalMin} min</p>
              </div>
              <div className="rounded-2xl bg-card border border-border p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Brända kcal</p>
                <p className="text-2xl font-bold text-primary">{Math.round(totalKcal)}</p>
              </div>
            </div>
          )}

          <Button
            onClick={() => setShowAdd(true)}
            className="w-full h-12 rounded-xl mb-4"
          >
            <Plus className="h-5 w-5 mr-2" />
            Logga aktivitet
          </Button>

          {activities.length === 0 && !loading ? (
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                <Dumbbell className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Inga aktiviteter idag</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-lighter">
                    <Dumbbell className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{a.activity}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.duration_min} min</span>
                      <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{Math.round(a.estimated_kcal)} kcal</span>
                      {a.distance_km && <span>• {a.distance_km} km</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add activity sheet */}
          {showAdd && (
            <div className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center animate-fade-in">
              <div className="w-full max-w-md bg-background rounded-t-3xl p-5 animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar pb-28">
                <div className="flex justify-center pt-1 pb-3">
                  <div className="h-1.5 w-10 rounded-full bg-muted" />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Logga aktivitet</h2>
                  <button onClick={() => setShowAdd(false)} className="p-2 rounded-xl hover:bg-muted">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Aktivitet</label>
                    <div className="flex flex-wrap gap-2">
                      {ACTIVITIES.map((a) => (
                        <button
                          key={a.name}
                          onClick={() => setActivityName(a.name)}
                          className={cn(
                            'px-3 py-2 rounded-xl text-sm font-medium border-2',
                            activityName === a.name
                              ? 'border-primary bg-primary text-white'
                              : 'border-border',
                          )}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Varaktighet (min)</label>
                    <Input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="h-12 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Distans (km) – frivilligt</label>
                    <Input
                      type="number"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="Valfritt"
                      className="h-12 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Intensitet</label>
                    <div className="grid grid-cols-3 gap-2">
                      {INTENSITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setIntensity(opt.value)}
                          className={cn(
                            'py-2 rounded-xl text-sm font-medium border-2',
                            intensity === opt.value
                              ? 'border-primary bg-primary text-white'
                              : 'border-border',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleAddActivity} className="w-full h-12 rounded-xl">
                    Lägg till
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'workout' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground mb-3">Övningsbibliotek</p>
          {exercises.map((ex) => (
            <div key={ex.id} className="p-3 rounded-2xl bg-card border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{ex.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ex.muscle_group} • {ex.equipment || 'Inget'}
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full bg-muted text-xs font-medium">
                  {ex.category}
                </span>
              </div>
              {ex.description && (
                <p className="text-xs text-muted-foreground mt-2">{ex.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
