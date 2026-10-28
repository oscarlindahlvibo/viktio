
import { Link } from '@/lib/navigation';
import { Plus, ScanLine, BookOpen, Dumbbell, HeartPulse } from 'lucide-react';

const ACTIONS = [
  { label: 'Lägg till mat', href: '/app/mat/sok', icon: Plus, color: 'bg-primary', dynamicMeal: true },
  { label: 'Skanna vara', href: '/app/mat/skanna', icon: ScanLine, color: 'bg-chart-2', dynamicMeal: true },
  { label: 'Lägg till måltid', href: '/app/mat/sparade', icon: BookOpen, color: 'bg-chart-3' },
  { label: 'Träning', href: '/app/traning', icon: Dumbbell, color: 'bg-chart-4' },
  { label: 'Livsstil', href: '/app/livsstil', icon: HeartPulse, color: 'bg-chart-5' },
];

function getCurrentMeal(): string {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}

export function QuickActions() {
  return (
    <div className="grid grid-cols-5 gap-2">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        const href = action.dynamicMeal ? `${action.href}?meal=${getCurrentMeal()}` : action.href;
        return (
          <Link
            key={action.label}
            href={href}
            className="flex flex-col items-center gap-2 tap-scale"
          >
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ${action.color} shadow-sm`}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <span className="text-[11px] font-medium text-center leading-tight">
              {action.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
