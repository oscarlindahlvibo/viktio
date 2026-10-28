
import { Link } from '@/lib/navigation';
import { usePathname } from '@/lib/navigation';
import { Home, UtensilsCrossed, BookOpen, Dumbbell, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/app', label: 'Idag', icon: Home },
  { href: '/app/mat', label: 'Mat', icon: UtensilsCrossed },
  { href: '/app/recept', label: 'Recept', icon: BookOpen },
  { href: '/app/traning', label: 'Träning', icon: Dumbbell },
  { href: '/app/utveckling', label: 'Utveckling', icon: TrendingUp },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md min-h-screen bg-background relative">
        <main className="pb-24 min-h-screen">{children}</main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 glass border-t border-border safe-bottom">
          <div className="flex items-center justify-around px-2 py-2">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/app'
                  ? pathname === '/app'
                  : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all tap-scale',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className={cn('h-6 w-6', isActive && 'stroke-[2.5]')} />
                  <span className="text-[11px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
