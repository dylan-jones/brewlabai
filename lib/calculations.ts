import * as brewcalc from "brewcalc/lib/brewcalc.js";
import type { Recipe } from "./types";

export function calculateRecipe(recipe: Recipe) {
  const volume = Math.max(1, recipe.batchLiters);
  const fermentables = recipe.grains.map((grain) => ({
    type: "Grain",
    potential: 1 + grain.ppg / 1000,
    amount: grain.kg,
    color: grain.color,
  }));
  const points = brewcalc.gravityPoints(fermentables, recipe.efficiency / 100);
  const remaining = brewcalc.gravityPoints(
    fermentables,
    recipe.efficiency / 100,
    recipe.attenuation / 100,
  );
  const og = brewcalc.originalGravity(volume, points);
  const fg = brewcalc.finalGravity(volume, remaining);
  const preBoil = volume + (recipe.boilOff * recipe.boilMinutes) / 60;
  const averageGravity = (og - 1 + ((og - 1) * volume) / preBoil) / 2;
  const hops = recipe.hops
    .filter((hop) => hop.use !== "dry hop")
    .map((hop) => ({
      amount: hop.grams / 1000,
      alpha: (hop.alpha / 100) * Math.pow(0.95, hop.ageMonths),
      form: "Pellet",
      time: hop.minutes,
      use: "Boil",
    }));
  const boiled = hops.filter(
    (_, index) =>
      recipe.hops.filter((hop) => hop.use !== "dry hop")[index].use === "boil",
  );
  const whirlpool = hops.filter(
    (_, index) =>
      recipe.hops.filter((hop) => hop.use !== "dry hop")[index].use ===
      "whirlpool",
  );
  const ibu =
    brewcalc.bitternessIbuTinseth(boiled, averageGravity, volume) +
    brewcalc.bitternessIbuTinseth(whirlpool, averageGravity, volume) * 0.25;
  const srm = brewcalc.colorSRM(fermentables, volume);
  const calcium =
    recipe.water.calcium +
    (recipe.water.gypsum * 232.8 + recipe.water.calciumChloride * 272.6) /
      volume;
  const sulfate = recipe.water.sulfate + (recipe.water.gypsum * 557.7) / volume;
  const chloride =
    recipe.water.chloride + (recipe.water.calciumChloride * 482.3) / volume;
  return {
    og,
    fg,
    abv: brewcalc.estABV((og - 1) * 1000, (fg - 1) * 1000),
    ibu,
    srm,
    ebc: srm * 1.97,
    color: brewcalc.srmToCss(srm),
    calcium,
    sulfate,
    chloride,
    ratio: chloride > 0 ? sulfate / chloride : null,
    grainKg: recipe.grains.reduce((total, grain) => total + grain.kg, 0),
    hopGrams: recipe.hops.reduce((total, hop) => total + hop.grams, 0),
    preBoil,
  };
}
