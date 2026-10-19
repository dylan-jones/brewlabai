import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyRecipe, initialRecipe, sampleInventory, sampleSuppliers } from "./seed";
import { aiRequestSchema, recipeDraftSchema, recipeSchema, supplierSchema } from "./schemas";
import { requirementsFor } from "./optimizer";
import { calculateRecipe } from "./calculations";
import { useBrewStore } from "./store";

vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));

describe("recipe drafts", () => {
  beforeEach(() => useBrewStore.setState(useBrewStore.getInitialState(), true));

  it("starts empty without stock ingredients or a placeholder recipe name", () => {
    expect(useBrewStore.getState().recipe).toEqual(createEmptyRecipe());
    expect(useBrewStore.getState().inventory).toEqual([]);
    expect(useBrewStore.getState().suppliers).toEqual([]);
    expect(useBrewStore.getState().savedRecipes).toEqual([]);
    expect(useBrewStore.getState().inventorySource).toBe("manual");
    expect(requirementsFor(createEmptyRecipe())).toEqual([]);
    const stats = calculateRecipe(createEmptyRecipe());
    expect(stats.og).toBe(1);
    expect(stats.abv).toBe(0);
    expect(stats.ibu).toBe(0);
  });

  it("supports ZAR stockists, defaults to ZAR, and preserves other currencies", () => {
    const stockist = { id: "personal-stockist", name: "My stockist", url: "https://example.com", shipping: 0, products: [] };
    expect(supplierSchema.parse(stockist).currency).toBe("ZAR");
    expect(supplierSchema.parse({ ...stockist, currency: "ZAR" }).currency).toBe("ZAR");
    expect(supplierSchema.parse({ ...stockist, currency: "GBP" }).currency).toBe("GBP");
    const merge = useBrewStore.persist.getOptions().merge!;
    const restored = merge({ suppliers: [{ ...stockist, currency: "ZAR" }] }, useBrewStore.getState());
    expect(restored.suppliers[0].currency).toBe("ZAR");
  });

  it("starts a fresh draft without carrying over ingredients or conversation", () => {
    useBrewStore.getState().setRecipe(structuredClone(initialRecipe));
    useBrewStore.getState().addMessage({ id: "old", role: "user", content: "Previous recipe" });
    useBrewStore.getState().startNewRecipe();
    expect(useBrewStore.getState().recipe).toEqual(createEmptyRecipe());
    expect(useBrewStore.getState().messages).toEqual([]);
  });

  it("restores an unnamed draft and preserves modified existing recipes", () => {
    const merge = useBrewStore.persist.getOptions().merge!;
    for (const recipe of [
      { ...createEmptyRecipe(), grains: [initialRecipe.grains[0]] },
      { ...initialRecipe, name: "My active brew" },
    ]) {
      expect(merge({ recipe }, useBrewStore.getState()).recipe).toEqual(recipe);
    }
  });

  it("does not restore the unchanged legacy sample as active work", () => {
    const merge = useBrewStore.persist.getOptions().merge!;
    expect(merge({ recipe: initialRecipe }, useBrewStore.getState()).recipe).toEqual(createEmptyRecipe());
  });

  it("removes legacy demo inventory, catalogs, and saved recipes on restore", () => {
    const merge = useBrewStore.persist.getOptions().merge!;
    const restored = merge({
      inventory: sampleInventory,
      inventorySource: "sample",
      suppliers: sampleSuppliers,
      savedRecipes: [{ id: "old-demo", recipe: initialRecipe, date: "2026-10-19" }],
    }, useBrewStore.getState());
    expect(restored.inventory).toEqual([]);
    expect(restored.suppliers).toEqual([]);
    expect(restored.savedRecipes).toEqual([]);
    expect(restored.inventorySource).toBe("manual");
  });

  it("preserves edited demo entries and personal work alongside old demo data", () => {
    const merge = useBrewStore.persist.getOptions().merge!;
    const inventory = { ...sampleInventory[0], quantity: 12 };
    const supplier = { ...sampleSuppliers[0], shipping: 15 };
    const saved = { id: "personal", recipe: { ...initialRecipe, name: "My brew" }, date: "2026-10-19" };
    const restored = merge({
      inventory: [...sampleInventory, inventory],
      suppliers: [...sampleSuppliers, supplier],
      savedRecipes: [saved],
    }, useBrewStore.getState());
    expect(restored.inventory).toEqual([inventory]);
    expect(restored.suppliers).toEqual([supplier]);
    expect(restored.savedRecipes).toEqual([saved]);
  });

  it("never removes real Brewfather inventory that matches a demo item", () => {
    const merge = useBrewStore.persist.getOptions().merge!;
    const restored = merge({ inventory: sampleInventory, inventorySource: "brewfather" }, useBrewStore.getState());
    expect(restored.inventory).toEqual(sampleInventory);
    expect(restored.inventorySource).toBe("brewfather");
  });

  it("does not reintroduce old demo records when account data loads", () => {
    const state = useBrewStore.getState();
    state.setInventory(sampleInventory, "manual");
    state.setSuppliers(sampleSuppliers);
    expect(useBrewStore.getState().inventory).toEqual([]);
    expect(useBrewStore.getState().suppliers).toEqual([]);
    state.setInventory(sampleInventory, "brewfather");
    expect(useBrewStore.getState().inventory).toEqual(sampleInventory);
  });

  it("clears an account's active recipe when switching accounts", () => {
    useBrewStore.setState({ accountId: "first", recipe: initialRecipe });
    useBrewStore.getState().clearAccountData("second");
    expect(useBrewStore.getState().recipe).toEqual(createEmptyRecipe());
  });

  it("accepts incomplete drafts for editing and AI, but not completed-recipe saves", () => {
    const recipe = createEmptyRecipe();
    expect(recipeDraftSchema.safeParse(recipe).success).toBe(true);
    expect(recipeSchema.safeParse(recipe).success).toBe(false);
    expect(aiRequestSchema.safeParse({ recipe, messages: [{ role: "user", content: "Make a pale ale" }] }).success).toBe(true);
  });
});