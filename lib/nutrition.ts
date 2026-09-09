import type { MealPlan } from './types';

export function countNutrition(meals: MealPlan[]) {
  let grain = 0;
  let protein = 0;
  const vegetables = new Set<string>();
  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      if (ingredient.type === 'grain') grain += 1;
      else if (ingredient.type === 'protein') protein += 1;
      else if (ingredient.type === 'veggie') vegetables.add(ingredient.name);
    }
  }
  return { grain, protein, veggie: vegetables.size, slots: meals.length };
}
