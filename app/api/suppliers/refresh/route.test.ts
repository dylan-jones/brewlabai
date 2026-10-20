import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, consumeQuota, requireUser } from "@/lib/api";
import { scrapeBeerGuevara } from "@/lib/stockist-scraper";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", async () => ({
  ...await vi.importActual<typeof import("../../../../lib/api")>("../../../../lib/api"),
  requireUser: vi.fn(), consumeQuota: vi.fn(),
}));
vi.mock("@/lib/schemas", () => import("../../../../lib/schemas"));
vi.mock("@/lib/stockist-catalog", () => import("../../../../lib/stockist-catalog"));
vi.mock("@/lib/stockist-scraper", () => ({ scrapeBeerGuevara: vi.fn() }));

const product = { ingredient: "Rakau", kind: "hop", packageSize: 50, price: 45, stock: 5 };
const supplier = { id: "mine", name: "BeerGuevara", url: "https://beerguevara.com/", shipping: 80, currency: "ZAR", products: [] };
const workspace = { getSupplier: vi.fn(), saveSupplier: vi.fn() };
function request(body: unknown = { id: "mine" }, origin = "https://brew.example") {
  return new Request("https://brew.example/api/suppliers/refresh", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("stockist refresh protection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("STOCKIST_FEEDS", "{}");
    vi.mocked(requireUser).mockResolvedValue({ workspace, user: { id: "brewer" } } as unknown as Awaited<ReturnType<typeof requireUser>>);
    workspace.getSupplier.mockResolvedValue(supplier);
    vi.mocked(scrapeBeerGuevara).mockResolvedValue({ products: [product] as Awaited<ReturnType<typeof scrapeBeerGuevara>>["products"], scanned: 10, skipped: 9 });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("requires authentication and same-origin requests", async () => {
    expect((await POST(request({ id: "mine" }, "https://attacker.example"))).status).toBe(403);
    expect(requireUser).not.toHaveBeenCalled();
    vi.mocked(requireUser).mockRejectedValue(new ApiError("Sign in.", 401));
    expect((await POST(request())).status).toBe(401);
    expect(scrapeBeerGuevara).not.toHaveBeenCalled();
  });
  it("only loads a stockist belonging to the authenticated workspace", async () => {
    workspace.getSupplier.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(scrapeBeerGuevara).not.toHaveBeenCalled();
  });
  it("rejects arbitrary URL and owner injection", async () => {
    expect((await POST(request({ id: "mine", url: "https://127.0.0.1" }))).status).toBe(400);
    expect((await POST(request({ id: "mine", userId: "other" }))).status).toBe(400);
    expect(workspace.getSupplier).not.toHaveBeenCalled();
  });
  it("saves the complete verified catalog with source and timestamp", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    const { supplier: result } = await response.json();
    expect(result).toMatchObject({ ...supplier, products: [product], catalogSync: { source: "beerguevara", scanned: 10, skipped: 9, checkedAt: expect.any(String) } });
    expect(workspace.saveSupplier).toHaveBeenCalledWith(result, result.catalogSync.checkedAt);
    expect(consumeQuota).toHaveBeenCalledWith(workspace, "sync");
  });
  it("does not replace existing products after a scrape failure", async () => {
    vi.mocked(scrapeBeerGuevara).mockRejectedValue(new ApiError("Catalog unavailable.", 502));
    expect((await POST(request())).status).toBe(502);
    expect(workspace.saveSupplier).not.toHaveBeenCalled();
  });
  it("blocks unsupported hosts and mismatched currencies", async () => {
    workspace.getSupplier.mockResolvedValue({ ...supplier, url: "https://beerguevara.com.attacker.example/" });
    expect((await POST(request())).status).toBe(503);
    workspace.getSupplier.mockResolvedValue({ ...supplier, currency: "USD" });
    expect((await POST(request())).status).toBe(400);
    expect(scrapeBeerGuevara).not.toHaveBeenCalled();
  });
  it("honors existing approved feeds before the built-in connector", async () => {
    vi.stubEnv("STOCKIST_FEEDS", JSON.stringify({ mine: "https://approved.example/catalog.json" }));
    const fetcher = vi.fn().mockResolvedValue(Response.json([product]));
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).supplier.catalogSync.source).toBe("feed");
    expect(scrapeBeerGuevara).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0][0].hostname).toBe("approved.example");
    expect(fetcher.mock.calls[0][1].redirect).toBe("error");
  });
  it("does not call the storefront after the sync quota is exhausted", async () => {
    vi.mocked(consumeQuota).mockRejectedValue(new ApiError("Try later.", 429));
    expect((await POST(request())).status).toBe(429);
    expect(scrapeBeerGuevara).not.toHaveBeenCalled();
  });
});