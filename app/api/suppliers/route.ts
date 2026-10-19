import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, checkOrigin, readJSON, requireUser } from "@/lib/api";
import { supplierSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    const profile = supplierSchema.parse(await readJSON(request, 1500000));
    const { error } = await supabase
      .from("suppliers")
      .upsert(
        { id: profile.id, user_id: user.id, profile },
        { onConflict: "user_id,id" },
      );
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    const id = z
      .string()
      .min(1)
      .max(160)
      .parse(new URL(request.url).searchParams.get("id"));
    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
