import type { InventoryItem, Recipe, Supplier } from "./types";

export const initialRecipe: Recipe = {
  name: "Citra–Mosaic Hazy DIPA",
  style: "22A · Double IPA",
  batchLiters: 20,
  efficiency: 74,
  boilMinutes: 60,
  boilOff: 3,
  mashTunLiters: 40,
  mashC: 67,
  yeast: "London Ale III",
  attenuation: 79,
  grains: [
    { id: "golden", name: "Golden Promise", kg: 5, color: 2.8, ppg: 37 },
    { id: "oats", name: "Flaked Oats", kg: 1.2, color: 1.5, ppg: 33 },
    { id: "wheat", name: "Wheat Malt", kg: 0.3, color: 2, ppg: 38 },
    { id: "carapils", name: "Carapils", kg: 0.5, color: 1.8, ppg: 33 },
  ],
  hops: [
    {
      id: "magnum",
      name: "Magnum",
      grams: 15,
      alpha: 14,
      minutes: 60,
      use: "boil",
      ageMonths: 0,
    },
    {
      id: "citra-wp",
      name: "Citra",
      grams: 40,
      alpha: 13,
      minutes: 20,
      use: "whirlpool",
      ageMonths: 0,
    },
    {
      id: "mosaic-wp",
      name: "Mosaic",
      grams: 40,
      alpha: 12.5,
      minutes: 20,
      use: "whirlpool",
      ageMonths: 0,
    },
    {
      id: "citra-dh",
      name: "Citra",
      grams: 60,
      alpha: 13,
      minutes: 0,
      use: "dry hop",
      ageMonths: 0,
    },
    {
      id: "mosaic-dh",
      name: "Mosaic",
      grams: 50,
      alpha: 12.5,
      minutes: 0,
      use: "dry hop",
      ageMonths: 0,
    },
  ],
  water: {
    calcium: 25,
    sulfate: 20,
    chloride: 30,
    gypsum: 2,
    calciumChloride: 5,
  },
};

export const sampleInventory: InventoryItem[] = [
  {
    id: "1",
    name: "Golden Promise",
    kind: "grain",
    quantity: 5.5,
    unit: "kg",
    lot: "GP-2401",
  },
  { id: "2", name: "Flaked Oats", kind: "grain", quantity: 1.5, unit: "kg" },
  { id: "3", name: "Wheat Malt", kind: "grain", quantity: 0.6, unit: "kg" },
  { id: "4", name: "Magnum", kind: "hop", quantity: 50, unit: "g", alpha: 14 },
  {
    id: "5",
    name: "Mosaic",
    kind: "hop",
    quantity: 100,
    unit: "g",
    alpha: 12.5,
  },
  { id: "6", name: "Citra", kind: "hop", quantity: 40, unit: "g", alpha: 13 },
  { id: "7", name: "London Ale III", kind: "yeast", quantity: 1, unit: "pack" },
  { id: "8", name: "Gypsum", kind: "salt", quantity: 100, unit: "g" },
  { id: "9", name: "Calcium chloride", kind: "salt", quantity: 100, unit: "g" },
];

export const sampleSuppliers: Supplier[] = [
  {
    id: "malt-miller",
    name: "The Malt Miller",
    url: "https://www.themaltmiller.co.uk",
    shipping: 5.99,
    currency: "GBP",
    products: [
      {
        ingredient: "Carapils",
        kind: "grain",
        packageSize: 0.5,
        price: 1.65,
        stock: 20,
      },
      {
        ingredient: "Citra",
        kind: "hop",
        packageSize: 100,
        price: 7.25,
        stock: 12,
      },
      {
        ingredient: "Flaked Oats",
        kind: "grain",
        packageSize: 0.5,
        price: 1.5,
        stock: 12,
        substitutes: ["Carapils"],
      },
    ],
  },
  {
    id: "get-er-brewed",
    name: "Get Er Brewed",
    url: "https://www.geterbrewed.com",
    shipping: 6.5,
    currency: "GBP",
    products: [
      {
        ingredient: "Carapils",
        kind: "grain",
        packageSize: 1,
        price: 3.4,
        stock: 10,
      },
      {
        ingredient: "Citra",
        kind: "hop",
        packageSize: 100,
        price: 6.9,
        stock: 8,
      },
    ],
  },
];

export const grainCatalog = [
  { name: "Golden Promise", color: 2.8, ppg: 37 },
  { name: "Flaked Oats", color: 1.5, ppg: 33 },
  { name: "Wheat Malt", color: 2, ppg: 38 },
  { name: "Carapils", color: 1.8, ppg: 33 },
  { name: "Pilsner Malt", color: 1.7, ppg: 37 },
  { name: "Munich Malt", color: 9, ppg: 35 },
  { name: "Roasted Barley", color: 500, ppg: 25 },
];

export const hopCatalog = [
  { name: "Citra", alpha: 13 },
  { name: "Mosaic", alpha: 12.5 },
  { name: "Magnum", alpha: 14 },
  { name: "Galaxy", alpha: 14.5 },
  { name: "Saaz", alpha: 3.5 },
  { name: "Cascade", alpha: 6 },
];
