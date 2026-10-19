import { NextResponse } from "next/server";
import { apiError, checkOrigin, requireUser } from "@/lib/api";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { supabase } = await requireUser();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
