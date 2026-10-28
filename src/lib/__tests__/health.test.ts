import { describe, expect, it } from 'vitest';
import { calculateBMR, calculateCalorieTarget, calculateDailyPoints, calculateTDEE, MAX_DAILY_POINTS, MIN_DAILY_POINTS } from '../health';

describe('calculateDailyPoints', () => {
  it('scales with the calorie target', () => {
    expect(calculateDailyPoints(1500)).toBe(34);
    expect(calculateDailyPoints(2000)).toBe(45);
    expect(calculateDailyPoints(2000)).toBeGreaterThan(calculateDailyPoints(1500));
  });

  it('stays within the allowed range', () => {
    expect(calculateDailyPoints(800)).toBe(MIN_DAILY_POINTS);
    expect(calculateDailyPoints(5000)).toBe(MAX_DAILY_POINTS);
  });

  it('gives a larger person a larger budget', () => {
    const small = calculateCalorieTarget(calculateTDEE(calculateBMR('female', 55, 160, 35), 'light'), 'moderate');
    const large = calculateCalorieTarget(calculateTDEE(calculateBMR('male', 120, 190, 35), 'light'), 'moderate');
    expect(calculateDailyPoints(large)).toBeGreaterThan(calculateDailyPoints(small) + 10);
  });
});

describe('calculateCalorieTarget', () => {
  it('never goes below 1200 kcal', () => {
    expect(calculateCalorieTarget(1300, 'fast')).toBe(1200);
  });
});
