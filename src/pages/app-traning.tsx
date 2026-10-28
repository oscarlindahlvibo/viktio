import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ActivityTab } from '@/components/training/activity-tab';
import { NextSessionCard, ProgramTab, useActiveProgram } from '@/components/training/program-tab';
import { ExerciseLibrary } from '@/components/training/exercise-library';
import { HistoryTab } from '@/components/training/history-tab';

const TABS = [
  { key: 'today', label: 'Idag' },
  { key: 'program', label: 'Program' },
  { key: 'exercises', label: 'Övningar' },
  { key: 'history', label: 'Historik' },
] as const;

type Tab = (typeof TABS)[number]['key'];

export default function TrainingPage() {
  const [tab, setTab] = useState<Tab>('today');
  const { program, nextDay } = useActiveProgram();

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Träning</h1>

      <div className="grid grid-cols-4 gap-1 mb-4 rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('py-2 rounded-lg text-sm font-medium transition-all', tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <>
          {program ? (
            <NextSessionCard program={program} nextDay={nextDay} />
          ) : (
            <button onClick={() => setTab('program')} className="w-full rounded-2xl border border-dashed border-primary/40 bg-primary-lighter p-4 mb-4 text-left">
              <p className="font-semibold text-primary">Välj ett träningsprogram</p>
              <p className="text-xs text-primary/70">Färdiga program för hemma och gym – med pass, vilotimer och viktförslag.</p>
            </button>
          )}
          <ActivityTab />
        </>
      )}
      {tab === 'program' && <ProgramTab />}
      {tab === 'exercises' && <ExerciseLibrary />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}
