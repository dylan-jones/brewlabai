import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, checkOrigin, readJSON, requireUser } from "@/lib/api";
import { recipeSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { workspace } = await requireUser();
    const { id, recipe } = z
      .object({ id: z.uuid(), recipe: recipeSchema })
      .parse(await readJSON(request));
    await workspace.saveRecipe(id, recipe);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const { workspace } = await requireUser();
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    await workspace.deleteRecipe(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
