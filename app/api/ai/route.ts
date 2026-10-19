import { NextResponse } from "next/server";
import {
  ApiError,
  apiError,
  checkOrigin,
  consumeQuota,
  readJSON,
  requireUser,
} from "@/lib/api";
import {
  aiRequestSchema,
  inventorySchema,
  supplierSchema,
} from "@/lib/schemas";
import { generateRecipe } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    if (!process.env.OPENAI_API_KEY)
      throw new ApiError(
        "The co-brewer is not connected. Configure OPENAI_API_KEY on the server; manual drafting is available.",
        503,
      );
    const input = aiRequestSchema.parse(await readJSON(request, 100000));
    await consumeQuota(supabase, "ai");
    const [inventory, suppliers] = await Promise.all([
      supabase
        .from("inventories")
        .select("items")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("suppliers").select("profile").eq("user_id", user.id),
    ]);
    if (inventory.error || suppliers.error)
      throw inventory.error || suppliers.error;
    const result = await generateRecipe(
      input,
      inventorySchema.parse(inventory.data?.items ?? []),
      supplierSchema.array().parse(suppliers.data.map((item) => item.profile)),
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
