import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, checkOrigin, readJSON, requireUser } from "@/lib/api";
import { recipeSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    const { id, recipe } = z
      .object({ id: z.uuid(), recipe: recipeSchema })
      .parse(await readJSON(request));
    const { data, error } = await supabase
      .from("recipes")
      .upsert({
        id,
        user_id: user.id,
        name: recipe.name,
        recipe,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
