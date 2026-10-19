import type { D1Database } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export async function getDatabase() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error("The Cloudflare D1 DB binding is missing.");
  return env.DB;
}