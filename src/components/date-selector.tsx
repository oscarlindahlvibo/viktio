
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toLocalDate } from '@/lib/dates';

interface DateSelectorProps {
  date: string;
  onChange: (date: string) => void;
}

const WEEKDAYS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

export function DateSelector({ date, onChange }: DateSelectorProps) {
  const today = toLocalDate();
  const selectedDate = new Date(date + 'T00:00:00');

  const goPrev = () => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    onChange(toLocalDate(d));
  };

  const goNext = () => {
    if (date >= today) return;
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    onChange(toLocalDate(d));
  };

  const formatted = selectedDate.toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex items-center justify-between mb-2">
      <button
        onClick={goPrev}
        className="p-2 rounded-xl hover:bg-muted transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="text-center">
        <p className="text-sm font-semibold capitalize">{formatted}</p>
        {date === today && (
          <p className="text-xs text-primary">Idag</p>
        )}
      </div>
      <button
        onClick={goNext}
        disabled={date >= today}
        className={cn(
          'p-2 rounded-xl transition-colors',
          date >= today ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted',
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
