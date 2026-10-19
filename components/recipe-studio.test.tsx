import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBrewStore } from "../lib/store";
import { lightTheme } from "../lib/theme";
import { bjcpBeerStyles } from "../lib/bjcp";
import RecipeStudio from "./recipe-studio";

vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/store", async () => {
  const actual = await import("../lib/store");
  return {
    ...actual,
    useBrewStore: Object.assign(() => actual.useBrewStore.getState(), actual.useBrewStore),
  };
});
vi.mock("@/lib/calculations", () => import("../lib/calculations"));
vi.mock("@/lib/bjcp", () => import("../lib/bjcp"));
vi.mock("@/lib/profile-settings", () => import("../lib/profile-settings"));
vi.mock("@/lib/optimizer", () => import("../lib/optimizer"));
vi.mock("@/lib/seed", () => import("../lib/seed"));
vi.mock("@/lib/schemas", () => import("../lib/schemas"));
vi.mock("@/lib/export", () => import("../lib/export"));

function renderStudio() {
  return renderToStaticMarkup(
    <ThemeProvider theme={lightTheme}>
      <RecipeStudio />
    </ThemeProvider>,
  );
}

describe("inline recipe settings", () => {
  beforeEach(() => useBrewStore.setState(useBrewStore.getInitialState(), true));

  it("renders the settings on the page rather than in the dialog", () => {
    const markup = renderStudio();
    const settingsIndex = markup.indexOf('id="recipe-settings"');
    const dialogIndex = markup.indexOf("<dialog");
    expect(settingsIndex).toBeGreaterThan(-1);
    expect(settingsIndex).toBeLessThan(dialogIndex);
    expect(markup).toContain('aria-labelledby="recipe-settings-title"');
    expect(markup).toContain("Apply settings");
    expect(markup.slice(dialogIndex)).not.toContain('name="volume"');
  });

  it("renders current draft and equipment values", () => {
    useBrewStore.getState().updateRecipe({ name: "My pale ale", batchLiters: 25, efficiency: 80 });
    const markup = renderStudio();
    expect(markup).toMatch(/name="name"[^>]*value="My pale ale"/);
    expect(markup).toMatch(/name="volume"[^>]*value="25"/);
    expect(markup).toMatch(/name="efficiency"[^>]*value="80"/);
    expect(markup).toContain("Batch volume (L)");
  });

  it("displays batch volume in gallons for imperial units", () => {
    useBrewStore.getState().setUnits("imperial");
    const markup = renderStudio();
    expect(markup).toContain("Batch volume (gal)");
    expect(markup).toMatch(/name="volume"[^>]*value="5.28"/);
  });

  it("uses a searchable style datalist and preserves custom styles", () => {
    useBrewStore.getState().updateRecipe({ style: "My custom pale ale" });
    const markup = renderStudio();
    expect(markup).toMatch(/name="style"[^>]*value="My custom pale ale"/);
    expect(markup).toContain('list="bjcp-beer-styles"');
    expect(markup).toContain('<datalist id="bjcp-beer-styles">');
    expect(markup).not.toContain('<select name="style"');
  });

  it("offers every beer style across all 34 BJCP categories", () => {
    const markup = renderStudio();
    const options = markup.split('<datalist id="bjcp-beer-styles">')[1].split("</datalist>")[0];
    expect(bjcpBeerStyles).toHaveLength(124);
    expect(bjcpBeerStyles.filter((style) => style.code === "21B")).toHaveLength(8);
    expect(bjcpBeerStyles.filter((style) => style.code === "27A")).toHaveLength(9);
    expect(options.match(/<option /g)).toHaveLength(bjcpBeerStyles.length);
    expect(new Set(bjcpBeerStyles.map((style) => Number.parseInt(style.code)))).toEqual(
      new Set(Array.from({ length: 34 }, (_, index) => index + 1)),
    );
    expect(new Set(bjcpBeerStyles.map((style) => style.label)).size).toBe(bjcpBeerStyles.length);
    expect(bjcpBeerStyles).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "1A", name: "American Light Lager" }),
      expect.objectContaining({ code: "21B", name: "Specialty IPA: Black IPA" }),
      expect.objectContaining({ code: "21C", name: "Hazy IPA" }),
      expect.objectContaining({ code: "27A", name: "Historical Beer: Sahti" }),
      expect.objectContaining({ code: "34C", name: "Experimental Beer" }),
    ]));
  });
});