import { z } from "zod";

const text = z.string().trim().min(1).max(160);
const number = (min: number, max: number) =>
  z.number().finite().min(min).max(max);

export const recipeSchema = z.object({
  name: text,
  style: text,
  batchLiters: number(1, 1000),
  efficiency: number(1, 100),
  boilMinutes: number(0, 180),
  boilOff: number(0, 20),
  mashTunLiters: number(1, 2000),
  mashC: number(45, 80),
  yeast: text,
  attenuation: number(1, 100),
  grains: z
    .array(
      z.object({
        id: text,
        name: text,
        kg: number(0, 1000),
        color: number(0, 600),
        ppg: number(0, 46),
      }),
    )
    .min(1)
    .max(40),
  hops: z
    .array(
      z.object({
        id: text,
        name: text,
        grams: number(0, 50000),
        alpha: number(0, 30),
        minutes: number(0, 180),
        use: z.enum(["boil", "whirlpool", "dry hop"]),
        ageMonths: number(0, 120),
      }),
    )
    .max(40),
  water: z.object({
    calcium: number(0, 500),
    sulfate: number(0, 1000),
    chloride: number(0, 1000),
    gypsum: number(0, 500),
    calciumChloride: number(0, 500),
  }),
});

export const recipeDraftSchema = recipeSchema.extend({
  name: z.string().trim().max(160),
  style: z.string().trim().max(160),
  yeast: z.string().trim().max(160),
  grains: z.array(recipeSchema.shape.grains.element).max(40),
});

export const supplierSchema = z.object({
  id: text,
  name: text,
  url: z
    .url()
    .refine(
      (value) => new URL(value).protocol === "https:",
      "Use an HTTPS supplier URL",
    ),
  shipping: number(0, 1000),
  currency: z.enum(["ZAR", "GBP", "USD", "EUR", "AUD", "NZD", "CAD"]).default("ZAR"),
  catalogSync: z.object({
    source: z.enum(["beerguevara", "feed"]),
    checkedAt: z.iso.datetime(),
    scanned: z.number().int().min(0).max(5000),
    skipped: z.number().int().min(0).max(5000),
  }).optional(),
  products: z
    .array(
      z.object({
        ingredient: text,
        kind: z.enum(["grain", "hop", "yeast", "salt"]),
        packageSize: number(0.001, 50000),
        price: number(0, 100000),
        stock: number(0, 100000).int(),
        substitutes: z.array(text).max(20).optional(),
      }),
    )
    .max(5000),
});

export const inventorySchema = z
  .array(
    z.object({
      id: text,
      name: text,
      kind: z.enum(["grain", "hop", "yeast", "salt"]),
      quantity: number(0, 1000000),
      unit: z.enum(["kg", "g", "pack"]),
      alpha: number(0, 30).optional(),
      lot: z.string().max(160).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .max(10000);

export const proposalSchema = z.object({
  explanation: z.string().min(1).max(4000),
  recipe: recipeSchema,
});
export const aiRequestSchema = z.object({
  recipe: recipeDraftSchema,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(12),
});

export const builderStyleSchema = z.object({
  style: text,
  overview: z.string().trim().min(1).max(700),
});
export const builderStylesSchema = z.object({
  styles: z.array(builderStyleSchema).min(1).max(5),
});
export const builderRequestSchema = z.object({
  action: z.enum(["styles", "recipe"]),
  mode: z.enum(["inventory", "mixed", "stockists"]),
  supplierIds: z.array(text).max(100),
  brief: z.string().trim().max(3000),
  recipe: recipeDraftSchema,
  excludedStyles: z.array(text).max(40).default([]),
  style: builderStyleSchema.optional(),
}).strict().superRefine((input, context) => {
  if (input.mode !== "inventory" && !input.supplierIds.length)
    context.addIssue({ code: "custom", path: ["supplierIds"], message: "Select at least one stockist." });
  if (input.action === "recipe" && !input.style)
    context.addIssue({ code: "custom", path: ["style"], message: "Select a style." });
});
