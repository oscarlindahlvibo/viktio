
import { useEffect } from 'react';
import { useRouter } from '@/lib/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (profile && !profile.onboarding_completed) {
      router.replace('/onboarding');
    } else if (profile && profile.onboarding_completed) {
      router.replace('/app');
    } else {
      router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
