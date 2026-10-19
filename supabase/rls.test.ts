import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const firstUser = "00000000-0000-4000-8000-000000000001";
const secondUser = "00000000-0000-4000-8000-000000000002";

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated;
  `);
  await db.exec(
    readFileSync(
      new URL("./migrations/001_brew_lab.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query("insert into auth.users(id) values ($1),($2)", [
    firstUser,
    secondUser,
  ]);
}, 30000);

afterAll(async () => {
  await db.close();
});

async function asUser(userId: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId,
  ]);
  await db.exec("set role authenticated");
}

describe("Supabase owner isolation", () => {
  it("creates a public profile for new auth users", async () => {
    await asUser(firstUser);
    const result = await db.query<{ id: string }>(
      "select id from public.users",
    );
    expect(result.rows).toEqual([{ id: firstUser }]);
  });
  it("isolates inventory, stockists and recipes across users", async () => {
    await asUser(firstUser);
    await db.query(
      "insert into public.inventories(user_id, items) values ($1, $2)",
      [firstUser, JSON.stringify([{ name: "Citra" }])],
    );
    await db.query(
      "insert into public.suppliers(user_id, id, profile) values ($1, $2, $3)",
      [firstUser, "supplier", JSON.stringify({ name: "Local shop" })],
    );
    await db.query(
      "insert into public.recipes(user_id, name, recipe) values ($1, $2, $3)",
      [firstUser, "Private IPA", "{}"],
    );
    await asUser(secondUser);
    expect(
      (await db.query("select * from public.inventories")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.suppliers")).rows,
    ).toHaveLength(0);
    expect((await db.query("select * from public.recipes")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into public.inventories(user_id, items) values ($1, $2)",
        [firstUser, "[]"],
      ),
    ).rejects.toThrow("row-level security");
    expect(
      (
        await db.query("update public.recipes set name = $1 returning id", [
          "Tampered",
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("enforces per-user hourly quotas without permitting direct edits", async () => {
    await asUser(secondUser);
    for (let index = 0; index < 6; index++)
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select public.consume_api_quota('sync') as allowed",
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.consume_api_quota('sync') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    await expect(db.query("delete from public.api_usage")).rejects.toThrow(
      "permission denied",
    );
    await asUser(firstUser);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.consume_api_quota('sync') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
});
