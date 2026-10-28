
import { useState } from 'react';
import { useRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Leaf, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/lib/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      router.replace('/');
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

        <h1 className="text-3xl font-bold tracking-tight mb-2">Välkommen tillbaka</h1>
        <p className="text-muted-foreground mb-8">Logga in för att fortsätta din resa.</p>

        <form onSubmit={handleLogin} className="space-y-4">
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-12 rounded-xl"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl text-base font-semibold w-full"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Logga in'}
          </Button>
        </form>

        <div className="mt-8 flex items-center justify-center">
          <Link href="/register" className="text-sm text-muted-foreground">
            Inget konto? <span className="text-primary font-semibold">Skapa ett</span>
          </Link>
        </div>
      </div>

      <div className="mt-auto pt-8 text-center">
        <Link href="/register?demo=1" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          Prova med demo-konto <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
