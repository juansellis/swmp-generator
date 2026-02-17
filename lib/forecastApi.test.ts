/**
 * Unit tests: forecast conversion to canonical kg (tonnes = kg/1000).
 * Priority: item override -> stream defaults -> conversion_factors -> else conversion_required.
 * Run: npx tsx lib/forecastApi.test.ts
 */

import { calcWasteKg, calcWasteQty, toWasteKg } from "./forecastApi";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    console.error(`  ✗ ${label}`);
    throw e;
  }
}

console.log("forecastApi conversion");
run("calcWasteQty: quantity * excess_percent / 100", () => {
  assert(calcWasteQty(100, 10) === 10, "100*10%");
  assert(calcWasteQty(50, 20) === 10, "50*20%");
  assert(calcWasteQty(0, 10) === 0, "0");
});
run("calcWasteQty: 0 for non-finite", () => {
  assert(calcWasteQty(NaN, 10) === 0, "NaN");
  assert(calcWasteQty(100, NaN) === 0, "NaN pct");
});
run("toWasteKg: tonne/t/tonnes -> kg", () => {
  assert(toWasteKg(1, "tonne") === 1000, "1 tonne");
  assert(toWasteKg(2.5, "tonnes") === 2500, "2.5 tonnes");
  assert(toWasteKg(0.1, "t") === 100, "0.1 t");
});
run("toWasteKg: kg pass-through", () => {
  assert(toWasteKg(500, "kg") === 500, "500 kg");
  assert(toWasteKg(0, "kg") === 0, "0 kg");
});
run("toWasteKg: m3 -> kg with density", () => {
  assert(toWasteKg(10, "m3", { densityKgM3: 200 }) === 2000, "10 m3 * 200");
  assert(toWasteKg(1, "m³", { densityKgM3: 1200 }) === 1200, "1 m³ * 1200");
});
run("toWasteKg: m3 returns null without density", () => {
  assert(toWasteKg(10, "m3", {}) === null, "m3 no density");
  assert(toWasteKg(10, "m3") === null, "m3 no opts");
});
run("toWasteKg: m -> kg with kgPerM", () => {
  assert(toWasteKg(100, "m", { kgPerM: 5 }) === 500, "100 m * 5");
  assert(toWasteKg(10, "metre", { kgPerM: 2.5 }) === 25, "10 m * 2.5");
});
run("toWasteKg: m returns null without kgPerM", () => {
  assert(toWasteKg(10, "m", {}) === null, "m no kgPerM");
  assert(toWasteKg(10, "m") === null, "m no opts");
});
run("toWasteKg: unknown unit returns null", () => {
  assert(toWasteKg(10, "L") === null, "L");
  assert(toWasteKg(10, "pallet") === null, "pallet");
});
run("toWasteKg: negative/non-finite returns null", () => {
  assert(toWasteKg(-1, "kg") === null, "negative");
  assert(toWasteKg(NaN, "kg") === null, "NaN");
});
run("calcWasteKg: tonne -> kg", () => {
  assert(calcWasteKg(100, 10, "tonne") === 10000, "10 tonne waste -> 10_000 kg");
});
run("calcWasteKg: kg, m3, m with options", () => {
  assert(calcWasteKg(100, 10, "kg", null, null) === 10, "kg");
  assert(calcWasteKg(20, 5, "m3", null, 150) === 150, "m3 with density");
  assert(calcWasteKg(100, 10, "m", 2, null) === 20, "m with kgPerM");
});
run("calcWasteKg: null when conversion not possible", () => {
  assert(calcWasteKg(10, 10, "m3") === null, "m3 no density");
  assert(calcWasteKg(10, 10, "m") === null, "m no kgPerM");
});

console.log("Phase 3 acceptance (conversion math):");
run("Steel studs: 1000 kg, 10% -> 100 kg waste -> 0.1 t", () => {
  const wasteQty = calcWasteQty(1000, 10);
  assert(wasteQty === 100, "waste qty 100");
  const kg = calcWasteKg(1000, 10, "kg", null, null);
  assert(kg === 100, "100 kg");
  assert((kg! / 1000) === 0.1, "0.1 t");
});
run("Concrete: 2 m3, 5% with density 1048 -> included", () => {
  const wasteQty = calcWasteQty(2, 5);
  assert(wasteQty === 0.1, "0.1 m3 waste");
  const kg = calcWasteKg(2, 5, "m3", null, 1048);
  assert(kg !== null && Math.abs(kg - 104.8) < 0.01, "104.8 kg");
  assert(kg! / 1000 < 0.2 && kg! / 1000 > 0.09, "~0.105 t");
});
run("Timber: 30 m, 10% with kg_per_m 5 -> included", () => {
  const wasteQty = calcWasteQty(30, 10);
  assert(wasteQty === 3, "3 m waste");
  const kg = calcWasteKg(30, 10, "m", 5, null);
  assert(kg === 15, "15 kg");
  assert(kg / 1000 === 0.015, "0.015 t");
});
run("Unallocated/conversion_required: m3 without density returns null", () => {
  assert(calcWasteKg(10, 10, "m3") === null, "m3 no density");
});
run("Unallocated/conversion_required: m without kg_per_m returns null", () => {
  assert(calcWasteKg(10, 10, "m") === null, "m no kgPerM");
});

console.log("All conversion tests passed.");
