import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
import AuthScreen from "@/components/auth-screen";
import RecipeStudio from "@/components/recipe-studio";
import { getSession, isAuthConfigured } from "@/lib/auth";

vi.mock("@/components/auth-screen", () => ({ default: vi.fn() }));
vi.mock("@/components/recipe-studio", () => ({ default: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  isAuthConfigured: vi.fn(),
}));

describe("home page authentication", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows login when authentication is not configured", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(false);
    vi.mocked(getSession).mockResolvedValue(null);
    const result = await Page();
    expect(result.type).toBe(AuthScreen);
    expect(result.props.configured).toBe(false);
  });

  it.each([
    { user: null, expected: AuthScreen },
    { user: { id: "brewer" }, expected: RecipeStudio },
  ])("selects the correct screen for user $user", async ({ user, expected }) => {
    vi.mocked(isAuthConfigured).mockReturnValue(true);
    vi.mocked(getSession).mockResolvedValue(
      user ? { user } as Awaited<ReturnType<typeof getSession>> : null,
    );
    const result = await Page();
    expect(getSession).toHaveBeenCalledOnce();
    expect(result.type).toBe(expected);
  });
});