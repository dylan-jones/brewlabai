import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { getDatabase } from "./db";
import { getAuth, getSession, isAuthConfigured } from "./auth";

vi.mock("better-auth", () => ({ betterAuth: vi.fn() }));
vi.mock("better-auth/next-js", () => ({ nextCookies: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "session=test" })) }));
vi.mock("./db", () => ({ getDatabase: vi.fn() }));

describe("Google authentication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-that-is-at-least-32-characters");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("does not access the database when Google is not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(isAuthConfigured()).toBe(false);
    expect(await getSession()).toBeNull();
    expect(getDatabase).not.toHaveBeenCalled();
    await expect(getAuth()).rejects.toThrow("not configured");
  });

  it("requires a sufficiently long session secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "short");
    expect(isAuthConfigured()).toBe(false);
  });

  it("validates sessions through the auth provider with request cookies", async () => {
    const session = { user: { id: "brewer", email: "brewer@example.com" } };
    const getSessionMock = vi.fn().mockResolvedValue(session);
    vi.mocked(betterAuth).mockReturnValue({
      api: { getSession: getSessionMock },
    } as unknown as ReturnType<typeof betterAuth>);
    expect(await getSession()).toEqual(session);
    expect(getDatabase).toHaveBeenCalledOnce();
    expect(getSessionMock).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    expect(vi.mocked(betterAuth).mock.calls[0][0]).toMatchObject({
      baseURL: "http://localhost:3000",
      socialProviders: { google: { clientId: "google-client" } },
      rateLimit: { storage: "database" },
    });
  });
});