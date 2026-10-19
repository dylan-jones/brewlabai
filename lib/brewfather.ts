import { z } from "zod";
import { ApiError } from "./api";
import type { IngredientKind, InventoryItem } from "./types";

export const brewfatherCredentials = z.object({
  userId: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-zA-Z0-9_-]+$/),
  apiKey: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[\x21-\x7E]+$/),
  version: z.enum(["v1", "v2"]),
});

const itemSchema = z
  .object({
    _id: z.string().min(1),
    name: z.string().min(1),
    inventory: z.coerce.number().finite().default(0),
    alpha: z.coerce.number().finite().optional(),
    lotNumber: z.string().optional(),
  })
  .passthrough();

export function normalizeBrewfatherItem(
  raw: unknown,
  kind: IngredientKind,
): InventoryItem {
  const item = itemSchema.parse(raw);
  const quantity = Math.max(0, item.inventory);
  return {
    id: `${kind}-${item._id}`,
    name: item.name,
    kind,
    quantity: kind === "grain" ? quantity / 1000 : quantity,
    unit: kind === "grain" ? "kg" : kind === "yeast" ? "pack" : "g",
    ...(kind === "hop" && item.alpha !== undefined
      ? { alpha: Math.min(30, Math.max(0, item.alpha)) }
      : {}),
    ...(item.lotNumber ? { lot: item.lotNumber } : {}),
    metadata: item,
  };
}

export async function fetchBrewfatherInventory(
  credentials: z.infer<typeof brewfatherCredentials>,
) {
  const inventory: InventoryItem[] = [];
  const headers = {
    Authorization: `Basic ${btoa(`${credentials.userId}:${credentials.apiKey}`)}`,
  };
  const collections = [
    { path: "fermentables", kind: "grain" },
    { path: "hops", kind: "hop" },
    { path: "yeasts", kind: "yeast" },
    { path: "miscs", kind: "salt" },
  ] as const;
  for (const collection of collections) {
    let cursor = "";
    for (let page = 0; page < 100; page++) {
      const url = new URL(
        `https://api.brewfather.app/${credentials.version}/inventory/${collection.path}`,
      );
      url.searchParams.set("limit", "50");
      url.searchParams.set("complete", "true");
      if (credentials.version === "v1")
        url.searchParams.set("offset", String(page * 50));
      else if (cursor) url.searchParams.set("start_after", cursor);
      const response = await fetch(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (response.status === 429)
        throw new ApiError(
          "Brewfather rate limit reached. Wait before syncing again.",
          429,
        );
      if (response.status === 401 || response.status === 403)
        throw new ApiError(
          "Brewfather rejected these credentials. Check the API key and inventory.read scope.",
          403,
        );
      if (!response.ok)
        throw new ApiError(
          `Brewfather inventory request failed (${response.status}). Try the v2 API if v1 is unavailable.`,
          502,
        );
      const rows = z
        .array(itemSchema)
        .max(50)
        .parse(await response.json());
      for (const row of rows) {
        if (
          collection.kind === "salt" &&
          !/gypsum|calcium chloride|epsom|baking soda|chalk|sodium|water agent/i.test(
            `${row.name} ${row.type ?? ""}`,
          )
        )
          continue;
        inventory.push(normalizeBrewfatherItem(row, collection.kind));
      }
      if (rows.length < 50) break;
      const nextCursor = rows.at(-1)!._id;
      if (credentials.version === "v2" && cursor === nextCursor)
        throw new ApiError("Brewfather pagination did not advance.", 502);
      cursor = nextCursor;
      if (page === 99)
        throw new ApiError(
          "Inventory exceeds the sync limit. No partial inventory was saved.",
          422,
        );
    }
  }
  return inventory;
}
