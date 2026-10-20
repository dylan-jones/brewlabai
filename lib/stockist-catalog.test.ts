import { afterEach, describe, expect, it, vi } from "vitest";
import { hasBeerGuevaraConnector, parseBeerGuevaraProduct, wooCatalogPageSchema } from "./stockist-catalog";
import { scrapeBeerGuevara } from "./stockist-scraper";

vi.mock("server-only", () => ({}));

const product = {
  id: 50333, name: "Chateau Cara Ultra 150 Malt (EBC ) &#8211; 500g", type: "simple",
  categories: [{ slug: "malts" }], prices: { price: "2600", currency_code: "ZAR", currency_minor_unit: 2 },
  is_purchasable: true, is_in_stock: true, is_on_backorder: false,
  low_stock_remaining: null, stock_availability: { text: "10 in stock" }, sold_individually: false,
};

describe("BeerGuevara catalog normalization", () => {
  it("converts published grain pack sizes, minor-unit prices, and quantities", () => {
    expect(parseBeerGuevaraProduct(product)).toEqual({ ingredient: "Chateau Cara Ultra 150 Malt (EBC )", kind: "grain", packageSize: 0.5, price: 26, stock: 10 });
  });
  it("decodes hop names and keeps hop weights in grams", () => {
    expect(parseBeerGuevaraProduct({ ...product, name: "Rakau &#8211; 50g", categories: [{ slug: "hops" }], low_stock_remaining: 5, prices: { ...product.prices, price: "4500" } }))
      .toMatchObject({ ingredient: "Rakau", kind: "hop", packageSize: 50, price: 45, stock: 5 });
  });
  it("imports yeast in packs, not grams", () => {
    expect(parseBeerGuevaraProduct({ ...product, name: "Safale US-05 - 11.5g", categories: [{ slug: "yeast" }] }))
      .toMatchObject({ ingredient: "Safale US-05", kind: "yeast", packageSize: 1 });
  });
  it("recognizes leaf-only categories used by the live catalog", () => {
    expect(parseBeerGuevaraProduct({ ...product, name: "Pale Malt - 1kg", categories: [{ slug: "base-malts" }] })).toMatchObject({ kind: "grain", packageSize: 1 });
    expect(parseBeerGuevaraProduct({ ...product, name: "SALE! (S-23) Lager Yeast", categories: [{ slug: "dry-yeasts" }] })).toMatchObject({ ingredient: "(S-23) Lager Yeast", kind: "yeast", packageSize: 1 });
    expect(parseBeerGuevaraProduct({ ...product, name: "Southern Passion 100g", categories: [{ slug: "sa-hops" }] })).toMatchObject({ kind: "hop", packageSize: 100 });
  });
  it("does not invent quantities from a generic in-stock label", () => {
    expect(parseBeerGuevaraProduct({ ...product, stock_availability: { text: "In stock" } })).toBeNull();
    expect(parseBeerGuevaraProduct({ ...product, is_on_backorder: true })).toBeNull();
    expect(parseBeerGuevaraProduct({ ...product, is_in_stock: false })).toMatchObject({ stock: 0 });
  });
  it("skips unsupported equipment, multipacks, and ambiguous pack sizes", () => {
    expect(parseBeerGuevaraProduct({ ...product, name: "Keg", categories: [{ slug: "equipment" }] })).toBeNull();
    expect(parseBeerGuevaraProduct({ ...product, name: "Pale Malt" })).toBeNull();
    expect(parseBeerGuevaraProduct({ ...product, name: "Pale Malt 5 x 1kg" })).toBeNull();
    expect(parseBeerGuevaraProduct({ ...product, name: "Pale Malt 0,5kg" })).toBeNull();
    expect(parseBeerGuevaraProduct({ ...product, name: "Pale Malt .5kg" })).toBeNull();
    expect(parseBeerGuevaraProduct({ ...product, type: "variable" })).toBeNull();
  });
  it("rejects malformed products, prices, or unexpected currency", () => {
    expect(wooCatalogPageSchema.safeParse([{}]).success).toBe(false);
    expect(parseBeerGuevaraProduct({ ...product, prices: { ...product.prices, price: "NaN" } })).toBeNull();
    expect(() => parseBeerGuevaraProduct({ ...product, prices: { ...product.prices, currency_code: "USD" } })).toThrow("currency");
  });
  it("only enables the fixed connector for the exact public storefront host", () => {
    expect(hasBeerGuevaraConnector("https://beerguevara.com/shop/")).toBe(true);
    expect(hasBeerGuevaraConnector("https://www.beerguevara.com/")).toBe(true);
    for (const url of ["https://beerguevara.com.attacker.example", "https://beerguevara.com:8443", "https://user:pass@beerguevara.com", "https://127.0.0.1", "http://beerguevara.com", "not a URL"])
      expect(hasBeerGuevaraConnector(url)).toBe(false);
  });
});

