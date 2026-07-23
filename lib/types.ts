export type ChipType = 'grain' | 'veggie' | 'protein' | 'fruit' | 'test' | 'etc';

export interface MealIngredient {
  name: string;
  amount?: string;
  type: ChipType;
  test?: boolean;
}

export interface MealPlan {
  date: string; // YYYY-MM-DD
  slot: 'morning' | 'evening';
  ingredients: MealIngredient[];
  note?: string | null;
}

export interface Baby {
  name: string;
  birth_date: string;
  start_date: string;
  stage: string;
  weight: number;
}

export interface GrowthRecord {
  id: number;
  date: string;
  weight: number;
  height: number | null;
}

export interface FridgeItem {
  id: number;
  ingredient: string;
  size: number;
  count: number;
  made_date: string | null;
}

export interface AllergyTest {
  id: number;
  name: string;
  high_risk: boolean;
  status: 'in_progress' | 'queued' | 'completed';
  queue_order: number | null;
  start_date: string | null;
}

export interface TestedIngredient {
  id: number;
  name: string;
  category: string;
  excluded: boolean;
}

export const CATEGORY_CHIP: Record<string, ChipType> = {
  곡류: 'grain',
  단백질: 'protein',
  채소: 'veggie',
  과일: 'fruit',
  기타: 'etc',
};
