import { NextResponse } from "next/server";
import { getSession, isAuthConfigured } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { getProfileSummary } from "@/lib/profile";
import { WorkspaceDatabase } from "@/lib/workspace-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isAuthConfigured();
  let aiConfigured = false;
  if (!configured)
    return NextResponse.json({ configured, aiConfigured, user: null });
  const session = await getSession();
  const user = session?.user;
  const profile = user
    ? await getProfileSummary(new WorkspaceDatabase(await getDatabase(), user.id))
    : null;
  aiConfigured = Boolean(profile?.encryptionConfigured && profile.aiKeys[profile.aiProvider]);
  return NextResponse.json({
    configured,
    aiConfigured,
    aiProvider: profile?.aiProvider ?? "openai",
    brewfatherConfigured: Boolean(profile?.encryptionConfigured && profile.brewfatherKeySaved && profile.brewfatherUserId),
    user: user ? { id: user.id, email: user.email || "" } : null,
  });
}
