import { describe, expect, it } from 'vitest';
import { activityPoints, earnedActivityPoints, estimateKcal, MAX_DAILY_ACTIVITY_POINTS, metFor } from '../activity';

describe('activity', () => {
  it('estimates calories from MET, weight and time', () => {
    expect(estimateKcal(metFor('Löpning'), 80, 30)).toBe(360);
    expect(estimateKcal(metFor('Löpning'), 60, 30)).toBeLessThan(estimateKcal(metFor('Löpning'), 80, 30));
    expect(estimateKcal(metFor('Promenad'), 80, 60, 'high')).toBeGreaterThan(estimateKcal(metFor('Promenad'), 80, 60));
  });

  it('earns half the food rate in points', () => {
    expect(activityPoints(360)).toBe(5.4);
  });

  it('caps earned points per day', () => {
    expect(earnedActivityPoints([{ bonus_points: 9 }, { bonus_points: 9 }])).toBe(MAX_DAILY_ACTIVITY_POINTS);
    expect(earnedActivityPoints([{ bonus_points: 2.5 }, { bonus_points: 1 }])).toBe(3.5);
  });
});
