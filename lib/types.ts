export type IngredientKind = "grain" | "hop" | "yeast" | "salt";
export type HopUse = "boil" | "whirlpool" | "dry hop";

export interface Grain {
  id: string;
  name: string;
  kg: number;
  color: number;
  ppg: number;
}

export interface Hop {
  id: string;
  name: string;
  grams: number;
  alpha: number;
  minutes: number;
  use: HopUse;
  ageMonths: number;
}

export interface Recipe {
  name: string;
  style: string;
  batchLiters: number;
  efficiency: number;
  boilMinutes: number;
  boilOff: number;
  mashTunLiters: number;
  mashC: number;
  yeast: string;
  attenuation: number;
  grains: Grain[];
  hops: Hop[];
  water: {
    calcium: number;
    sulfate: number;
    chloride: number;
    gypsum: number;
    calciumChloride: number;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  kind: IngredientKind;
  quantity: number;
  unit: "kg" | "g" | "pack";
  alpha?: number;
  lot?: string;
  metadata?: Record<string, unknown>;
}

export interface SupplierProduct {
  ingredient: string;
  kind: IngredientKind;
  packageSize: number;
  price: number;
  stock: number;
  substitutes?: string[];
}

export interface Supplier {
  id: string;
  name: string;
  url: string;
  shipping: number;
  currency: string;
  products: SupplierProduct[];
}

export interface Requirement {
  name: string;
  kind: IngredientKind;
  quantity: number;
  unit: InventoryItem["unit"];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal?: Recipe;
}
