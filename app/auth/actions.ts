"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";

export async function signInWithGoogle() {
  if (!isAuthConfigured()) redirect("/auth/error?reason=configuration");
  let url: string | undefined;
  try {
    const auth = await getAuth();
    const result = await auth.api.signInSocial({
      headers: await headers(),
      body: { provider: "google", callbackURL: "/", errorCallbackURL: "/auth/error" },
    });
    url = result.url;
  } catch {
    redirect("/auth/error?reason=provider");
  }
  if (!url) redirect("/auth/error?reason=provider");
  redirect(url);
}
