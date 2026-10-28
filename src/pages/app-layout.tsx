
import { useEffect } from 'react';
import { useRouter, usePathname } from '@/lib/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  const children = <Outlet />;
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (profile && !profile.onboarding_completed) {
      router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  if (loading || !user || (profile && !profile.onboarding_completed)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
