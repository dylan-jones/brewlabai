import type { Recipe } from "./types";

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportBeerXML(recipe: Recipe) {
  const xml = document.implementation.createDocument(null, "RECIPES");
  const node = (parent: Element, name: string, value?: string | number) => {
    const element = xml.createElement(name);
    if (value !== undefined) element.textContent = String(value);
    parent.appendChild(element);
    return element;
  };
  const root = node(xml.documentElement, "RECIPE");
  for (const [key, value] of Object.entries({
    NAME: recipe.name,
    VERSION: 1,
    TYPE: "All Grain",
    BREWER: "BrewLab.ai",
    BATCH_SIZE: recipe.batchLiters,
    BOIL_SIZE: recipe.batchLiters + (recipe.boilOff * recipe.boilMinutes) / 60,
    BOIL_TIME: recipe.boilMinutes,
    EFFICIENCY: recipe.efficiency,
  }))
    node(root, key, value);
  const fermentables = node(root, "FERMENTABLES");
  recipe.grains.forEach((grain) => {
    const item = node(fermentables, "FERMENTABLE");
    Object.entries({
      NAME: grain.name,
      VERSION: 1,
      TYPE: "Grain",
      AMOUNT: grain.kg,
      COLOR: grain.color,
      YIELD: (grain.ppg / 46) * 100,
    }).forEach(([key, value]) => node(item, key, value));
  });
  const hops = node(root, "HOPS");
  recipe.hops.forEach((hop) => {
    const item = node(hops, "HOP");
    Object.entries({
      NAME: hop.name,
      VERSION: 1,
      ALPHA: hop.alpha,
      AMOUNT: hop.grams / 1000,
      USE:
        hop.use === "dry hop"
          ? "Dry Hop"
          : hop.use === "whirlpool"
            ? "Aroma"
            : "Boil",
      TIME: hop.minutes,
      FORM: "Pellet",
    }).forEach(([key, value]) => node(item, key, value));
  });
  const yeast = node(node(root, "YEASTS"), "YEAST");
  Object.entries({
    NAME: recipe.yeast,
    VERSION: 1,
    TYPE: "Ale",
    FORM: "Liquid",
    AMOUNT: 1,
    AMOUNT_IS_WEIGHT: "FALSE",
    ATTENUATION: recipe.attenuation,
  }).forEach(([key, value]) => node(yeast, key, value));
  const mash = node(root, "MASH");
  node(mash, "NAME", "Single infusion");
  node(mash, "VERSION", 1);
  node(mash, "GRAIN_TEMP", 20);
  const step = node(node(mash, "MASH_STEPS"), "MASH_STEP");
  Object.entries({
    NAME: "Saccharification",
    VERSION: 1,
    TYPE: "Infusion",
    STEP_TEMP: recipe.mashC,
    STEP_TIME: 60,
  }).forEach(([key, value]) => node(step, key, value));
  const miscs = node(root, "MISCS");
  for (const [name, grams] of [
    ["Gypsum", recipe.water.gypsum],
    ["Calcium chloride", recipe.water.calciumChloride],
  ] as const) {
    if (!grams) continue;
    const misc = node(miscs, "MISC");
    Object.entries({
      NAME: name,
      VERSION: 1,
      TYPE: "Water Agent",
      USE: "Mash",
      TIME: 60,
      AMOUNT: grams / 1000,
      AMOUNT_IS_WEIGHT: "TRUE",
    }).forEach(([key, value]) => node(misc, key, value));
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    new XMLSerializer().serializeToString(xml)
  );
}

export function toBrewfather(recipe: Recipe) {
  return {
    name: recipe.name,
    type: "All Grain",
    batchSize: recipe.batchLiters,
    boilTime: recipe.boilMinutes,
    efficiency: recipe.efficiency,
    style: { name: recipe.style },
    equipment: {
      name: "BrewLab.ai equipment",
      batchSize: recipe.batchLiters,
      efficiency: recipe.efficiency,
      boilOffPerHr: recipe.boilOff,
    },
    fermentables: recipe.grains.map((grain) => ({
      name: grain.name,
      type: "Grain",
      amount: grain.kg,
      color: grain.color * 1.97,
      potential: 1 + grain.ppg / 1000,
    })),
    hops: recipe.hops.map((hop) => ({
      name: hop.name,
      amount: hop.grams,
      alpha: hop.alpha,
      time: hop.minutes,
      use:
        hop.use === "dry hop"
          ? "Dry Hop"
          : hop.use === "whirlpool"
            ? "Aroma"
            : "Boil",
    })),
    yeasts: [
      {
        name: recipe.yeast,
        attenuation: recipe.attenuation,
        amount: 1,
        type: "Ale",
        form: "Liquid",
      },
    ],
    mash: {
      name: "Single infusion",
      steps: [
        {
          name: "Saccharification",
          type: "Infusion",
          stepTemp: recipe.mashC,
          stepTime: 60,
        },
      ],
    },
    miscs: [
      {
        name: "Gypsum",
        type: "Water Agent",
        amount: recipe.water.gypsum,
        use: "Mash",
      },
      {
        name: "Calcium chloride",
        type: "Water Agent",
        amount: recipe.water.calciumChloride,
        use: "Mash",
      },
    ],
  };
}
