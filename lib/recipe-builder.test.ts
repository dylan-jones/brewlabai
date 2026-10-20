import { describe, expect, it } from "vitest";
import { builderRequestSchema } from "./schemas";
import { builderSources, checkBuilderRecipe } from "./recipe-builder";
import { createEmptyRecipe, initialRecipe } from "./seed";
import { requirementsFor } from "./optimizer";
import type { InventoryItem, Supplier } from "./types";

const inventory: InventoryItem[] = requirementsFor(initialRecipe).map((item, index) => ({ ...item, id: String(index) }));
const supplier: Supplier = {
  id: "chosen", name: "Chosen stockist", url: "https://example.com", currency: "ZAR", shipping: 0,
  products: requirementsFor(initialRecipe).map((item) => ({ ingredient: item.name, kind: item.kind, packageSize: item.quantity, stock: 1, price: 10 })),
};
const request = (mode: "inventory" | "mixed" | "stockists") => builderRequestSchema.parse({
  action: "styles", mode, supplierIds: mode === "inventory" ? [] : ["chosen"], brief: "Summer beer", recipe: createEmptyRecipe(),
});

describe("guided recipe sourcing", () => {
  it("limits inventory-only suggestions to positive inventory without any suppliers", () => {
    const sources = builderSources(request("inventory"), inventory, [supplier]);
    expect(sources.suppliers).toEqual([]);
    expect(checkBuilderRecipe(initialRecipe, sources.inventory, sources.suppliers).status).toBe("in-stock");
    expect(() => checkBuilderRecipe(initialRecipe, [], sources.suppliers)).toThrow("cannot be fulfilled");
  });
  it("uses inventory first and only selected stockists for shortages", () => {
    const sources = builderSources(request("mixed"), [], [supplier, { ...supplier, id: "other" }]);
    expect(sources.suppliers.map((item) => item.id)).toEqual(["chosen"]);
    expect(checkBuilderRecipe(initialRecipe, sources.inventory, sources.suppliers).status).toBe("matched");
  });
  it("ignores owned inventory in stockists-only mode", () => {
    const sources = builderSources(request("stockists"), inventory, [supplier]);
    expect(sources.inventory).toEqual([]);
    expect(checkBuilderRecipe(initialRecipe, sources.inventory, sources.suppliers).status).toBe("matched");
  });
  it("rejects unknown stockists and missing selections", () => {
    expect(() => builderSources(request("mixed"), inventory, [])).toThrow("no longer available");
    expect(builderRequestSchema.safeParse({ ...request("mixed"), supplierIds: [] }).success).toBe(false);
    expect(builderRequestSchema.safeParse({ ...request("inventory"), action: "recipe" }).success).toBe(false);
  });
  it("does not treat substitutions or insufficient stock as an exact source", () => {
    const altered = { ...supplier, products: supplier.products.map((product) => ({ ...product, ingredient: "Other " + product.ingredient, substitutes: [product.ingredient] })) };
    expect(() => checkBuilderRecipe(initialRecipe, [], [altered])).toThrow("cannot be fulfilled");
    expect(() => checkBuilderRecipe(initialRecipe, inventory.map((item) => ({ ...item, quantity: 0 })), [])).toThrow();
  });
});