
import { useState, useEffect } from 'react';
import { useRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  calculateBMI,
  bmiCategory,
} from '@/lib/health';
import { computeGoals, saveGoals } from '@/lib/goals';
import type { Sex, ActivityLevel, WeightLossPace } from '@/lib/types';
import { ChevronLeft, Loader2, User, Target, Activity, Leaf } from 'lucide-react';
import { toast } from 'sonner';
import { AccountSettings } from '@/components/account-settings';
import { ReminderSettings } from '@/components/reminder-settings';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Stillasittande' },
  { value: 'light', label: 'Lätt aktiv' },
  { value: 'moderate', label: 'Måttligt aktiv' },
  { value: 'active', label: 'Aktiv' },
  { value: 'very_active', label: 'Mycket aktiv' },
];

const PACE_OPTIONS: { value: WeightLossPace; label: string }[] = [
  { value: 'slow', label: 'Långsamt' },
  { value: 'moderate', label: 'Måttligt' },
  { value: 'fast', label: 'Snabbt' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [pace, setPace] = useState<WeightLossPace>('moderate');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setSex(profile.sex || 'male');
      setDateOfBirth(profile.date_of_birth || '');
      setHeightCm(profile.height_cm?.toString() || '');
      setCurrentWeight(profile.current_weight_kg?.toString() || '');
      setTargetWeight(profile.target_weight_kg?.toString() || '');
      setWaistCm(profile.waist_cm?.toString() || '');
      setActivityLevel(profile.activity_level || 'moderate');
      setPace(profile.weight_loss_pace || 'moderate');
      setLoading(false);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      const hCm = parseFloat(heightCm);
      const cWeight = parseFloat(currentWeight);
      const tWeight = parseFloat(targetWeight);
      const goals = computeGoals({
        sex: sex as Sex,
        dateOfBirth,
        heightCm: hCm,
        weightKg: cWeight,
        activityLevel,
        pace,
      });

      const { error: profileError } = await supabase.from('profiles').update({
        first_name: firstName,
        sex,
        date_of_birth: dateOfBirth,
        height_cm: hCm,
        current_weight_kg: cWeight,
        target_weight_kg: tWeight,
        waist_cm: waistCm ? parseFloat(waistCm) : null,
        activity_level: activityLevel,
        weight_loss_pace: pace,
      }).eq('id', profile.id);

      if (profileError) throw profileError;

      await saveGoals(profile.id, goals);

      await refreshProfile();
      toast.success('Profil uppdaterad!');
      router.push('/app');
    } catch (err) {
      toast.error('Kunde inte uppdatera profilen');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const bmi = heightCm && currentWeight
    ? calculateBMI(parseFloat(currentWeight), parseFloat(heightCm))
    : null;
  const bmiInfo = bmi ? bmiCategory(bmi) : null;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Min profil</h1>
      </div>

      {/* Personal info */}
      <Card className="p-5 mb-4 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Personuppgifter</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Förnamn</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Kön</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['male', 'female', 'other'] as Sex[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s)}
                  className={`h-12 rounded-xl border-2 font-medium transition-all ${
                    sex === s
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card text-foreground'
                  }`}
                >
                  {s === 'male' ? 'Man' : s === 'female' ? 'Kvinna' : 'Annat'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Födelsedatum</Label>
            <Input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
        </div>
      </Card>

      {/* Body metrics */}
      <Card className="p-5 mb-4 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Kropp och mål</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="height">Längd (cm)</Label>
            <Input
              id="height"
              type="number"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentWeight">Nuvarande vikt (kg)</Label>
            <Input
              id="currentWeight"
              type="number"
              inputMode="decimal"
              value={currentWeight}
              onChange={(e) => setCurrentWeight(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetWeight">Målvikt (kg)</Label>
            <Input
              id="targetWeight"
              type="number"
              inputMode="decimal"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waist">Midja (cm) – frivilligt</Label>
            <Input
              id="waist"
              type="number"
              inputMode="decimal"
              value={waistCm}
              onChange={(e) => setWaistCm(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          {bmi !== null && bmiInfo && (
            <div className="p-3 rounded-xl bg-muted">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">BMI</span>
                <span className={`text-sm font-bold ${bmiInfo.color}`}>
                  {bmi} – {bmiInfo.label}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Activity */}
      <Card className="p-5 mb-4 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Aktivitet</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Aktivitetsnivå</Label>
            <div className="space-y-2">
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActivityLevel(opt.value)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    activityLevel === opt.value
                      ? 'border-primary bg-primary-lighter'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-sm">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tempo för viktnedgång</Label>
            <div className="grid grid-cols-3 gap-2">
              {PACE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPace(opt.value)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    pace === opt.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-sm">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving || !firstName || !heightCm || !currentWeight || !targetWeight}
        className="w-full h-12 rounded-xl text-base font-semibold"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Spara ändringar'}
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-4 mb-6">
        Ändringar räknar om dina poäng och mål automatiskt.
      </p>

      <ReminderSettings />
      <AccountSettings />
    </div>
  );
}
