import type { InventoryItem, Recipe, Requirement, Supplier } from "./types";

export function requirementsFor(recipe: Recipe): Requirement[] {
  const additions: Requirement[] = [
    ...recipe.grains.map((grain) => ({
      name: grain.name,
      kind: "grain" as const,
      quantity: grain.kg,
      unit: "kg" as const,
    })),
    ...recipe.hops.map((hop) => ({
      name: hop.name,
      kind: "hop" as const,
      quantity: hop.grams,
      unit: "g" as const,
    })),
    { name: recipe.yeast, kind: "yeast", quantity: 1, unit: "pack" },
    { name: "Gypsum", kind: "salt", quantity: recipe.water.gypsum, unit: "g" },
    {
      name: "Calcium chloride",
      kind: "salt",
      quantity: recipe.water.calciumChloride,
      unit: "g",
    },
  ];
  return additions
    .reduce<Requirement[]>((all, addition) => {
      const existing = all.find(
        (item) =>
          item.name.toLowerCase() === addition.name.toLowerCase() &&
          item.kind === addition.kind &&
          item.unit === addition.unit,
      );
      if (existing) existing.quantity += addition.quantity;
      else all.push({ ...addition });
      return all;
    }, [])
    .filter((item) => item.quantity > 0);
}

export function shortages(
  requirements: Requirement[],
  inventory: InventoryItem[],
) {
  return requirements
    .map((item) => {
      const available = inventory
        .filter(
          (stock) =>
            stock.name.toLowerCase() === item.name.toLowerCase() &&
            stock.kind === item.kind &&
            stock.unit === item.unit,
        )
        .reduce((total, stock) => total + stock.quantity, 0);
      return {
        ...item,
        quantity: Math.max(0, item.quantity - available),
        available,
      };
    })
    .filter((item) => item.quantity > 0.00001);
}

export function optimizeSingleSupplier(
  requirements: Requirement[],
  inventory: InventoryItem[],
  suppliers: Supplier[],
  allowSubstitutions = true,
) {
  const missing = shortages(requirements, inventory);
  if (!missing.length)
    return { status: "in-stock" as const, missing, options: [] };
  const options = suppliers
    .flatMap((supplier) => {
      const lines = missing.map((item) => {
        const matches = supplier.products
          .filter(
            (product) =>
              product.kind === item.kind &&
              (product.ingredient.toLowerCase() === item.name.toLowerCase() ||
                (allowSubstitutions &&
                  product.substitutes?.some(
                    (name) => name.toLowerCase() === item.name.toLowerCase(),
                  ))),
          )
          .flatMap((product) => {
            if (product.packageSize <= 0 || product.price < 0) return [];
            const packages = Math.ceil(item.quantity / product.packageSize);
            return packages <= product.stock
              ? [
                  {
                    ...item,
                    product: product.ingredient,
                    packages,
                    purchased: packages * product.packageSize,
                    cost: packages * product.price,
                    substituted:
                      product.ingredient.toLowerCase() !==
                      item.name.toLowerCase(),
                  },
                ]
              : [];
          });
        return matches.sort(
          (first, second) =>
            Number(first.substituted) - Number(second.substituted) ||
            first.cost - second.cost,
        )[0];
      });
      if (lines.some((line) => !line)) return [];
      const validLines = lines.filter((line) => !!line);
      const subtotal = validLines.reduce((total, line) => total + line.cost, 0);
      return [
        {
          supplier,
          lines: validLines,
          subtotal,
          total: subtotal + supplier.shipping,
        },
      ];
    })
    .sort(
      (first, second) =>
        first.supplier.currency.localeCompare(second.supplier.currency) ||
        first.total - second.total,
    );
  return {
    status: options.length ? ("matched" as const) : ("unavailable" as const),
    missing,
    options,
  };
}