describe("bounded BeerGuevara catalog fetch", () => {
  afterEach(() => vi.unstubAllGlobals());
  function page(rows: unknown[], count = rows.length, pages = 1) {
    return Response.json(rows, { headers: { "x-wp-total": String(count), "x-wp-totalpages": String(pages) } });
  }
  it("fetches all pages from the fixed endpoint and reports omitted products", async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ ...product, id: index + 1 }));
    const fetcher = vi.fn().mockResolvedValueOnce(page(first, 101, 2)).mockResolvedValueOnce(page([{ ...product, id: 101, name: "Keg", categories: [{ slug: "equipment" }] }], 101, 2));
    vi.stubGlobal("fetch", fetcher);
    const result = await scrapeBeerGuevara();
    expect(result).toMatchObject({ scanned: 101, skipped: 1 });
    expect(result.products).toHaveLength(100);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url, options] of fetcher.mock.calls) {
      expect(url.origin).toBe("https://beerguevara.com");
      expect(url.pathname).toBe("/wp-json/wc/store/v1/products");
      expect(options).toMatchObject({ redirect: "error", cache: "no-store", credentials: "omit" });
    }
    expect(fetcher.mock.calls[1][0].searchParams.get("page")).toBe("2");
  });
  it("fails rather than returning a partial catalog when a later page fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, index) => ({ ...product, id: index + 1 })), 101, 2)).mockResolvedValueOnce(new Response("Unavailable", { status: 503 })));
    await expect(scrapeBeerGuevara()).rejects.toMatchObject({ status: 502 });
  });
  it.each([
    { rows: [product], count: 101, pages: 2 },
    { rows: [product], count: 1001, pages: 11 },
    { rows: [product, product], count: 2, pages: 1 },
    { rows: [{}], count: 1, pages: 1 },
  ])("rejects truncated, oversized, duplicate, or invalid catalogs: %j", async ({ rows, count, pages }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page(rows, count, pages)));
    await expect(scrapeBeerGuevara()).rejects.toMatchObject({ status: 502 });
  });
  it("rejects unbounded responses and rate limits", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([product])));
    await expect(scrapeBeerGuevara()).rejects.toMatchObject({ status: 502 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Slow down", { status: 429 })));
    await expect(scrapeBeerGuevara()).rejects.toMatchObject({ status: 429 });
  });
  it("does not replace the catalog when no verified ingredients can be imported", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([{ ...product, stock_availability: { text: "In stock" } }])));
    await expect(scrapeBeerGuevara()).rejects.toThrow("No ingredients with verified");
  });
});

it.skipIf(process.env.TEST_BEERGUEVARA_LIVE !== "1")("reads the current public BeerGuevara catalog", async () => {
  const result = await scrapeBeerGuevara();
  expect(result.products.length).toBeGreaterThan(0);
  expect(result.scanned).toBe(result.products.length + result.skipped);
  console.info("BeerGuevara live import", {
    scanned: result.scanned, imported: result.products.length, skipped: result.skipped,
    kinds: result.products.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.kind]: (counts[item.kind] ?? 0) + 1 }), {}),
    sample: result.products.slice(0, 3),
  });
}, 50000);