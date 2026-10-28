
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Leaf, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/lib/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get('demo') === '1';

  const [email, setEmail] = useState(isDemo ? 'demo@viktio.se' : '');
  const [password, setPassword] = useState(isDemo ? 'viktio123' : '');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        onboarding_completed: false,
      });
      toast.success('Konto skapat! Välkommen till Viktio.');
      router.replace('/onboarding');
    } else {
      toast.success('Kolla din e-post för att bekräfta kontot.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary-lighter to-background px-6 py-12">
      <div className="flex flex-1 flex-col justify-center max-w-sm mx-auto w-full">
        <div className="flex items-center gap-2 mb-12">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-foreground">Viktio</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Kom igång</h1>
        <p className="text-muted-foreground mb-8">Skapa ditt konto på under en minut.</p>

        {isDemo && (
          <div className="mb-6 rounded-xl bg-primary-lighter p-4 text-sm text-primary">
            <p className="font-semibold">Demo-konto</p>
            <p className="mt-1">Fälten är ifyllda. Tryck på &quot;Skapa konto&quot; för att börja.</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              placeholder="namn@example.se"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minst 6 tecken"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="h-12 rounded-xl"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl text-base font-semibold w-full"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Skapa konto'}
          </Button>
        </form>

        <div className="mt-8 flex items-center justify-center">
          <Link href="/login" className="text-sm text-muted-foreground">
            Har du redan ett konto? <span className="text-primary font-semibold">Logga in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
