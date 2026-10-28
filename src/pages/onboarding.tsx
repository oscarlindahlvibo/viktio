
import { useState } from 'react';
import { useRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  calculateDailyPoints,
  calculateProteinTarget,
  calculateWeeklyPoints,
  calculateAge,
  estimateProgress,
  bmiCategory,
} from '@/lib/health';
import type { Sex, ActivityLevel, WeightLossPace } from '@/lib/types';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Ruler,
  Target,
  HeartPulse,
  Apple,
  AlertCircle,
  Loader2,
  Leaf,
} from 'lucide-react';
import { toast } from 'sonner';

export const dynamic = 'force-dynamic';

const STEPS = ['Om dig', 'Mål', 'Aktivitet', 'Kost'] as const;

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Stillasittande', desc: 'Lite eller ingen träning' },
  { value: 'light', label: 'Lätt aktiv', desc: 'Tränar 1–3 dagar/vecka' },
  { value: 'moderate', label: 'Måttligt aktiv', desc: 'Tränar 3–5 dagar/vecka' },
  { value: 'active', label: 'Aktiv', desc: 'Tränar 6–7 dagar/vecka' },
  { value: 'very_active', label: 'Mycket aktiv', desc: 'Tränar 2 gånger/dag' },
];

const PACE_OPTIONS: { value: WeightLossPace; label: string; desc: string }[] = [
  { value: 'slow', label: 'Långsamt', desc: '~0,25 kg/vecka' },
  { value: 'moderate', label: 'Måttligt', desc: '~0,5 kg/vecka' },
  { value: 'fast', label: 'Snabbt', desc: '~0,75 kg/vecka' },
];

const DIET_OPTIONS = [
  'Vegetariskt',
  'Veganskt',
  'Pescetariskt',
  'Flexitariskt',
  'Lågkolhydrat',
  'Högprotein',
  'Medelhavs',
  'Ingen särskild',
];

const ALLERGY_OPTIONS = [
  'Gluten',
  'Laktos',
  'Mjölkprotein',
  'Ägg',
  'Jordnötter',
  'Trädgårdsnötter',
  'Soja',
  'Skaldjur',
  'Fisk',
  'Sesam',
  'Senap',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [pace, setPace] = useState<WeightLossPace>('moderate');
  const [dietPrefs, setDietPrefs] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikedFoods, setDislikedFoods] = useState('');

  const progress = ((step + 1) / STEPS.length) * 100;

  const toggleArrayItem = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const canProceed = () => {
    if (step === 0) return firstName && sex && dateOfBirth;
    if (step === 1) return heightCm && currentWeight && targetWeight;
    if (step === 2) return activityLevel && pace;
    return true;
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const hCm = parseFloat(heightCm);
      const cWeight = parseFloat(currentWeight);
      const tWeight = parseFloat(targetWeight);
      const age = calculateAge(dateOfBirth);
      const bmi = calculateBMI(cWeight, hCm);
      const bmr = calculateBMR(sex, cWeight, hCm, age);
      const tdee = calculateTDEE(bmr, activityLevel);
      const calorieTarget = calculateCalorieTarget(tdee, pace);
      const proteinTarget = calculateProteinTarget(cWeight);
      const dailyPoints = calculateDailyPoints(calorieTarget, proteinTarget, activityLevel);
      const weeklyPool = calculateWeeklyPoints(dailyPoints);

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        first_name: firstName,
        sex,
        date_of_birth: dateOfBirth,
        height_cm: hCm,
        current_weight_kg: cWeight,
        target_weight_kg: tWeight,
        waist_cm: waistCm ? parseFloat(waistCm) : null,
        activity_level: activityLevel,
        weight_loss_pace: pace,
        dietary_preferences: dietPrefs,
        allergies,
        disliked_foods: dislikedFoods
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        onboarding_completed: true,
      });

      if (profileError) throw profileError;

      const { data: existingGoal } = await supabase
        .from('user_goals')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingGoal) {
        await supabase
          .from('user_goals')
          .update({
            bmi,
            bmr,
            tdee,
            calorie_target: calorieTarget,
            daily_points_budget: dailyPoints,
            weekly_points_pool: weeklyPool,
            protein_target_g: proteinTarget,
          })
          .eq('id', existingGoal.id);
      } else {
        await supabase.from('user_goals').insert({
          user_id: user.id,
          bmi,
          bmr,
          tdee,
          calorie_target: calorieTarget,
          daily_points_budget: dailyPoints,
          weekly_points_pool: weeklyPool,
          protein_target_g: proteinTarget,
        });
      }

      await refreshProfile();
      toast.success('Välkommen till Viktio, ' + firstName + '!');
      router.replace('/app');
    } catch (err) {
      toast.error('Något gick fel. Försök igen.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-lighter to-background">
      <div className="max-w-md mx-auto px-6 py-8 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold">Viktio</span>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Steg {step + 1} av {STEPS.length}
            </span>
            <span className="text-sm font-medium text-primary">{STEPS[step]}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step content */}
        <div className="flex-1 animate-fade-in">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold mb-1">Berätta om dig</h2>
                <p className="text-muted-foreground text-sm">Vi behöver lite grundinfo för att kunna hjälpa dig.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Förnamn</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Oscar"
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
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold mb-1">Din längd och vikt</h2>
                <p className="text-muted-foreground text-sm">Används för att beräkna dina mål.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Längd (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  inputMode="decimal"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="180"
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
                  placeholder="104,2"
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
                  placeholder="85"
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
                  placeholder="Valfritt"
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold mb-1">Aktivitet och tempo</h2>
                <p className="text-muted-foreground text-sm">Hur aktiv är du i vardagen?</p>
              </div>
              <div className="space-y-2">
                <Label>Aktivitetsnivå</Label>
                <div className="space-y-2">
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setActivityLevel(opt.value)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        activityLevel === opt.value
                          ? 'border-primary bg-primary-lighter'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-sm text-muted-foreground">{opt.desc}</div>
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
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className={`text-xs ${pace === opt.value ? 'text-white/80' : 'text-muted-foreground'}`}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold mb-1">Kostpreferenser</h2>
                <p className="text-muted-foreground text-sm">Hjälper oss att ge bättre rekommendationer.</p>
              </div>
              <div className="space-y-2">
                <Label>Kosttyp</Label>
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDietPrefs((prev) => toggleArrayItem(prev, d))}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                        dietPrefs.includes(d)
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-card'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Allergier och intoleranser</Label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGY_OPTIONS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAllergies((prev) => toggleArrayItem(prev, a))}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                        allergies.includes(a)
                          ? 'border-destructive bg-destructive text-white'
                          : 'border-border bg-card'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="disliked">Mat du inte gillar (kommaseparerad)</Label>
                <Input
                  id="disliked"
                  value={dislikedFoods}
                  onChange={(e) => setDislikedFoods(e.target.value)}
                  placeholder="lever, ansjovis, koriander"
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-6">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="h-12 rounded-xl px-4"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="h-12 rounded-xl flex-1 text-base font-semibold"
            >
              Fortsätt <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={loading || !canProceed()}
              className="h-12 rounded-xl flex-1 text-base font-semibold"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Kom igång'}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4 max-w-xs mx-auto">
          All information är uppskattningar och ersätter inte medicinsk rådgivning.
        </p>
      </div>
    </div>
  );
}
