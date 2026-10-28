import { describe, expect, it } from 'vitest';
import { calculateFoodPoints, calculatePointsFromNutrition } from '../points';

const base = { calories: 0, protein: 0, carbohydrates: 0, sugar: 0, fat: 0, saturatedFat: 0, fiber: 0, sodium: 0 };
const nutrition = {
  id: 'n', food_id: 'f', kcal: 370, protein_g: 12, carbohydrate_g: 60, sugar_g: 1.2, fat_g: 7,
  saturated_fat_g: 1.3, fiber_g: 10, sodium_mg: 5, salt_g: 0, per_amount: 100, unit: 'g',
};

describe('calculateFoodPoints', () => {
  it('returns 0 for zero-point foods and honours manual points', () => {
    expect(calculateFoodPoints({ ...base, calories: 500, zeroPoint: true })).toBe(0);
    expect(calculateFoodPoints({ ...base, calories: 500, manualPoints: 4 })).toBe(4);
  });

  it('penalises sugar and saturated fat and rewards protein', () => {
    const plain = calculateFoodPoints({ ...base, calories: 200 });
    expect(calculateFoodPoints({ ...base, calories: 200, sugar: 20 })).toBeGreaterThan(plain);
    expect(calculateFoodPoints({ ...base, calories: 200, saturatedFat: 10 })).toBeGreaterThan(plain);
    expect(calculateFoodPoints({ ...base, calories: 200, protein: 20 })).toBeLessThan(plain);
  });

  it('never goes negative', () => {
    expect(calculateFoodPoints({ ...base, calories: 10, protein: 30, fiber: 20 })).toBe(0);
  });
});

describe('calculatePointsFromNutrition', () => {
  it('scales linearly with weight', () => {
    const per100 = calculatePointsFromNutrition(nutrition, 100);
    expect(calculatePointsFromNutrition(nutrition, 200)).toBeCloseTo(per100 * 2, 0);
    expect(per100).toBeGreaterThan(9);
    expect(per100).toBeLessThan(13);
  });
});
