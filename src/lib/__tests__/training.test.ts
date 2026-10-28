import { describe, expect, it } from 'vitest';
import { estimatedOneRepMax, PROGRAMS, sessionMet, suggestWeight, topOfRange } from '../training';

describe('training', () => {
  it('reads the top of a rep range', () => {
    expect(topOfRange('8–12')).toBe(12);
    expect(topOfRange('15')).toBe(15);
  });

  it('keeps the weight until every set reaches the top of the range', () => {
    expect(suggestWeight([{ reps: 12, weight_kg: 20 }, { reps: 10, weight_kg: 20 }], '8–12')).toBe(20);
    expect(suggestWeight([{ reps: 12, weight_kg: 20 }, { reps: 12, weight_kg: 20 }], '8–12')).toBe(21);
    expect(suggestWeight([{ reps: 8, weight_kg: 60 }, { reps: 8, weight_kg: 60 }], '6–8')).toBe(62.5);
    expect(suggestWeight([{ reps: 10, weight_kg: null }], '8–12')).toBeNull();
  });

  it('estimates a one-rep max', () => {
    expect(estimatedOneRepMax(100, 1)).toBeCloseTo(103.3, 1);
    expect(estimatedOneRepMax(80, 10)).toBeGreaterThan(estimatedOneRepMax(90, 3));
  });

  it('raises MET for interval-heavy sessions', () => {
    expect(sessionMet(['strength', 'strength'])).toBe(5);
    expect(sessionMet(['hiit', 'hiit'])).toBe(8);
  });

  it('has unique program keys with at least one day each', () => {
    expect(new Set(PROGRAMS.map((p) => p.key)).size).toBe(PROGRAMS.length);
    PROGRAMS.forEach((p) => expect(p.days.length).toBeGreaterThan(0));
  });
});
