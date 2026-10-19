import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBrewfatherInventory,
  normalizeBrewfatherItem,
} from "./brewfather";

const credentials = {
  userId: "test-brewer",
  apiKey: "test-only",
  version: "v2" as const,
};

afterEach(() => vi.unstubAllGlobals());

describe("Brewfather inventory", () => {
  it("normalizes metric inventory and preserves batch metadata", () => {
    const grain = normalizeBrewfatherItem(
      {
        _id: "grain",
        name: "Pilsner",
        inventory: 5,
        inventoryBatches: [{ batch: "A", inventory: 5 }],
      },
      "grain",
    );
    expect(grain.quantity).toBe(5);
    expect(grain.unit).toBe("kg");
    expect(grain.metadata?.inventoryBatches).toEqual([
      { batch: "A", inventory: 5 },
    ]);
    expect(
      normalizeBrewfatherItem(
        { _id: "hop", name: "Citra", inventory: 100, alpha: 13 },
        "hop",
      ).quantity,
    ).toBe(100);
    expect(
      normalizeBrewfatherItem(
        { _id: "yeast", name: "US-05", inventory: 2 },
        "yeast",
      ).unit,
    ).toBe("pack");
  });
  it("reads all four collections and follows v2 cursors", async () => {
    const calls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        calls.push(new URL(url));
        const rows =
          url.pathname.endsWith("/fermentables") &&
          !url.searchParams.has("start_after")
            ? Array.from({ length: 50 }, (_, index) => ({
                _id: `id-${index}`,
                name: `Malt ${index}`,
                inventory: 1,
              }))
            : [];
        return Response.json(rows);
      }),
    );
    const result = await fetchBrewfatherInventory(credentials);
    expect(result).toHaveLength(50);
    expect(result[0].quantity).toBe(1);
    expect(calls.every((url) => url.searchParams.get("inventory_exists") === "true")).toBe(true);
    expect(calls[1].searchParams.get("start_after")).toBe("id-49");
    expect(calls.map((url) => url.pathname.split("/").at(-1))).toEqual([
      "fermentables",
      "fermentables",
      "hops",
      "yeasts",
      "miscs",
    ]);
  });
  it("uses offset pagination for requested legacy v1", async () => {
    const calls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        calls.push(new URL(url));
        return Response.json(
          url.pathname.endsWith("/fermentables") &&
            url.searchParams.get("offset") === "0"
            ? Array.from({ length: 50 }, (_, index) => ({
                _id: String(index),
                name: "Malt",
                inventory: 0,
              }))
            : [],
        );
      }),
    );
    const result = await fetchBrewfatherInventory({ ...credentials, version: "v1" });
    expect(result).toEqual([]);
    expect(calls[1].pathname).toContain("/v1/");
    expect(calls[1].searchParams.get("offset")).toBe("50");
  });
  it("fails on rate limits instead of returning partial stock", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 429 })),
    );
    await expect(fetchBrewfatherInventory(credentials)).rejects.toThrow(
      "rate limit",
    );
  });

  it("excludes zero, negative, null, and missing stock from every collection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([
      { _id: "zero", name: "Gypsum", inventory: 0 },
      { _id: "string-zero", name: "Gypsum", inventory: "0" },
      { _id: "negative", name: "Gypsum", inventory: -1 },
      { _id: "null", name: "Gypsum", inventory: null },
      { _id: "missing", name: "Gypsum" },
      { _id: "stock", name: "Gypsum", inventory: "0.25" },
    ])));
    const result = await fetchBrewfatherInventory(credentials);
    expect(result).toHaveLength(4);
    expect(result.map((item) => item.id)).toEqual(["grain-stock", "hop-stock", "yeast-stock", "salt-stock"]);
    expect(result.every((item) => item.quantity === 0.25)).toBe(true);
  });
});
