import { signInWithGoogle } from "../actions";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!isSupabaseConfigured())
    return NextResponse.redirect(
      new URL("/auth/error?reason=configuration", request.url),
    );
  return signInWithGoogle();
}
