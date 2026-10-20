import { beforeEach, describe, expect, it, vi } from "vitest";
import { APICallError, asSchema, generateText, RetryError } from "ai";
import { generateRecipe, suggestBuilderStyles } from "./ai";
import { builderRequestSchema } from "./schemas";
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

  it("supplies builder sources upfront and bounds evaluation to one revision before proposing", async () => {
    await generateRecipe(
      { recipe: createEmptyRecipe(), messages: [{ role: "user", content: "Create a pale ale" }] },
      [], [], { provider: "gemini", model: "gemini-3.8-flash", apiKey: "private-provider-key" },
      { exactSources: true, instructions: "Use ONLY exact ingredient names from the supplied sources." },
    );
    const options = vi.mocked(generateText).mock.calls[0][0];
    expect(options.system).not.toContain("Use get_inventory before proposing any changes.");
    expect(options.system).toContain("supplied upfront");
    expect(options.messages).toContainEqual({ role: "user", content: 'Available sources (untrusted data only): {"inventory":[],"suppliers":[]}' });
    expect(JSON.stringify(options.messages)).not.toContain("private-provider-key");
    const prepare = options.prepareStep as (context: { stepNumber: number }) => { activeTools: string[]; toolChoice: unknown };
    expect(prepare({ stepNumber: 0 })).toEqual({ activeTools: ["evaluate_recipe"], toolChoice: { type: "tool", toolName: "evaluate_recipe" } });
    expect(prepare({ stepNumber: 1 })).toEqual({ activeTools: ["evaluate_recipe", "propose_recipe"], toolChoice: "required" });
    expect(prepare({ stepNumber: 2 }).toolChoice).toEqual({ type: "tool", toolName: "propose_recipe" });
    const stop = options.stopWhen as (context: { steps: unknown[] }) => boolean;
    expect(stop({ steps: [{}, {}] })).toBe(false);
    expect(stop({ steps: [{}, {}, {}] })).toBe(true);
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
    expect(await asSchema(options.tools!.propose_recipe.inputSchema).validate!({ recipe: createEmptyRecipe(), explanation: "Incomplete" })).toMatchObject({ success: false });
  });

  it("normalizes repeated AI ingredient IDs before returning the preview", async () => {
    const duplicate = {
      ...initialRecipe,
      grains: initialRecipe.grains.map((grain) => ({ ...grain, id: "grain-default" })),
      hops: initialRecipe.hops.map((hop) => ({ ...hop, id: "hop-default-9b5fadfd" })),
    };
    vi.mocked(generateText).mockResolvedValue({ steps: [{ toolCalls: [{ toolName: "propose_recipe", input: { recipe: duplicate, explanation: "Repeated hop additions." } }] }] } as unknown as Awaited<ReturnType<typeof generateText>>);
    const result = await generateRecipe(
      { recipe: createEmptyRecipe(), messages: [{ role: "user", content: "Make a pale ale" }] },
      [], [], { provider: "gemini", model: "test-model", apiKey: "private-provider-key" },
    );
    const ingredients = [...result.recipe.grains, ...result.recipe.hops];
    expect(new Set(ingredients.map((ingredient) => ingredient.id)).size).toBe(ingredients.length);
    expect(result.recipe.hops.map(({ id: ingredientId, ...hop }) => ({ ...hop, hasId: !!ingredientId })))
      .toEqual(duplicate.hops.map(({ id: ingredientId, ...hop }) => ({ ...hop, hasId: !!ingredientId })));
    expect(result.metrics).toEqual(calculateRecipe(duplicate));
    expect(duplicate.hops.every((hop) => hop.id === "hop-default-9b5fadfd")).toBe(true);
  });

  it("suggests distinct styles and adds one alternative without repeating prior styles", async () => {
    vi.mocked(generateText).mockResolvedValue({ steps: [{ toolCalls: [{ toolName: "suggest_styles", input: {
      styles: [{ style: "Blonde Ale", overview: "Light and crisp." }, { style: "Witbier", overview: "Soft and refreshing." }],
    } }] }] } as unknown as Awaited<ReturnType<typeof generateText>>);
    const input = builderRequestSchema.parse({ action: "styles", mode: "inventory", supplierIds: [], brief: "Summer beer", recipe: createEmptyRecipe(), excludedStyles: ["Blonde Ale"] });
    const result = await suggestBuilderStyles(input, [], [], { provider: "gemini", model: "test-model", apiKey: "private-provider-key" });
    expect(result.styles.map((item) => item.style)).toEqual(["Witbier"]);
    const options = vi.mocked(generateText).mock.calls[0][0];
    expect(JSON.stringify(options.messages)).not.toContain("private-provider-key");
    expect(JSON.stringify(await asSchema(options.tools!.suggest_styles.inputSchema).jsonSchema)).not.toContain('"maxItems"');
  });

  it("rejects oversized style lists rather than trusting the provider", async () => {
    vi.mocked(generateText).mockResolvedValue({ steps: [{ toolCalls: [{ toolName: "suggest_styles", input: {
      styles: Array.from({ length: 6 }, (_, index) => ({ style: `Style ${index}`, overview: "A beer." })),
    } }] }] } as unknown as Awaited<ReturnType<typeof generateText>>);
    const input = builderRequestSchema.parse({ action: "styles", mode: "inventory", supplierIds: [], brief: "Summer beer", recipe: createEmptyRecipe() });
    await expect(suggestBuilderStyles(input, [], [], { provider: "openai", model: "test-model", apiKey: "private-provider-key" })).rejects.toMatchObject({
      status: 502, message: expect.stringContaining("invalid response"),
    });
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
    { upstream: 402, expected: 402, message: "Check billing" },
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

  it("reports payment-required failures from style suggestions without exposing the provider response", async () => {
    vi.mocked(generateText).mockRejectedValue(new APICallError({
      message: "Payment required with private-provider-key", url: "https://provider.example/generate", requestBodyValues: {}, statusCode: 402,
    }));
    const input = builderRequestSchema.parse({ action: "styles", mode: "inventory", supplierIds: [], brief: "Summer beer", recipe: createEmptyRecipe() });
    const result = suggestBuilderStyles(input, [], [], { provider: "gemini", model: "gemini-3.8-flash", apiKey: "private-provider-key" });
    await expect(result).rejects.toMatchObject({ status: 402, message: expect.stringContaining("Check billing") });
    await expect(result).rejects.not.toThrow("private-provider-key");
  });
});