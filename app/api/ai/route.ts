import { NextResponse } from "next/server";
import {
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
import { getAIConnection } from "@/lib/profile";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { workspace, user } = await requireUser();
    const connection = await getAIConnection(workspace, user.id);
    const input = aiRequestSchema.parse(await readJSON(request, 100000));
    await consumeQuota(workspace, "ai");
    const [inventory, suppliers] = await Promise.all([
      workspace.getInventory(),
      workspace.getSuppliers(),
    ]);
    const result = await generateRecipe(
      input,
      inventorySchema.parse(inventory.items ?? []),
      supplierSchema.array().parse(suppliers),
      connection,
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
