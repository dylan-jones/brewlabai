import { z } from "zod";
import { builderRequestSchema } from "./schemas";
import { optimizeSingleSupplier, requirementsFor } from "./optimizer";
import type { InventoryItem, Recipe, Supplier } from "./types";

export type BuilderRequest = z.infer<typeof builderRequestSchema>;

export function builderSources(input: BuilderRequest, inventory: InventoryItem[], suppliers: Supplier[]) {
  if (input.supplierIds.some((id) => !suppliers.some((supplier) => supplier.id === id)))
    throw new Error("A selected stockist is no longer available. Select your stockists again.");
  return {
    inventory: input.mode === "stockists" ? [] : inventory.filter((item) => item.quantity > 0),
    suppliers: input.mode === "inventory" ? [] : suppliers
      .filter((supplier) => input.supplierIds.includes(supplier.id))
      .map((supplier) => ({ ...supplier, products: supplier.products.filter((product) => product.stock > 0) })),
  };
}

export function checkBuilderRecipe(recipe: Recipe, inventory: InventoryItem[], suppliers: Supplier[]) {
  const sourcing = optimizeSingleSupplier(requirementsFor(recipe), inventory, suppliers, false);
  if (!recipe.grains.some((grain) => grain.kg > 0) || sourcing.status === "unavailable")
    throw new Error("The suggested recipe cannot be fulfilled from these sources. Try another style, a smaller batch, or different stockists.");
  return sourcing;
}