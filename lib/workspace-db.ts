import type { D1Database } from "@cloudflare/workers-types";
import type { InventoryItem, Recipe, Supplier } from "./types";
import type { AIProvider } from "./profile-settings";

export interface StoredProfile {
  ai_provider: AIProvider;
  ai_model: string;
  openai_key: string | null;
  gemini_key: string | null;
  anthropic_key: string | null;
  brewfather_user_id: string;
  brewfather_version: "v1" | "v2";
  brewfather_key: string | null;
}

export class WorkspaceDatabase {
  constructor(
    private readonly db: D1Database,
    private readonly userId: string,
  ) {}

  async getInventory() {
    const row = await this.db.prepare(
      "SELECT items, source, synced_at FROM inventories WHERE user_id = ?",
    ).bind(this.userId).first<{ items: string; source: string; synced_at: string }>();
    return {
      items: row ? JSON.parse(row.items) as InventoryItem[] : null,
      source: row?.source ?? "manual",
      syncedAt: row?.synced_at ?? null,
    };
  }

  async saveInventory(items: InventoryItem[], source: "manual" | "brewfather") {
    await this.db.prepare(
      `INSERT INTO inventories (user_id, items, source, synced_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET items = excluded.items,
         source = excluded.source, synced_at = excluded.synced_at`,
    ).bind(this.userId, JSON.stringify(items), source, new Date().toISOString()).run();
  }

  async getSuppliers() {
    const { results } = await this.db.prepare(
      "SELECT profile FROM suppliers WHERE user_id = ? ORDER BY id",
    ).bind(this.userId).all<{ profile: string }>();
    return results.map((row) => JSON.parse(row.profile) as Supplier);
  }

  async getSupplier(id: string) {
    const row = await this.db.prepare(
      "SELECT profile FROM suppliers WHERE user_id = ? AND id = ?",
    ).bind(this.userId, id).first<{ profile: string }>();
    return row ? JSON.parse(row.profile) as Supplier : null;
  }

  async saveSupplier(profile: Supplier, checkedAt: string | null = null) {
    await this.db.prepare(
      `INSERT INTO suppliers (user_id, id, profile, checked_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, id) DO UPDATE SET profile = excluded.profile,
         checked_at = COALESCE(excluded.checked_at, suppliers.checked_at)`,
    ).bind(this.userId, profile.id, JSON.stringify(profile), checkedAt).run();
  }

  async deleteSupplier(id: string) {
    await this.db.prepare("DELETE FROM suppliers WHERE user_id = ? AND id = ?")
      .bind(this.userId, id).run();
  }

  async getRecipes() {
    const { results } = await this.db.prepare(
      "SELECT id, recipe, updated_at FROM recipes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100",
    ).bind(this.userId).all<{ id: string; recipe: string; updated_at: string }>();
    return results.map((row) => ({ id: row.id, recipe: JSON.parse(row.recipe) as Recipe, date: row.updated_at }));
  }

  async saveRecipe(id: string, recipe: Recipe) {
    await this.db.prepare(
      `INSERT INTO recipes (user_id, id, name, recipe, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, id) DO UPDATE SET name = excluded.name,
         recipe = excluded.recipe, updated_at = excluded.updated_at`,
    ).bind(this.userId, id, recipe.name, JSON.stringify(recipe), new Date().toISOString()).run();
  }

  async deleteRecipe(id: string) {
    await this.db.prepare("DELETE FROM recipes WHERE user_id = ? AND id = ?")
      .bind(this.userId, id).run();
  }

  async consumeQuota(action: "ai" | "sync", now = Date.now()) {
    const bucket = Math.floor(now / 3600000);
    const limit = action === "ai" ? 30 : 6;
    await this.db.prepare("DELETE FROM api_usage WHERE user_id = ? AND bucket < ?")
      .bind(this.userId, bucket - 24).run();
    const row = await this.db.prepare(
      `INSERT INTO api_usage (user_id, action, bucket, requests) VALUES (?, ?, ?, 1)
       ON CONFLICT (user_id, action, bucket) DO UPDATE SET requests = api_usage.requests + 1
       WHERE api_usage.requests < ? RETURNING requests`,
    ).bind(this.userId, action, bucket, limit).first<{ requests: number }>();
    return row !== null;
  }

  async getProfile() {
    return this.db.prepare(
      `SELECT ai_provider, ai_model, openai_key, gemini_key, anthropic_key,
        brewfather_user_id, brewfather_version, brewfather_key
       FROM user_profiles WHERE user_id = ?`,
    ).bind(this.userId).first<StoredProfile>();
  }

  async saveAIProfile(provider: AIProvider, model: string, encryptedKey?: string | null) {
    const column = { openai: "openai_key", gemini: "gemini_key", anthropic: "anthropic_key" }[provider];
    if (!column) throw new Error("Unsupported AI provider.");
    await this.db.prepare(
      `INSERT INTO user_profiles (user_id, ai_provider, ai_model, ${column}) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET ai_provider = excluded.ai_provider,
         ai_model = excluded.ai_model,
         ${column} = CASE WHEN ? THEN excluded.${column} ELSE user_profiles.${column} END`,
    ).bind(this.userId, provider, model, encryptedKey ?? null, encryptedKey !== undefined ? 1 : 0).run();
  }

  async saveBrewfatherProfile(userId: string, version: "v1" | "v2", encryptedKey?: string | null) {
    await this.db.prepare(
      `INSERT INTO user_profiles (user_id, brewfather_user_id, brewfather_version, brewfather_key)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET brewfather_user_id = excluded.brewfather_user_id,
         brewfather_version = excluded.brewfather_version,
         brewfather_key = CASE WHEN ? THEN excluded.brewfather_key ELSE user_profiles.brewfather_key END`,
    ).bind(this.userId, userId, version, encryptedKey ?? null, encryptedKey !== undefined ? 1 : 0).run();
  }
}