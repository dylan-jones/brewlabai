import type { Recipe } from "./types";

export function normalizeRecipeIds(recipe: Recipe): Recipe {
  const reserved = new Set([...recipe.grains, ...recipe.hops].map((ingredient) => ingredient.id));
  const seen = new Set<string>();
  let changed = false;
  function normalize<Ingredient extends { id: string }>(ingredients: Ingredient[]): Ingredient[] {
    return ingredients.map((ingredient) => {
      if (!seen.has(ingredient.id)) {
        seen.add(ingredient.id);
        return ingredient;
      }
      let nextId: string;
      do { nextId = crypto.randomUUID(); } while (reserved.has(nextId));
      reserved.add(nextId);
      seen.add(nextId);
      changed = true;
      return { ...ingredient, id: nextId };
    });
  }
  const grains = normalize(recipe.grains);
  const hops = normalize(recipe.hops);
  return changed ? { ...recipe, grains, hops } : recipe;
}