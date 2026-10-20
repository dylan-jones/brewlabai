import { decodeHTML } from "entities";
import { z } from "zod";
import { supplierSchema } from "./schemas";
import type { SupplierProduct } from "./types";

const wooProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().max(1000),
  type: z.string(),
  categories: z.array(z.object({ slug: z.string() })),
  prices: z.object({ price: z.string(), currency_code: z.string(), currency_minor_unit: z.number().int().min(0).max(4) }),
  is_purchasable: z.boolean(),
  is_in_stock: z.boolean(),
  is_on_backorder: z.boolean(),
  low_stock_remaining: z.number().int().nonnegative().nullable().optional(),
  stock_availability: z.object({ text: z.string() }),
  sold_individually: z.boolean(),
});

export const wooCatalogPageSchema = z.array(wooProductSchema).max(100);
type WooProduct = z.infer<typeof wooProductSchema>;

export function hasBeerGuevaraConnector(website: string) {
  try {
    const url = new URL(website);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["beerguevara.com", "www.beerguevara.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

function ingredientKind(product: WooProduct, name: string): SupplierProduct["kind"] | null {
  const categories = new Set(product.categories.map((category) => category.slug));
  if (/\b(kit|extract|nutrient|cleaner|saniti[sz]er)\b/i.test(name)) return null;
  if (["hops", "imported-hops", "sa-hops"].some((category) => categories.has(category))) return "hop";
  if (["malts", "base-malts", "specialty-malts", "unmalted-grains"].some((category) => categories.has(category))) return "grain";
  if (["yeast", "yeasts", "dry-yeasts", "liquid-yeasts"].some((category) => categories.has(category))) return "yeast";
  if (/\b(gypsum|calcium chloride)\b/i.test(name)) return "salt";
  return null;
}

function packageDetails(name: string, kind: SupplierProduct["kind"]) {
  if (/\b\d+\s*[x\u00d7]\s*\d/i.test(name)) return null;
  const fallback = kind === "yeast" ? { ingredient: name, packageSize: 1 } : null;
  const label = name.endsWith(")") ? name.slice(0, -1).trimEnd() : name;
  const unit = /(kg|g|grams?|kilograms?)$/i.exec(label);
  if (!unit) return fallback;
  const prefix = label.slice(0, unit.index).trimEnd();
  let start = prefix.length;
  while (start > 0 && /[0-9.]/.test(prefix[start - 1])) start--;
  const amount = prefix.slice(start);
  if (!/^\d+(?:\.\d+)?$/.test(amount) || (start > 0 && !/[\s\-\u2013\u2014(]/.test(prefix[start - 1]))) return fallback;
  let end = start;
  while (end > 0 && /[\s\-\u2013\u2014(]/.test(prefix[end - 1])) end--;
  const ingredient = prefix.slice(0, end);
  if (!ingredient) return null;
  if (kind === "yeast") return { ingredient, packageSize: 1 };
  const grams = Number(amount) * (/^(kg|kilogram)/i.test(unit[1]) ? 1000 : 1);
  return { ingredient, packageSize: kind === "grain" ? grams / 1000 : grams };
}

function publishedStock(product: WooProduct) {
  if (!product.is_in_stock) return 0;
  if (product.is_on_backorder) return null;
  const text = /^\s*(\d+)\s+in stock\s*$/i.exec(decodeHTML(product.stock_availability.text));
  const count = product.low_stock_remaining ?? (text ? Number(text[1]) : null);
  if (count === null) return null;
  return product.sold_individually ? Math.min(count, 1) : count;
}

export function parseBeerGuevaraProduct(product: WooProduct): SupplierProduct | null {
  const name = decodeHTML(product.name).replace(/^SALE!\s*/i, "").trim();
  const kind = ingredientKind(product, name);
  if (!kind || product.type !== "simple" || !product.is_purchasable) return null;
  if (product.prices.currency_code !== "ZAR") throw new Error("BeerGuevara returned an unexpected currency.");
  const details = packageDetails(name, kind);
  const stock = publishedStock(product);
  if (!details || stock === null || !/^\d+$/.test(product.prices.price)) return null;
  const parsed = supplierSchema.shape.products.element.safeParse({
    ...details, kind, stock,
    price: Number(product.prices.price) / 10 ** product.prices.currency_minor_unit,
  });
  return parsed.success ? parsed.data : null;
}