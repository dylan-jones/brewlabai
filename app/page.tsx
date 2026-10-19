import AuthScreen from "@/components/auth-screen";
import RecipeStudio from "@/components/recipe-studio";
import { getSession, isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (session) return <RecipeStudio />;
  return <AuthScreen configured={isAuthConfigured()} />;
}
