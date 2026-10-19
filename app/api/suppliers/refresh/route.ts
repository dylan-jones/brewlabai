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
    const { supabase, user } = await requireUser();
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
    await consumeQuota(supabase, "sync");
    const { data, error } = await supabase
      .from("suppliers")
      .select("profile")
      .eq("user_id", user.id)
      .eq("id", id)
      .single();
    if (error) throw error;
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
    const profile = supplierSchema.parse({ ...data.profile, products });
    const { error: updateError } = await supabase
      .from("suppliers")
      .update({ profile, checked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ supplier: profile });
  } catch (error) {
    return apiError(error);
  }
}
