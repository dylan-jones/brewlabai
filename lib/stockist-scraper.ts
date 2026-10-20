import "server-only";
import { ApiError, readJSON } from "./api";
import { parseBeerGuevaraProduct, wooCatalogPageSchema } from "./stockist-catalog";
import type { SupplierProduct } from "./types";

const pageSize = 100;
const maxPages = 10;

function paginationCount(value: string | null) {
  if (!value || !/^\d+$/.test(value)) throw new ApiError("BeerGuevara's catalog pagination changed. Your saved catalog was not replaced.", 502);
  return Number(value);
}

async function readCatalogPage(page: number, deadline: AbortSignal) {
  const url = new URL("https://beerguevara.com/wp-json/wc/store/v1/products");
  url.search = new URLSearchParams({ per_page: String(pageSize), page: String(page), orderby: "id", order: "asc" }).toString();
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "BrewLab.ai/1.0 (public catalog refresh)" },
    signal: AbortSignal.any([deadline, AbortSignal.timeout(15000)]),
    redirect: "error", cache: "no-store", credentials: "omit",
  });
  if (response.status === 429) throw new ApiError("BeerGuevara is limiting catalog requests. Try again later; your saved catalog is unchanged.", 429);
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
    throw new ApiError("BeerGuevara's public catalog is unavailable. Your saved catalog is unchanged.", 502);
  const pages = paginationCount(response.headers.get("x-wp-totalpages"));
  const count = paginationCount(response.headers.get("x-wp-total"));
  if (pages < 1 || pages > maxPages || count < 1 || pages !== Math.ceil(count / pageSize))
    throw new ApiError("BeerGuevara's catalog is changing or exceeds the import limit. Retry later; your saved catalog is unchanged.", 502);
  const rows = wooCatalogPageSchema.parse(await readJSON(new Request("https://catalog.invalid", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: response.body, duplex: "half",
  } as RequestInit), 1500000));
  if (rows.length !== Math.min(pageSize, count - (page - 1) * pageSize))
    throw new ApiError("BeerGuevara returned an incomplete catalog page. Your saved catalog is unchanged.", 502);
  return { rows, pages, count };
}

export async function scrapeBeerGuevara() {
  const products: SupplierProduct[] = [];
  const ids = new Set<number>();
  const deadline = AbortSignal.timeout(45000);
  let totalPages = 1;
  let totalProducts = 0;
  async function collectPage(page: number): Promise<void> {
    const { rows, pages, count } = await readCatalogPage(page, deadline);
    if (page === 1) { totalPages = pages; totalProducts = count; }
    if (pages !== totalPages || count !== totalProducts)
      throw new ApiError("BeerGuevara's catalog changed during refresh. Retry later; your saved catalog is unchanged.", 502);
    for (const row of rows) {
      if (ids.has(row.id)) throw new ApiError("BeerGuevara returned duplicate products. Retry later; your saved catalog is unchanged.", 502);
      ids.add(row.id);
      const product = parseBeerGuevaraProduct(row);
      if (product) products.push(product);
    }
    if (page < totalPages) await collectPage(page + 1);
  }
  try {
    await collectPage(1);
    if (!products.length) throw new ApiError("No ingredients with verified pack sizes and quantities were found. Your saved catalog is unchanged.", 502);
    return { products, scanned: ids.size, skipped: ids.size - products.length };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("BeerGuevara's catalog could not be read completely. Try again later; your saved catalog is unchanged.", 502);
  }
}