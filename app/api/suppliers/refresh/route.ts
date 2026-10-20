import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  apiError,
  checkOrigin,
  consumeQuota,
  readJSON,
  requireUser,
} from "@/lib/api";
import { supplierSchema } from "@/lib/schemas";
import { hasBeerGuevaraConnector } from "@/lib/stockist-catalog";
import { scrapeBeerGuevara } from "@/lib/stockist-scraper";

async function fetchApprovedFeed(feed: string) {
  const url = new URL(feed);
  if (
    url.protocol !== "https:" || url.username || url.password ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
    /(^|\.)(localhost|local|internal|test)$/i.test(url.hostname)
  ) throw new ApiError("Invalid server-configured stockist feed.", 503);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw new ApiError("The supplier catalog feed is unavailable.", 502);
  const products = supplierSchema.shape.products.parse(await readJSON(new Request("https://catalog.invalid", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: response.body, duplex: "half",
  } as RequestInit), 1500000));
  return { products, scanned: products.length, skipped: 0 };
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { workspace } = await requireUser();
    const { id } = z
      .object({ id: z.string().min(1).max(160) }).strict()
      .parse(await readJSON(request, 2048));
    const existing = await workspace.getSupplier(id);
    if (!existing) throw new ApiError("Supplier not found.", 404);
    const feeds = z
      .record(z.string(), z.url())
      .parse(JSON.parse(process.env.STOCKIST_FEEDS || "{}"));
    const beerGuevara = !feeds[id] && hasBeerGuevaraConnector(existing.url);
    if (!feeds[id] && !beerGuevara)
      throw new ApiError(
        "This stockist has no website connector or approved API feed. Import its catalog manually. BeerGuevara website refresh is supported.",
        503,
      );
    if (beerGuevara && existing.currency !== "ZAR")
      throw new ApiError("BeerGuevara publishes prices in ZAR. Add this stockist with ZAR currency before refreshing.", 400);
    await consumeQuota(workspace, "sync");
    const result = beerGuevara ? await scrapeBeerGuevara() : await fetchApprovedFeed(feeds[id]);
    const checkedAt = new Date().toISOString();
    const profile = supplierSchema.parse({
      ...existing, products: result.products,
      catalogSync: { source: beerGuevara ? "beerguevara" : "feed", checkedAt, scanned: result.scanned, skipped: result.skipped },
    });
    await workspace.saveSupplier(profile, checkedAt);
    return NextResponse.json({ supplier: profile });
  } catch (error) {
    return apiError(error);
  }
}
