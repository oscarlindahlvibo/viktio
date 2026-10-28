
import { formatPoints } from '@/lib/points';

interface PointsRingProps {
  used: number;
  budget: number;
  remaining: number;
}

export function PointsRing({ used, budget, remaining }: PointsRingProps) {
  const percentage = budget > 0 ? Math.min((used / budget) * 100, 100) : 0;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const overBudget = used > budget;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
      <svg width="280" height="280" className="-rotate-90">
        {/* Background circle */}
        <circle
          cx="140"
          cy="140"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="16"
        />
        {/* Progress circle */}
        <circle
          cx="140"
          cy="140"
          r={radius}
          fill="none"
          stroke={overBudget ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-sm text-muted-foreground font-medium">POINTS KVAR IDAG</p>
        <p className="text-6xl font-bold text-foreground mt-1">{formatPoints(remaining)}</p>
        <p className="text-base text-muted-foreground mt-1">
          av {formatPoints(budget)}
        </p>
      </div>
    </div>
  );
}
