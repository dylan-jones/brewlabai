import { describe, expect, it } from "vitest";
import { optimizeSingleSupplier, shortages } from "./optimizer";
import type { Requirement, Supplier } from "./types";

const needs: Requirement[] = [
  { name: "Citra", kind: "hop", quantity: 120, unit: "g" },
];
const supplier: Supplier = {
  id: "one",
  name: "One",
  url: "https://example.com",
  shipping: 5,
  currency: "GBP",
  products: [
    { ingredient: "Citra", kind: "hop", packageSize: 100, price: 6, stock: 10 },
  ],
};

describe("single supplier optimization", () => {
  it("rounds packages after subtracting inventory", () => {
    const result = optimizeSingleSupplier(
      needs,
      [{ id: "a", name: "Citra", kind: "hop", quantity: 10, unit: "g" }],
      [supplier],
    );
    expect(result.options[0].lines[0].packages).toBe(2);
    expect(result.options[0].total).toBe(17);
  });
  it("never combines suppliers into a supposedly single supplier cart", () => {
    const result = optimizeSingleSupplier(
      [...needs, { name: "Mosaic", kind: "hop", quantity: 50, unit: "g" }],
      [],
      [
        supplier,
        {
          ...supplier,
          id: "two",
          products: [{ ...supplier.products[0], ingredient: "Mosaic" }],
        },
      ],
    );
    expect(result.status).toBe("unavailable");
  });
  it("supports explicit substitutions but respects stock", () => {
    const substitute = {
      ...supplier,
      products: [
        {
          ...supplier.products[0],
          ingredient: "Centennial",
          substitutes: ["Citra"],
          stock: 2,
        },
      ],
    };
    expect(
      optimizeSingleSupplier(needs, [], [substitute]).options[0].lines[0]
        .substituted,
    ).toBe(true);
    expect(optimizeSingleSupplier(needs, [], [substitute], false).status).toBe(
      "unavailable",
    );
    expect(
      optimizeSingleSupplier(
        needs,
        [],
        [
          {
            ...substitute,
            products: [{ ...substitute.products[0], stock: 1 }],
          },
        ],
      ).status,
    ).toBe("unavailable");
  });
  it("sums lots and does not confuse units", () => {
    expect(
      shortages(needs, [
        { id: "a", name: "Citra", kind: "hop", quantity: 120, unit: "kg" },
      ])[0].quantity,
    ).toBe(120);
    expect(
      optimizeSingleSupplier(
        needs,
        [{ id: "a", name: "Citra", kind: "hop", quantity: 120, unit: "g" }],
        [],
      ).status,
    ).toBe("in-stock");
  });
});
