"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) redirect("/auth/error?reason=configuration");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("/auth/callback", site).href },
  });
  if (error || !data.url) redirect("/auth/error?reason=provider");
  redirect(data.url);
}
