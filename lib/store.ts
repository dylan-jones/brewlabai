"use client";

import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { del, get, set } from "idb-keyval";
import { createEmptyRecipe, isLegacyDemoRecipe, sampleInventory, sampleSuppliers } from "./seed";
import { inventorySchema, recipeDraftSchema, recipeSchema, supplierSchema } from "./schemas";
import type { ChatMessage, InventoryItem, Recipe, Supplier } from "./types";
import { normalizeRecipeIds } from "./recipe";

let storageFailure = false;
function withoutDemoInventory(inventory: InventoryItem[], source: string | undefined) {
  return inventory.filter((item) => source === "brewfather" ||
    !sampleInventory.some((sample) => JSON.stringify(item) === JSON.stringify(sample)));
}

function withoutDemoSuppliers(suppliers: Supplier[]) {
  return suppliers.filter((item) =>
    !sampleSuppliers.some((sample) => JSON.stringify(item) === JSON.stringify(sample)));
}

export function hasStorageFailure() {
  return storageFailure;
}

const indexedStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await get<string>(name)) ?? null;
    } catch {
      storageFailure = true;
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await set(name, value);
    } catch {
      storageFailure = true;
    }
  },
  removeItem: async (name) => {
    try {
      await del(name);
    } catch {
      storageFailure = true;
    }
  },
};

interface BrewState {
  recipe: Recipe;
  inventory: InventoryItem[];
  suppliers: Supplier[];
  messages: ChatMessage[];
  savedRecipes: { id: string; recipe: Recipe; date: string }[];
  inventorySource: "brewfather" | "manual";
  lastSync: string | null;
  accountId: string | null;
  dark: boolean;
  units: "metric" | "imperial";
  setRecipe: (recipe: Recipe) => void;
  updateRecipe: (updates: Partial<Recipe>) => void;
  startNewRecipe: () => void;
  setInventory: (
    items: InventoryItem[],
    source: BrewState["inventorySource"],
  ) => void;
  setSuppliers: (suppliers: Supplier[]) => void;
  addMessage: (message: ChatMessage) => void;
  saveRecipe: () => void;
  removeSavedRecipe: (id: string) => void;
  toggleDark: () => void;
  setUnits: (units: BrewState["units"]) => void;
  clearAccountData: (accountId: string | null) => void;
}

export const useBrewStore = create<BrewState>()(
  persist(
    (setState, getState) => ({
      recipe: createEmptyRecipe(),
      inventory: [],
      suppliers: [],
      messages: [],
      savedRecipes: [],
      inventorySource: "manual",
      lastSync: null,
      accountId: null,
      dark: false,
      units: "metric",
      setRecipe: (recipe) => setState({ recipe: normalizeRecipeIds(recipe) }),
      updateRecipe: (updates) =>
        setState((state) => ({ recipe: normalizeRecipeIds({ ...state.recipe, ...updates }) })),
      startNewRecipe: () => setState({ recipe: createEmptyRecipe(), messages: [] }),
      setInventory: (inventory, inventorySource) =>
        setState({
          inventory: withoutDemoInventory(inventory, inventorySource),
          inventorySource,
          lastSync:
            inventorySource === "brewfather" ? new Date().toISOString() : null,
        }),
      setSuppliers: (suppliers) => setState({ suppliers: withoutDemoSuppliers(suppliers) }),
      addMessage: (message) =>
        setState((state) => ({
          messages: [...state.messages.slice(-19), message],
        })),
      saveRecipe: () =>
        setState((state) => ({
          savedRecipes: [
            {
              id: crypto.randomUUID(),
              recipe: structuredClone(state.recipe),
              date: new Date().toISOString(),
            },
            ...state.savedRecipes,
          ].slice(0, 100),
        })),
      removeSavedRecipe: (id) =>
        setState((state) => ({
          savedRecipes: state.savedRecipes.filter((recipe) => recipe.id !== id),
        })),
      toggleDark: () => setState((state) => ({ dark: !state.dark })),
      setUnits: (units) => setState({ units }),
      clearAccountData: (accountId) => {
        if (getState().accountId !== accountId)
          setState({
            recipe: getState().accountId ? createEmptyRecipe() : getState().recipe,
            accountId,
            inventory: [],
            suppliers: [],
            messages: [],
            savedRecipes: [],
            inventorySource: "manual",
            lastSync: null,
          });
      },
    }),
    {
      name: "brew-lab-v1",
      version: 1,
      storage: createJSONStorage(() => indexedStorage),
      skipHydration: true,
      merge: (persisted, current) => {
        const data = persisted as Partial<BrewState> | undefined;
        if (!data) return current;
        const recipe = recipeDraftSchema.safeParse(data.recipe);
        const inventory = inventorySchema.safeParse(data.inventory);
        const suppliers = supplierSchema.array().safeParse(data.suppliers);
        return {
          ...current,
          recipe: recipe.success && !isLegacyDemoRecipe(recipe.data)
            ? normalizeRecipeIds(recipe.data)
            : createEmptyRecipe(),
          inventory: inventory.success
            ? withoutDemoInventory(inventory.data, data.inventorySource)
            : current.inventory,
          suppliers: suppliers.success
            ? withoutDemoSuppliers(suppliers.data)
            : current.suppliers,
          dark: data.dark === true,
          units: data.units === "imperial" ? "imperial" : "metric",
          inventorySource:
            data.inventorySource === "brewfather" ||
            data.inventorySource === "manual"
              ? data.inventorySource
              : "manual",
          accountId: typeof data.accountId === "string" ? data.accountId : null,
          lastSync: typeof data.lastSync === "string" ? data.lastSync : null,
          savedRecipes: Array.isArray(data.savedRecipes)
            ? data.savedRecipes
                .filter(
                  (item) =>
                    typeof item.id === "string" &&
                    typeof item.date === "string" &&
                    recipeSchema.safeParse(item.recipe).success &&
                    !isLegacyDemoRecipe(item.recipe),
                )
                .slice(0, 100)
                .map((item) => ({ ...item, recipe: normalizeRecipeIds(item.recipe) }))
            : [],
          messages: [],
        };
      },
    },
  ),
);
