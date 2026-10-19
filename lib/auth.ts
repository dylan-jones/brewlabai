import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { getDatabase } from "./db";

export function isAuthConfigured() {
  return Boolean(
    process.env.BETTER_AUTH_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.BETTER_AUTH_SECRET.length >= 32 &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET,
  );
}

export async function getAuth() {
  if (!isAuthConfigured()) throw new Error("Google authentication is not configured.");
  return betterAuth({
    appName: "BrewLab.ai",
    baseURL: process.env.BETTER_AUTH_URL!,
    secret: process.env.BETTER_AUTH_SECRET!,
    database: await getDatabase(),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        prompt: "select_account",
      },
    },
    rateLimit: { enabled: true, storage: "database" },
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    plugins: [nextCookies()],
  });
}

export async function getSession() {
  if (!isAuthConfigured()) return null;
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
}