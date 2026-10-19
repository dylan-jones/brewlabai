import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { calculateRecipe } from "./calculations";
import { initialRecipe } from "./seed";

describe("brewing calculations", () => {
  it("loads in a strict runtime with dynamic evaluation disabled", () => {
    const require = createRequire(import.meta.url);
    const source = readFileSync(require.resolve("brewcalc/lib/brewcalc.js"), "utf8");
    const sandbox = {
      module: { exports: {} as { originalGravity: (volume: number, points: number) => number } },
      exports: {},
    };
    const context = createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false },
    });
    runInContext('"use strict";\n' + source, context);
    expect(sandbox.module.exports.originalGravity(20, 0.4)).toBeGreaterThan(1.07);
  });
  it("computes plausible gravity, alcohol, color and bitterness", () => {
    const stats = calculateRecipe(initialRecipe);
    expect(stats.og).toBeGreaterThan(1.07);
    expect(stats.og).toBeLessThan(1.09);
    expect(stats.fg).toBeCloseTo(1 + (stats.og - 1) * 0.21, 4);
    expect(stats.abv).toBeGreaterThan(7);
    expect(stats.ibu).toBeGreaterThan(20);
    expect(stats.ibu).toBeLessThan(70);
    expect(stats.srm).toBeGreaterThan(3);
  });
  it("dilutes gravity when volume increases", () => {
    expect(
      calculateRecipe({ ...initialRecipe, batchLiters: 40 }).og - 1,
    ).toBeCloseTo((calculateRecipe(initialRecipe).og - 1) / 2, 5);
  });
  it("gives dry hops no Tinseth bitterness and ages alpha acids", () => {
    expect(
      calculateRecipe({
        ...initialRecipe,
        hops: initialRecipe.hops.map((hop) => ({ ...hop, use: "dry hop" })),
      }).ibu,
    ).toBe(0);
    expect(
      calculateRecipe({
        ...initialRecipe,
        hops: initialRecipe.hops.map((hop) => ({ ...hop, ageMonths: 12 })),
      }).ibu,
    ).toBeLessThan(calculateRecipe(initialRecipe).ibu);
  });
  it("adds calcium, sulfate and chloride from salts", () => {
    const stats = calculateRecipe(initialRecipe);
    expect(stats.calcium).toBeCloseTo(116.43, 1);
    expect(stats.sulfate).toBeCloseTo(75.77, 1);
    expect(stats.chloride).toBeCloseTo(150.575, 1);
    expect(stats.ratio).toBeCloseTo(0.503, 2);
  });
});
