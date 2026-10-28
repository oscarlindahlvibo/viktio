import type { PointEngineConfig, FoodNutrition } from './types';

const DEFAULT_CONFIG: PointEngineConfig = {
  version: 'v1',
  rules: {
    calorie_weight: 0.03,
    protein_weight: -0.012,
    sugar_weight: 0.04,
    saturated_fat_weight: 0.035,
    fat_weight: 0.018,
    fiber_weight: -0.02,
    sodium_weight: 0.0008,
    min_points: 0,
    round_precision: 1,
    points_per_100g_divisor: 1,
  daily_budget_base: 30,
    daily_budget_protein_adj: 0,
    daily_budget_activity_adj: 0,
  },
};

let cachedConfig: PointEngineConfig | null = null;

export function setPointEngineConfig(config: PointEngineConfig) {
  cachedConfig = config;
}

export function getPointEngineConfig(): PointEngineConfig {
  return cachedConfig || DEFAULT_CONFIG;
}

export function calculateFoodPoints(params: {
  calories: number;
  protein: number;
  carbohydrates: number;
  sugar: number;
  fat: number;
  saturatedFat: number;
  fiber: number;
  sodium: number;
  servingSize?: number;
  category?: string;
  zeroPoint?: boolean;
  manualPoints?: number | null;
  config?: PointEngineConfig;
}): number {
  if (params.zeroPoint) return 0;
  if (params.manualPoints != null && params.manualPoints >= 0) return params.manualPoints;

  const config = params.config || getPointEngineConfig();
  const r = config.rules;

  const per100g = params.servingSize
    ? {
        calories: (params.calories / params.servingSize) * 100,
        protein: (params.protein / params.servingSize) * 100,
        sugar: (params.sugar / params.servingSize) * 100,
        fat: (params.fat / params.servingSize) * 100,
        saturatedFat: (params.saturatedFat / params.servingSize) * 100,
        fiber: (params.fiber / params.servingSize) * 100,
        sodium: (params.sodium / params.servingSize) * 100,
      }
    : {
        calories: params.calories,
        protein: params.protein,
        sugar: params.sugar,
        fat: params.fat,
        saturatedFat: params.saturatedFat,
        fiber: params.fiber,
        sodium: params.sodium,
      };

  const raw =
    per100g.calories * (r.calorie_weight || 0.03) +
    per100g.protein * (r.protein_weight || -0.012) +
    per100g.sugar * (r.sugar_weight || 0.04) +
    per100g.saturatedFat * (r.saturated_fat_weight || 0.035) +
    per100g.fat * (r.fat_weight || 0.018) +
    per100g.fiber * (r.fiber_weight || -0.02) +
    per100g.sodium * (r.sodium_weight || 0.0008);

  const pts = Math.max(raw, r.min_points || 0);

  const actualServing = params.servingSize || 100;
  const factor = actualServing / 100;
  const points = pts * factor;

  const precision = r.round_precision ?? 1;
  return Math.round(points * Math.pow(10, precision)) / Math.pow(10, precision);
}

export function calculatePointsFromNutrition(
  nutrition: FoodNutrition,
  weightG: number,
  zeroPoint: boolean = false,
  manualPoints?: number | null,
  config?: PointEngineConfig,
): number {
  if (zeroPoint) return 0;
  if (manualPoints != null && manualPoints >= 0) return manualPoints;

  const factor = weightG / (nutrition.per_amount || 100);

  return calculateFoodPoints({
    calories: nutrition.kcal * factor,
    protein: nutrition.protein_g * factor,
    carbohydrates: nutrition.carbohydrate_g * factor,
    sugar: nutrition.sugar_g * factor,
    fat: nutrition.fat_g * factor,
    saturatedFat: nutrition.saturated_fat_g * factor,
    fiber: nutrition.fiber_g * factor,
    sodium: nutrition.sodium_mg * factor,
    zeroPoint,
    manualPoints,
    config,
  });
}

export function calculatePointsPer100g(
  nutrition: FoodNutrition,
  zeroPoint: boolean = false,
  manualPoints?: number | null,
  config?: PointEngineConfig,
): number {
  if (zeroPoint) return 0;
  if (manualPoints != null && manualPoints >= 0) return manualPoints;

  return calculateFoodPoints({
    calories: nutrition.kcal,
    protein: nutrition.protein_g,
    carbohydrates: nutrition.carbohydrate_g,
    sugar: nutrition.sugar_g,
    fat: nutrition.fat_g,
    saturatedFat: nutrition.saturated_fat_g,
    fiber: nutrition.fiber_g,
    sodium: nutrition.sodium_mg,
    zeroPoint,
    manualPoints,
    config,
  });
}

export function formatPoints(points: number): string {
  if (points === 0) return '0';
  const rounded = Math.round(points * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}
