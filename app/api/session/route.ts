import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isSupabaseConfigured();
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  if (!configured)
    return NextResponse.json({ configured, aiConfigured, user: null });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return NextResponse.json({
    configured,
    aiConfigured,
    user: user ? { id: user.id, email: user.email || "" } : null,
  });
}
