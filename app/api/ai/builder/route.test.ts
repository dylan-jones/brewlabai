import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, consumeQuota, requireUser } from "@/lib/api";
import { generateRecipe, suggestBuilderStyles } from "@/lib/ai";
import { getAIConnection } from "@/lib/profile";
import { createEmptyRecipe, initialRecipe } from "../../../../lib/seed";
import { requirementsFor } from "../../../../lib/optimizer";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", async () => ({
  ...await vi.importActual<typeof import("../../../../lib/api")>("../../../../lib/api"),
  requireUser: vi.fn(), consumeQuota: vi.fn(),
}));
vi.mock("@/lib/ai", () => ({ generateRecipe: vi.fn(), suggestBuilderStyles: vi.fn() }));
vi.mock("@/lib/profile", () => ({ getAIConnection: vi.fn() }));
vi.mock("@/lib/schemas", () => import("../../../../lib/schemas"));
vi.mock("@/lib/recipe-builder", () => import("../../../../lib/recipe-builder"));
vi.mock("@/lib/seed", () => import("../../../../lib/seed"));

const inventory = requirementsFor(initialRecipe).map((item, index) => ({ ...item, id: String(index) }));
const supplier = {
  id: "chosen", name: "Chosen stockist", url: "https://example.com", shipping: 0, currency: "ZAR",
  products: requirementsFor(initialRecipe).map((item) => ({ ingredient: item.name, kind: item.kind, packageSize: item.quantity, price: 10, stock: 1 })),
};
const connection = { provider: "openai" as const, model: "test-model", apiKey: "private-key" };
const workspace = { getInventory: vi.fn(), getSuppliers: vi.fn() };
const draft = { ...createEmptyRecipe(), batchLiters: initialRecipe.batchLiters, efficiency: initialRecipe.efficiency, boilMinutes: initialRecipe.boilMinutes, boilOff: initialRecipe.boilOff, mashTunLiters: initialRecipe.mashTunLiters, water: { ...createEmptyRecipe().water, calcium: initialRecipe.water.calcium, sulfate: initialRecipe.water.sulfate, chloride: initialRecipe.water.chloride } };
const body = { action: "styles", mode: "inventory", supplierIds: [], brief: "Summer beer", recipe: draft };
const proposal = { recipe: initialRecipe, explanation: "A crisp summer beer.", metrics: {}, sourcing: {} };
function request(input: unknown = body, origin = "https://brew.example") {
  return new Request("https://brew.example/api/ai/builder", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

describe("guided builder API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ workspace, user: { id: "brewer" } } as unknown as Awaited<ReturnType<typeof requireUser>>);
    vi.mocked(getAIConnection).mockResolvedValue(connection);
    workspace.getInventory.mockResolvedValue({ items: inventory });
    workspace.getSuppliers.mockResolvedValue([supplier, { ...supplier, id: "unselected" }]);
    vi.mocked(suggestBuilderStyles).mockResolvedValue({ styles: [{ style: "Blonde Ale", overview: "Crisp and light." }] });
    vi.mocked(generateRecipe).mockResolvedValue(proposal as unknown as Awaited<ReturnType<typeof generateRecipe>>);
  });

  it("requires authentication", async () => {
    vi.mocked(requireUser).mockRejectedValue(new ApiError("Sign in first.", 401));
    expect((await POST(request())).status).toBe(401);
    expect(getAIConnection).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests before accessing data", async () => {
    expect((await POST(request(body, "https://attacker.example"))).status).toBe(403);
    expect(requireUser).not.toHaveBeenCalled();
  });
  it("rejects client ownership and source injection", async () => {
    expect((await POST(request({ ...body, userId: "someone-else" }))).status).toBe(400);
    expect((await POST(request({ ...body, mode: "mixed", supplierIds: ["someone-elses-stockist"] }))).status).toBe(400);
    expect(suggestBuilderStyles).not.toHaveBeenCalled();
    expect(consumeQuota).not.toHaveBeenCalled();
  });
  it.each(["inventory", "mixed", "stockists"])("restricts %s requests to server-owned sources", async (mode) => {
    const response = await POST(request({ ...body, mode, supplierIds: mode === "inventory" ? [] : ["chosen"] }));
    expect(response.status).toBe(200);
    const [, suppliedInventory, suppliedStockists, suppliedConnection] = vi.mocked(suggestBuilderStyles).mock.calls[0];
    expect(suppliedInventory).toEqual(mode === "stockists" ? [] : inventory);
    expect(suppliedStockists.map((item) => item.id)).toEqual(mode === "inventory" ? [] : ["chosen"]);
    expect(suppliedConnection).toEqual(connection);
    expect(consumeQuota).toHaveBeenCalledWith(workspace, "ai");
    expect(await response.text()).not.toContain("private-key");
  });
  it("rejects empty inventory before spending an AI request", async () => {
    workspace.getInventory.mockResolvedValue({ items: [] });
    expect((await POST(request())).status).toBe(400);
    expect(consumeQuota).not.toHaveBeenCalled();
  });
  it("returns a complete preview only when the source checks pass", async () => {
    const response = await POST(request({ ...body, action: "recipe", style: { style: "Blonde Ale", overview: "Light." } }));
    expect(response.status).toBe(200);
    expect((await response.json()).sourcing.status).toBe("in-stock");
    expect(generateRecipe).toHaveBeenCalledWith(expect.objectContaining({ recipe: expect.objectContaining({ grains: [], yeast: "" }) }), inventory, [], connection, expect.objectContaining({ exactSources: true }));
  });
  it("rejects a hallucinated ingredient even if the model says sourcing passed", async () => {
    vi.mocked(generateRecipe).mockResolvedValue({ ...proposal, recipe: { ...initialRecipe, yeast: "Invented yeast" } } as unknown as Awaited<ReturnType<typeof generateRecipe>>);
    expect((await POST(request({ ...body, action: "recipe", style: { style: "Blonde Ale", overview: "Light." } }))).status).toBe(422);
  });
  it("rejects a recipe that silently changes the batch size", async () => {
    vi.mocked(generateRecipe).mockResolvedValue({ ...proposal, recipe: { ...initialRecipe, batchLiters: 1 } } as unknown as Awaited<ReturnType<typeof generateRecipe>>);
    expect((await POST(request({ ...body, action: "recipe", style: { style: "Blonde Ale", overview: "Light." } }))).status).toBe(422);
  });
  it("does not accept inventory as coverage for a stockists-only preview", async () => {
    workspace.getSuppliers.mockResolvedValue([{ ...supplier, products: [supplier.products[0]] }]);
    const response = await POST(request({ ...body, action: "recipe", mode: "stockists", supplierIds: ["chosen"], style: { style: "Blonde Ale", overview: "Light." } }));
    expect(response.status).toBe(422);
    expect(vi.mocked(generateRecipe).mock.calls[0][1]).toEqual([]);
  });
  it("does not expose raw provider credentials on failure", async () => {
    vi.mocked(suggestBuilderStyles).mockRejectedValue(new Error("private-key"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private-key");
  });
});