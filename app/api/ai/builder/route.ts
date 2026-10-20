import { NextResponse } from "next/server";
import { apiError, ApiError, checkOrigin, consumeQuota, readJSON, requireUser } from "@/lib/api";
import { builderRequestSchema, inventorySchema, supplierSchema } from "@/lib/schemas";
import { generateRecipe, suggestBuilderStyles } from "@/lib/ai";
import { getAIConnection } from "@/lib/profile";
import { builderSources, checkBuilderRecipe } from "@/lib/recipe-builder";
import { createEmptyRecipe } from "@/lib/seed";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { workspace, user } = await requireUser();
    const input = builderRequestSchema.parse(await readJSON(request, 100000));
    const connection = await getAIConnection(workspace, user.id);
    const [storedInventory, storedSuppliers] = await Promise.all([workspace.getInventory(), workspace.getSuppliers()]);
    let sources;
    try {
      sources = builderSources(input, inventorySchema.parse(storedInventory.items ?? []), supplierSchema.array().parse(storedSuppliers));
    } catch {
      throw new ApiError("A selected stockist is no longer available. Select your stockists again.", 400);
    }
    if (!sources.inventory.length && !sources.suppliers.some((supplier) => supplier.products.length))
      throw new ApiError("No stocked ingredients are available from these sources. Add inventory or choose a stockist with a stocked catalog.", 400);
    await consumeQuota(workspace, "ai");
    const recipe = {
      ...createEmptyRecipe(),
      batchLiters: input.recipe.batchLiters,
      efficiency: input.recipe.efficiency,
      mashTunLiters: input.recipe.mashTunLiters,
      boilOff: input.recipe.boilOff,
      boilMinutes: input.recipe.boilMinutes,
      water: { ...createEmptyRecipe().water, calcium: input.recipe.water.calcium, sulfate: input.recipe.water.sulfate, chloride: input.recipe.water.chloride },
    };
    if (input.action === "styles")
      return NextResponse.json(await suggestBuilderStyles({ ...input, recipe }, sources.inventory, sources.suppliers, connection));

    const proposal = await generateRecipe({
      recipe,
      messages: [{ role: "user", content: JSON.stringify({ task: "Create a new complete recipe for this selected style", style: input.style, brief: input.brief }) }],
    }, sources.inventory, sources.suppliers, connection, {
      exactSources: true,
      instructions: `This is a NEW recipe, not an edit. Sourcing mode: ${input.mode}. Use ONLY exact ingredient names and quantities fulfillable from the supplied sources. Inventory-only means no purchases; stockists-only means all ingredients are purchased; mixed uses inventory first. Purchases must fit one selected supplier's entire shortage basket. Do not substitute names or invent stock. Use evaluate_recipe first; if sourcing is not in-stock or matched, make one correction and evaluate it before proposing. Preserve supplied batch volume, efficiency, boil duration, boil-off, mash tun capacity, and source water. Keep additions within mash tun capacity. Explain flavor, ingredients, fermentation, and sourcing briefly in Markdown.`,
    });
    if (["batchLiters", "efficiency", "boilMinutes", "boilOff", "mashTunLiters"].some((field) =>
      proposal.recipe[field as keyof typeof recipe] !== recipe[field as keyof typeof recipe]))
      throw new ApiError("The AI changed your batch or equipment settings. Try generating this style again.", 422);
    if ((["calcium", "sulfate", "chloride"] as const).some((field) => proposal.recipe.water[field] !== recipe.water[field]))
      throw new ApiError("The AI changed your source water. Try generating this style again.", 422);
    if (proposal.recipe.grains.reduce((total, grain) => total + grain.kg, 0) * 3.5 > recipe.mashTunLiters)
      throw new ApiError("This recipe exceeds your mash tun capacity. Try a smaller batch or another style.", 422);
    try {
      const sourcing = checkBuilderRecipe(proposal.recipe, sources.inventory, sources.suppliers);
      return NextResponse.json({ ...proposal, sourcing });
    } catch {
      throw new ApiError("The suggested recipe cannot be fulfilled from these sources. Try another style, a smaller batch, or different stockists.", 422);
    }
  } catch (error) {
    return apiError(error);
  }
}