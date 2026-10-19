import { NextResponse } from "next/server";
import { apiError, checkOrigin, readJSON, requireUser } from "@/lib/api";
import { inventorySchema } from "@/lib/schemas";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const [inventory, suppliers, recipes] = await Promise.all([
      supabase
        .from("inventories")
        .select("items,source,synced_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("suppliers").select("profile").eq("user_id", user.id),
      supabase
        .from("recipes")
        .select("id,recipe,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);
    if (inventory.error || suppliers.error || recipes.error)
      throw inventory.error || suppliers.error || recipes.error;
    return NextResponse.json({
      inventory: inventory.data?.items ?? null,
      inventorySource: inventory.data?.source ?? "manual",
      lastSync: inventory.data?.synced_at ?? null,
      suppliers: suppliers.data.map((item) => item.profile),
      recipes: recipes.data.map((item) => ({
        id: item.id,
        recipe: item.recipe,
        date: item.updated_at,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    const items = inventorySchema.parse(await readJSON(request, 1500000));
    const { error } = await supabase
      .from("inventories")
      .upsert({
        user_id: user.id,
        items,
        source: "manual",
        synced_at: new Date().toISOString(),
      });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
