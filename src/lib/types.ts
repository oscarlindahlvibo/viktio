export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WeightLossPace = 'slow' | 'moderate' | 'fast';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FoodStatus = 'verified' | 'imported' | 'user_created' | 'estimated' | 'needs_review';
export type Confidence = 'high' | 'medium' | 'low' | 'unmatched';

export interface Profile {
  id: string;
  first_name: string | null;
  sex: Sex | null;
  date_of_birth: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  weight_loss_pace: WeightLossPace | null;
  waist_cm: number | null;
  dietary_preferences: string[];
  allergies: string[];
  disliked_foods: string[];
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserGoal {
  id: string;
  user_id: string;
  bmi: number | null;
  bmr: number | null;
  tdee: number | null;
  calorie_target: number | null;
  daily_points_budget: number;
  weekly_points_pool: number;
  protein_target_g: number | null;
  created_at: string;
  updated_at: string;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  category_id: string | null;
  source_id: string | null;
  barcode: string | null;
  package_size: string | null;
  serving_size_g: number | null;
  serving_description: string | null;
  image_url: string | null;
  status: FoodStatus;
  zero_point: boolean;
  manual_points: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodNutrition {
  id: string;
  food_id: string;
  kcal: number;
  protein_g: number;
  carbohydrate_g: number;
  sugar_g: number;
  fat_g: number;
  saturated_fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  salt_g: number;
  per_amount: number;
  unit: string;
}

export interface FoodWithNutrition extends Food {
  nutrition?: FoodNutrition;
  category_name?: string;
  category_slug?: string;
}

export interface Recipe {
  id: string;
  name: string;
  image_url: string | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  servings: number;
  total_points: number;
  kcal_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
  fiber_per_serving: number;
  source_id: string | null;
  source_url: string | null;
  source_name: string | null;
  author: string | null;
  instructions: string | null;
  tags: string[];
  meal_type: string | null;
  status: FoodStatus;
  created_by: string | null;
  engine_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  food_id: string | null;
  raw_text: string | null;
  amount: number | null;
  unit: string | null;
  weight_g: number | null;
  kcal: number;
  protein_g: number;
  carbohydrate_g: number;
  fat_g: number;
  fiber_g: number;
  points: number;
  confidence: Confidence;
}

export interface FoodLogEntry {
  id: string;
  user_id: string;
  food_id: string | null;
  recipe_id: string | null;
  saved_meal_id: string | null;
  name: string;
  meal_type: MealType;
  quantity: number;
  unit: string;
  weight_g: number | null;
  kcal: number;
  protein_g: number;
  carbohydrate_g: number;
  fat_g: number;
  fiber_g: number;
  points: number;
  engine_version_id: string | null;
  nutrition_snapshot: Record<string, unknown> | null;
  logged_at: string;
  created_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  weight_kg: number;
  waist_cm: number | null;
  body_fat_pct: number | null;
  note: string | null;
  photo_url: string | null;
  logged_at: string;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  activity: string;
  duration_min: number;
  distance_km: number | null;
  intensity: 'low' | 'moderate' | 'high' | null;
  estimated_kcal: number;
  bonus_points: number;
  source: string | null;
  logged_at: string;
  created_at: string;
}

export interface SavedMeal {
  id: string;
  user_id: string;
  name: string;
  meal_type: MealType | null;
  total_points: number;
  created_at: string;
}

export interface SavedMealItem {
  id: string;
  saved_meal_id: string;
  food_id: string | null;
  recipe_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  weight_g: number | null;
  points: number;
  kcal: number;
  protein_g: number;
}

export interface PointEngineVersion {
  id: string;
  version: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface PointEngineRule {
  id: string;
  engine_version_id: string;
  rule_key: string;
  rule_value: number;
}

export interface FoodCategory {
  id: string;
  name: string;
  slug: string;
  zero_point: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string | null;
  equipment: string | null;
  description: string | null;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  workout_id: string | null;
  exercise_id: string | null;
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  rest_sec: number | null;
  duration_min: number | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
}

export interface PointEngineConfig {
  version: string;
  rules: Record<string, number>;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  package_size: string | null;
  barcode: string | null;
  zero_point: boolean;
  status: FoodStatus;
  kcal: number;
  protein_g: number;
  points_per_100g: number;
  points_per_serving: number;
  serving_description: string | null;
  category_name?: string;
  category_slug?: string;
}
