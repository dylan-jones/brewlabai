// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lightTheme } from "../lib/theme";
import { createEmptyRecipe, initialRecipe } from "../lib/seed";
import RecipeBuilder from "./recipe-builder";

const onApply = vi.fn();
const onClose = vi.fn();
const fetchMock = vi.fn();
const styles = ["Blonde Ale", "Witbier", "Ordinary Bitter"].map((style) => ({ style, overview: "Refreshing and easy drinking." }));
const props = {
  recipe: createEmptyRecipe(), inventory: [{ id: "malt", name: "Pale malt", kind: "grain" as const, quantity: 5, unit: "kg" as const }],
  suppliers: [{ id: "saved", name: "Saved stockist", url: "https://example.com", currency: "ZAR", shipping: 0, products: [] }],
  units: "metric" as const, ready: true, online: true, onApply, onClose, onStockists: vi.fn(),
};
function mount(overrides = {}) {
  return render(<ThemeProvider theme={lightTheme}><RecipeBuilder {...props} {...overrides} /></ThemeProvider>);
}
function response(body: unknown, ok = true) { return { ok, json: async () => body }; }

describe("guided recipe builder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("collects the sourcing brief, previews a selected recipe, and applies only on command", async () => {
    fetchMock.mockResolvedValueOnce(response({ styles })).mockResolvedValueOnce(response({
      recipe: initialRecipe, explanation: "## Summer beer\n\nCrisp **malt** character.", sourcing: { status: "in-stock" },
    }));
    mount();
    fireEvent.change(screen.getByLabelText("Recipe brief (optional)"), { target: { value: "Use my yeast for summer beer" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest styles" }));
    await screen.findByRole("radio", { name: /Blonde Ale/ });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ mode: "inventory", supplierIds: [], brief: "Use my yeast for summer beer" });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: /Blonde Ale/ }));
    const apply = await screen.findByRole("button", { name: "Apply this recipe" });
    expect(screen.getByText("malt", { selector: "strong" })).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledWith(initialRecipe, expect.stringContaining("Summer beer"));
  });

  it("requires saved stockist selection and sends only selected IDs", async () => {
    fetchMock.mockResolvedValueOnce(response({ styles }));
    mount({ inventory: [], suppliers: [{ ...props.suppliers[0], products: [{ ingredient: "Pale malt", kind: "grain", packageSize: 1, price: 10, stock: 10 }] }] });
    fireEvent.click(screen.getByLabelText("Stockists only"));
    expect((screen.getByRole("button", { name: "Suggest styles" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText(/Saved stockist/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Saved stockist/));
    fireEvent.click(screen.getByRole("button", { name: "Suggest styles" }));
    await screen.findByRole("radio", { name: /Blonde Ale/ });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ mode: "stockists", supplierIds: ["saved"] });
  });

  it("renders duplicate AI hop IDs without key warnings and applies distinct additions", async () => {
    const duplicate = { ...initialRecipe, hops: initialRecipe.hops.map((hop) => ({ ...hop, id: "hop-default-9b5fadfd" })) };
    fetchMock.mockResolvedValueOnce(response({ styles })).mockResolvedValueOnce(response({ recipe: duplicate, explanation: "Multiple hop additions." }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mount();
      fireEvent.click(screen.getByRole("button", { name: "Suggest styles" }));
      fireEvent.click(await screen.findByRole("radio", { name: /Blonde Ale/ }));
      const apply = await screen.findByRole("button", { name: "Apply this recipe" });
      expect(errors.mock.calls.some((args) => args.some((value) => String(value).includes("same key")))).toBe(false);
      fireEvent.click(apply);
      const applied = onApply.mock.calls[0][0] as typeof initialRecipe;
      expect(new Set(applied.hops.map((hop) => hop.id)).size).toBe(applied.hops.length);
      expect(applied.hops.map((hop) => hop.grams)).toEqual(duplicate.hops.map((hop) => hop.grams));
    } finally { errors.mockRestore(); }
  });

  it("caps displayed suggestions at five while allowing another alternative", async () => {
    fetchMock.mockResolvedValueOnce(response({ styles }));
    for (const style of ["Saison", "Helles", "Kolsch"])
      fetchMock.mockResolvedValueOnce(response({ styles: [{ style, overview: "An alternative." }] }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Suggest styles" }));
    await screen.findByRole("radio", { name: /Blonde Ale/ });
    for (const style of ["Saison", "Helles", "Kolsch"]) {
      fireEvent.click(screen.getByRole("button", { name: "Add another" }));
      await screen.findByRole("radio", { name: new RegExp(style) });
    }
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.queryByRole("radio", { name: /Blonde Ale/ })).toBeNull();
    expect(JSON.parse(fetchMock.mock.calls[3][1].body).excludedStyles).toContain("Blonde Ale");
  });

  it("lets users return to the brief and cancel without applying a recipe", async () => {
    fetchMock.mockResolvedValueOnce(response({ styles }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Suggest styles" }));
    await screen.findByRole("button", { name: "Back" });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows a retryable generation error without applying anything", async () => {
    fetchMock.mockResolvedValueOnce(response({ styles })).mockResolvedValueOnce(response({ error: "Not enough yeast for this batch." }, false));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Suggest styles" }));
    fireEvent.click(await screen.findByRole("radio", { name: /Blonde Ale/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Not enough yeast");
    await waitFor(() => expect((screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement).disabled).toBe(false));
    expect(onApply).not.toHaveBeenCalled();
  });

  it.each([{ inventory: [] }, { ready: false }, { online: false }])("disables generation when setup is unavailable: %j", (overrides) => {
    mount(overrides);
    expect((screen.getByRole("button", { name: "Suggest styles" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});