"use client";

import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { del, get, set } from "idb-keyval";
import { initialRecipe, sampleInventory, sampleSuppliers } from "./seed";
import { inventorySchema, recipeSchema, supplierSchema } from "./schemas";
import type { ChatMessage, InventoryItem, Recipe, Supplier } from "./types";

let storageFailure = false;
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
  inventorySource: "sample" | "brewfather" | "manual";
  lastSync: string | null;
  accountId: string | null;
  dark: boolean;
  units: "metric" | "imperial";
  setRecipe: (recipe: Recipe) => void;
  updateRecipe: (updates: Partial<Recipe>) => void;
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
      recipe: initialRecipe,
      inventory: sampleInventory,
      suppliers: sampleSuppliers,
      messages: [],
      savedRecipes: [],
      inventorySource: "sample",
      lastSync: null,
      accountId: null,
      dark: false,
      units: "metric",
      setRecipe: (recipe) => setState({ recipe }),
      updateRecipe: (updates) =>
        setState((state) => ({ recipe: { ...state.recipe, ...updates } })),
      setInventory: (inventory, inventorySource) =>
        setState({
          inventory,
          inventorySource,
          lastSync:
            inventorySource === "brewfather" ? new Date().toISOString() : null,
        }),
      setSuppliers: (suppliers) => setState({ suppliers }),
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
            recipe: getState().accountId ? initialRecipe : getState().recipe,
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
        const recipe = recipeSchema.safeParse(data.recipe);
        const inventory = inventorySchema.safeParse(data.inventory);
        const suppliers = supplierSchema.array().safeParse(data.suppliers);
        return {
          ...current,
          recipe: recipe.success ? recipe.data : current.recipe,
          inventory: inventory.success ? inventory.data : current.inventory,
          suppliers: suppliers.success ? suppliers.data : current.suppliers,
          dark: data.dark === true,
          units: data.units === "imperial" ? "imperial" : "metric",
          inventorySource:
            data.inventorySource === "brewfather" ||
            data.inventorySource === "manual"
              ? data.inventorySource
              : "sample",
          accountId: typeof data.accountId === "string" ? data.accountId : null,
          lastSync: typeof data.lastSync === "string" ? data.lastSync : null,
          savedRecipes: Array.isArray(data.savedRecipes)
            ? data.savedRecipes
                .filter(
                  (item) =>
                    typeof item.id === "string" &&
                    typeof item.date === "string" &&
                    recipeSchema.safeParse(item.recipe).success,
                )
                .slice(0, 100)
            : [],
          messages: [],
        };
      },
    },
  ),
);
