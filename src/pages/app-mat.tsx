
import { Link } from '@/lib/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { supabase } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import type { FoodLogEntry } from '@/lib/types';
import { formatPoints } from '@/lib/points';
import { Plus, ScanLine, BookOpen, Clock, UtensilsCrossed } from 'lucide-react';

export default function MatPage() {
  const { user } = useAuth();
  const [recentEntries, setRecentEntries] = useState<FoodLogEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('food_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentEntries((data as FoodLogEntry[]) || []));
  }, [user]);

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Mat</h1>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/app/mat/sok"
          className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border tap-scale"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Plus className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold">Lägg till mat</p>
            <p className="text-xs text-muted-foreground">Sök eller skanna</p>
          </div>
        </Link>
        <Link
          href="/app/mat/skanna"
          className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border tap-scale"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chart-2">
            <ScanLine className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold">Skanna vara</p>
            <p className="text-xs text-muted-foreground">Använd kameran</p>
          </div>
        </Link>
        <Link
          href="/app/mat/sparade"
          className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border tap-scale"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chart-3">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold">Mina måltider</p>
            <p className="text-xs text-muted-foreground">Sparade kombinationer</p>
          </div>
        </Link>
        <Link
          href="/app/recept"
          className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border tap-scale"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chart-4">
            <UtensilsCrossed className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold">Recept</p>
            <p className="text-xs text-muted-foreground">Hitta inspiration</p>
          </div>
        </Link>
      </div>

      {/* Recent entries */}
      {recentEntries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">Senast loggat</h3>
          </div>
          <div className="space-y-2">
            {recentEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                <div>
                  <p className="text-sm font-medium">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.logged_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                    {' • '}{Math.round(entry.kcal)} kcal
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatPoints(entry.points)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
