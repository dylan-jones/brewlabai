import { NextResponse } from "next/server";
import { apiError, checkOrigin, readJSON, requireUser } from "@/lib/api";
import { inventorySchema } from "@/lib/schemas";

export async function GET() {
  try {
    const { workspace } = await requireUser();
    const [inventory, suppliers, recipes] = await Promise.all([
      workspace.getInventory(),
      workspace.getSuppliers(),
      workspace.getRecipes(),
    ]);
    return NextResponse.json({
      inventory: inventory.items,
      inventorySource: inventory.source,
      lastSync: inventory.syncedAt,
      suppliers,
      recipes,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const { workspace } = await requireUser();
    const items = inventorySchema.parse(await readJSON(request, 1500000));
    await workspace.saveInventory(items, "manual");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
