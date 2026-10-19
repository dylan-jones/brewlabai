import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { generateRecipe } from "./ai";
import { createEmptyRecipe, initialRecipe } from "./seed";
import { calculateRecipe } from "./calculations";
import type { AIProvider } from "./profile-settings";

vi.mock("server-only", () => ({}));
vi.mock("ai", async () => ({ ...await vi.importActual<typeof import("ai")>("ai"), generateText: vi.fn() }));

describe("AI provider connections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(generateText).mockResolvedValue({
      steps: [{ toolCalls: [{ toolName: "propose_recipe", input: { recipe: initialRecipe, explanation: "A balanced recipe." } }] }],
    } as unknown as Awaited<ReturnType<typeof generateText>>);
  });

  it.each<[AIProvider, string]>([["openai", "openai"], ["gemini", "google"], ["anthropic", "anthropic"]])(
    "routes %s to its own provider adapter without putting credentials in prompts",
    async (provider, adapter) => {
      const result = await generateRecipe(
        { recipe: createEmptyRecipe(), messages: [{ role: "user", content: "Make a pale ale" }] },
        [], [], { provider, model: "test-model", apiKey: "private-provider-key" },
      );
      const options = vi.mocked(generateText).mock.calls[0][0];
      expect(options.model).toMatchObject({ modelId: "test-model", provider: expect.stringContaining(adapter) });
      expect(JSON.stringify(options.messages)).not.toContain("private-provider-key");
      expect(result.metrics).toEqual(calculateRecipe(initialRecipe));
      const prepare = options.prepareStep as (context: { stepNumber: number }) => { activeTools: string[]; toolChoice: unknown };
      expect(prepare({ stepNumber: 0 })).toEqual({ activeTools: ["get_inventory"], toolChoice: { type: "tool", toolName: "get_inventory" } });
      expect(prepare({ stepNumber: 4 }).toolChoice).toEqual({ type: "tool", toolName: "propose_recipe" });
    },
  );

  it("never exposes raw provider errors that may include credentials", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("Provider failed with private-provider-key"));
    await expect(generateRecipe(
      { recipe: createEmptyRecipe(), messages: [{ role: "user", content: "Make a pale ale" }] },
      [], [], { provider: "openai", model: "test-model", apiKey: "private-provider-key" },
    )).rejects.toThrow("Check your profile key and model");
  });
});