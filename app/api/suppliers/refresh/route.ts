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

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { workspace } = await requireUser();
    const { id } = z
      .object({ id: z.string().min(1).max(160) })
      .parse(await readJSON(request, 2048));
    const feeds = z
      .record(z.string(), z.url())
      .parse(JSON.parse(process.env.STOCKIST_FEEDS || "{}"));
    if (!feeds[id])
      throw new ApiError(
        "No approved API feed is configured for this stockist. Import its catalog manually.",
        503,
      );
    const url = new URL(feeds[id]);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
      /(^|\.)(localhost|local|internal|test)$/i.test(url.hostname)
    )
      throw new ApiError("Invalid server-configured stockist feed.", 503);
    await consumeQuota(workspace, "sync");
    const existing = await workspace.getSupplier(id);
    if (!existing) throw new ApiError("Supplier not found.", 404);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok)
      throw new ApiError("The supplier catalog feed is unavailable.", 502);
    const products = await readJSON(
      new Request("https://catalog.invalid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: response.body,
        duplex: "half",
      } as RequestInit),
      1500000,
    );
    const profile = supplierSchema.parse({ ...existing, products });
    await workspace.saveSupplier(profile, new Date().toISOString());
    return NextResponse.json({ supplier: profile });
  } catch (error) {
    return apiError(error);
  }
}
