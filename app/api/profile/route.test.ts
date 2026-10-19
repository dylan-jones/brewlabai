import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, requireUser } from "@/lib/api";
import { getProfileSummary, updateProfile } from "@/lib/profile";
import { GET, PATCH } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", async () => ({
  ...await vi.importActual<typeof import("../../../lib/api")>("../../../lib/api"),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/profile", () => ({ getProfileSummary: vi.fn(), updateProfile: vi.fn() }));

const summary = {
  aiProvider: "openai" as const, aiModel: "gpt-4.1-mini",
  aiKeys: { openai: true, gemini: false, anthropic: false },
  brewfatherUserId: "brewer-id", brewfatherVersion: "v2" as const,
  brewfatherKeySaved: true, encryptionConfigured: true,
};
const workspace = {} as Awaited<ReturnType<typeof requireUser>>["workspace"];

describe("profile API protection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ workspace, user: { id: "brewer" } } as Awaited<ReturnType<typeof requireUser>>);
    vi.mocked(getProfileSummary).mockResolvedValue(summary);
    vi.mocked(updateProfile).mockResolvedValue(summary);
  });

  it("returns only safe profile metadata", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(requireUser).mockRejectedValue(new ApiError("Sign in first.", 401));
    expect((await GET()).status).toBe(401);
    expect(getProfileSummary).not.toHaveBeenCalled();
  });

  it("rejects cross-origin writes before loading user data", async () => {
    const response = await PATCH(new Request("https://brew.example/api/profile", { method: "PATCH", headers: { origin: "https://attacker.example" } }));
    expect(response.status).toBe(403);
    expect(requireUser).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("uses the authenticated owner and never echoes an incoming key", async () => {
    const body = { section: "ai", provider: "openai", model: "gpt-4.1-mini", key: "private-provider-key" };
    const response = await PATCH(new Request("https://brew.example/api/profile", {
      method: "PATCH", headers: { origin: "https://brew.example", "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    expect(response.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith(workspace, "brewer", body);
    expect(await response.text()).not.toContain("private-provider-key");
  });

  it("does not echo sensitive internal error details", async () => {
    vi.mocked(getProfileSummary).mockRejectedValue(new Error("private-provider-key"));
    const response = await GET();
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private-provider-key");
  });
});