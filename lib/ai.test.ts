import { beforeEach, describe, expect, it, vi } from "vitest";
import { APICallError, asSchema, generateText, RetryError } from "ai";
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
      expect(options.system).toContain("Format the explanation as concise Markdown");
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

  it("bounds the complete tool loop and limits reasoning for current Gemini models", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    try {
      await generateRecipe(
        { recipe: createEmptyRecipe(), messages: [{ role: "user", content: "Make a pale ale" }] },
        [], [], { provider: "gemini", model: "gemini-3.8-flash", apiKey: "private-provider-key" },
      );
      expect(vi.mocked(generateText).mock.calls[0][0].providerOptions).toEqual({ google: { thinkingConfig: { thinkingLevel: "low" } } });
      expect(timeout).toHaveBeenCalledWith(120000);
    } finally { timeout.mockRestore(); }
  });

  it("simplifies Gemini tool schemas while keeping strict server-side validation", async () => {
    await generateRecipe(
      { recipe: createEmptyRecipe(), messages: [{ role: "user", content: "Make a pale ale" }] },
      [], [], { provider: "gemini", model: "gemini-3.8-flash", apiKey: "private-provider-key" },
    );
    const options = vi.mocked(generateText).mock.calls[0][0];
    const schema = asSchema(options.tools!.propose_recipe.inputSchema);
    const serialized = JSON.stringify(await schema.jsonSchema);
    expect(serialized).not.toContain('"maximum"');
    expect(serialized).not.toContain('"maxItems"');
    expect(serialized).not.toContain('"maxLength"');
    expect(serialized).toContain('"required"');
    expect(serialized).toContain('"enum"');
    expect((await schema.validate!({ recipe: createEmptyRecipe(), explanation: "Incomplete" })).success).toBe(false);
    expect((await schema.validate!({ recipe: initialRecipe, explanation: "Complete" })).success).toBe(true);
  });

  it("reports timeouts without blaming the user's key", async () => {
    vi.mocked(generateText).mockRejectedValue(new DOMException("Request timed out", "TimeoutError"));
    await expect(generateRecipe(
      { recipe: createEmptyRecipe(), messages: [{ role: "user", content: "Make a pale ale" }] },
      [], [], { provider: "gemini", model: "test-model", apiKey: "private-provider-key" },
    )).rejects.toMatchObject({ status: 504, message: expect.stringContaining("timed out") });
  });

  it.each([
    { upstream: 400, expected: 502, message: "required tools or request format" },
    { upstream: 401, expected: 403, message: "rejected your key" },
    { upstream: 404, expected: 404, message: "model was not found" },
    { upstream: 429, expected: 429, message: "usage limit" },
    { upstream: 503, expected: 503, message: "temporarily unavailable" },
  ])("classifies HTTP $upstream even when wrapped by retries without exposing secrets", async ({ upstream, expected, message }) => {
    const error = new APICallError({
      message: "Provider error containing private-provider-key",
      url: "https://provider.example/generate", requestBodyValues: {}, statusCode: upstream,
    });
    vi.mocked(generateText).mockRejectedValue(new RetryError({
      message: "Retry failed with private-provider-key", reason: "maxRetriesExceeded", errors: [error],
    }));
    const result = generateRecipe(
      { recipe: createEmptyRecipe(), messages: [{ role: "user", content: "Make a pale ale" }] },
      [], [], { provider: "gemini", model: "test-model", apiKey: "private-provider-key" },
    );
    await expect(result).rejects.toMatchObject({ status: expected, message: expect.stringContaining(message) });
    await expect(result).rejects.not.toThrow("private-provider-key");
  });
});