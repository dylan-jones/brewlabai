import { redirect } from "next/navigation";
import ProfilePage from "@/components/profile-page";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { getProfileSummary } from "@/lib/profile";
import { WorkspaceDatabase } from "@/lib/workspace-db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/");
  const profile = await getProfileSummary(new WorkspaceDatabase(await getDatabase(), session.user.id));
  return <ProfilePage user={{ id: session.user.id, name: session.user.name, email: session.user.email }} initialProfile={profile} />;
}