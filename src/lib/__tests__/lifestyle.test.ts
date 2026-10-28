import { describe, expect, it } from 'vitest';
import { lifeScore, streak, waterGoalMl } from '../lifestyle';

const perfect = {
  pointsUsed: 30, pointsBudget: 34, foodLogged: true, waterMl: 2500, waterGoalMl: 2250,
  sleepHours: 8, steps: 9000, activeMinutes: 0, habitsDone: 2, habitsTotal: 2,
};

describe('lifestyle', () => {
  it('scales the water goal with weight within limits', () => {
    expect(waterGoalMl(75)).toBe(2250);
    expect(waterGoalMl(40)).toBe(1500);
    expect(waterGoalMl(200)).toBe(3500);
  });

  it('counts streaks up to today or yesterday', () => {
    expect(streak(['2026-10-27', '2026-10-28', '2026-10-29'], '2026-10-29')).toBe(3);
    expect(streak(['2026-10-27', '2026-10-28'], '2026-10-29')).toBe(2);
    expect(streak(['2026-10-26'], '2026-10-29')).toBe(0);
  });

  it('gives a full score for a balanced day', () => {
    expect(lifeScore(perfect).score).toBe(100);
  });

  it('penalises going over budget and short sleep', () => {
    expect(lifeScore({ ...perfect, pointsUsed: 44 }).score).toBeLessThan(90);
    expect(lifeScore({ ...perfect, sleepHours: 5 }).score).toBeLessThan(90);
  });

  it('leaves habits out of the score when there are none', () => {
    const s = lifeScore({ ...perfect, habitsDone: 0, habitsTotal: 0 });
    expect(s.score).toBe(100);
    expect(s.parts.find((p) => p.key === 'habits')).toBeUndefined();
  });
});
