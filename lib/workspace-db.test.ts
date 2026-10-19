import { readFileSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { getPlatformProxy } from "wrangler";
import { serializeSignedCookie } from "better-call";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getAuth } from "./auth";
import { getDatabase } from "./db";
import { WorkspaceDatabase } from "./workspace-db";
import { initialRecipe } from "./seed";
import type { Supplier } from "./types";
import { getAIConnection, getBrewfatherConnection, getProfileSummary, updateProfile } from "./profile";

vi.mock("./db", () => ({ getDatabase: vi.fn() }));
vi.mock("server-only", () => ({}));

describe("D1 account isolation", () => {
  let platform: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
  let first: WorkspaceDatabase;
  let second: WorkspaceDatabase;

  beforeAll(async () => {
    platform = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
    const db = platform.env.DB;
    const migration = readFileSync(new URL("../migrations/0001_brew_lab.sql", import.meta.url), "utf8");
    await db.batch(migration.split(";").filter((statement) => statement.trim()).map((statement) => db.prepare(statement)));
    const profileMigration = readFileSync(new URL("../migrations/0002_user_profiles.sql", import.meta.url), "utf8");
    await db.batch(profileMigration.split(";").filter((statement) => statement.trim()).map((statement) => db.prepare(statement)));
    for (const userId of ["first", "second"]) {
      await db.prepare('INSERT INTO "user" (id, name, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, userId, `${userId}@example.com`, new Date().toISOString(), new Date().toISOString()).run();
    }
    first = new WorkspaceDatabase(db, "first");
    second = new WorkspaceDatabase(db, "second");
  }, 30000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    await platform?.dispose();
  });

  it("isolates inventory and preserves its source", async () => {
    await first.saveInventory([{ id: "malt", name: "Pale malt", kind: "grain", quantity: 5, unit: "kg" }], "brewfather");
    expect((await first.getInventory()).source).toBe("brewfather");
    expect((await first.getInventory()).items).toHaveLength(1);
    expect((await second.getInventory()).items).toBeNull();
  });

  it("cannot overwrite or delete another account's recipe using a known ID", async () => {
    await first.saveRecipe("shared-id", initialRecipe);
    await second.saveRecipe("shared-id", { ...initialRecipe, name: "Second brewer" });
    await second.deleteRecipe("shared-id");
    expect((await first.getRecipes())[0].recipe.name).toBe(initialRecipe.name);
    expect(await second.getRecipes()).toEqual([]);
  });

  it("isolates supplier reads, updates, and deletes", async () => {
    const supplier: Supplier = { id: "shop", name: "First shop", url: "https://example.com", shipping: 5, currency: "GBP", products: [] };
    await first.saveSupplier(supplier);
    expect(await second.getSupplier("shop")).toBeNull();
    await second.saveSupplier({ ...supplier, name: "Second shop" });
    await second.deleteSupplier("shop");
    expect(await first.getSupplier("shop")).toEqual(supplier);
    expect(await second.getSuppliers()).toEqual([]);
  });

  it("enforces atomic hourly limits independently per user and action", async () => {
    const now = Date.UTC(2026, 9, 19, 10);
    const results = await Promise.all(Array.from({ length: 8 }, () => first.consumeQuota("sync", now)));
    expect(results.filter(Boolean)).toHaveLength(6);
    expect(await second.consumeQuota("sync", now)).toBe(true);
    expect(await first.consumeQuota("ai", now)).toBe(true);
    expect(await first.consumeQuota("sync", now + 3600000)).toBe(true);
  });

  it("stores encrypted profile keys without leaking them or crossing accounts", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    await updateProfile(first, "first", { section: "ai", provider: "gemini", model: "gemini-3.8-flash", key: "test-gemini-key" });
    await updateProfile(first, "first", { section: "brewfather", userId: "brewer-id", version: "v2", key: "test-brewfather-key" });
    expect(JSON.stringify(await first.getProfile())).not.toContain("test-gemini-key");
    expect(JSON.stringify(await first.getProfile())).not.toContain("test-brewfather-key");
    const summary = await getProfileSummary(first);
    expect(summary.aiKeys.gemini).toBe(true);
    expect(summary.brewfatherKeySaved).toBe(true);
    expect(JSON.stringify(summary)).not.toContain("v1.");
    expect((await getAIConnection(first, "first")).apiKey).toBe("test-gemini-key");
    expect((await getBrewfatherConnection(first, "first")).apiKey).toBe("test-brewfather-key");
    expect(await second.getProfile()).toBeNull();
    await expect(getAIConnection(first, "second")).rejects.toThrow();
  });

  it("preserves separate provider keys and removes only explicitly selected keys", async () => {
    await updateProfile(first, "first", { section: "ai", provider: "openai", model: "gpt-4.1-mini", key: "test-openai-key" });
    await updateProfile(first, "first", { section: "ai", provider: "gemini", model: "gemini-3.8-flash" });
    expect((await getAIConnection(first, "first")).apiKey).toBe("test-gemini-key");
    await updateProfile(first, "first", { section: "ai", provider: "gemini", model: "gemini-3.8-flash", key: null });
    expect((await getProfileSummary(first)).aiKeys).toMatchObject({ openai: true, gemini: false });
    await expect(getAIConnection(first, "first")).rejects.toThrow("Add an API key");
    expect((await getProfileSummary(first)).brewfatherKeySaved).toBe(true);
  });

  it("removes Brewfather credentials without affecting saved AI keys", async () => {
    await updateProfile(first, "first", { section: "brewfather", userId: "brewer-id", version: "v2" });
    expect((await getBrewfatherConnection(first, "first")).apiKey).toBe("test-brewfather-key");
    await updateProfile(first, "first", { section: "brewfather", userId: "brewer-id", version: "v2", key: null });
    expect((await getProfileSummary(first)).brewfatherKeySaved).toBe(false);
    expect((await getProfileSummary(first)).aiKeys.openai).toBe(true);
    await expect(getBrewfatherConnection(first, "first")).rejects.toThrow("Add your Brewfather");
  });

  it("rejects ownership fields and fails closed when encryption is unavailable", async () => {
    await expect(updateProfile(second, "second", {
      section: "ai", provider: "openai", model: "gpt-4.1-mini", key: "private-key", userId: "first",
    })).rejects.toThrow();
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "");
    await expect(updateProfile(second, "second", {
      section: "ai", provider: "openai", model: "gpt-4.1-mini", key: "private-key",
    })).rejects.toMatchObject({ status: 503 });
    expect(await second.getProfile()).toBeNull();
  });

  describe("Better Auth on D1", () => {
    const origin = "http://localhost:3000";
    const secret = "integration-test-secret-with-at-least-32-characters";
    let auth: Awaited<ReturnType<typeof getAuth>>;

    beforeAll(async () => {
      vi.stubEnv("BETTER_AUTH_URL", origin);
      vi.stubEnv("BETTER_AUTH_SECRET", secret);
      vi.stubEnv("GOOGLE_CLIENT_ID", "test-google-client");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-google-secret");
      vi.mocked(getDatabase).mockResolvedValue(platform.env.DB);
      auth = await getAuth();
    });

    it("stores Google accounts and sessions, validates signed cookies, and revokes sign-outs", async () => {
      const context = await auth.$context;
      const user = await context.internalAdapter.createUser(
        { name: "Brewer", email: "auth@example.com", emailVerified: true },
        { method: "oauth" },
      );
      await context.internalAdapter.createAccount({ userId: user.id, providerId: "google", accountId: "google-subject" });
      const session = await context.internalAdapter.createSession(user.id);
      const cookie = (await serializeSignedCookie(context.authCookies.sessionToken.name, session.token, secret)).split(";")[0];
      const readSession = () => auth.handler(new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }));

      const response = await readSession();
      expect(response.status).toBe(200);
      expect((await response.json()).user.id).toBe(user.id);

      const forged = await auth.handler(new Request(`${origin}/api/auth/get-session`, {
        headers: { cookie: `${context.authCookies.sessionToken.name}=forged` },
      }));
      expect(await forged.json()).toBeNull();

      const signout = await auth.handler(new Request(`${origin}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie, origin, "Content-Type": "application/json" },
        body: "{}",
      }));
      expect(signout.status).toBe(200);
      expect(await (await readSession()).json()).toBeNull();
    });

    it("initiates Google OAuth with the configured callback and persistent state", async () => {
      const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: "/", errorCallbackURL: "/auth/error" }),
      }));
      expect(response.status).toBe(200);
      const url = new URL((await response.json()).url);
      expect(url.hostname).toBe("accounts.google.com");
      expect(url.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/google`);
      expect(url.searchParams.get("state")).toBeTruthy();
      expect(await platform.env.DB.prepare("SELECT count(*) AS total FROM verification").first("total")).toBeGreaterThan(0);
    });

    it("rejects cookie-bearing cross-origin authentication requests", async () => {
      const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { origin: "https://attacker.example", cookie: "better-auth.session_token=present", "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: "/" }),
      }));
      expect(response.status).toBe(403);
    });
  });
});