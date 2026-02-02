/**
 * NZ waste stream defaults: densities and default units for diversion calculations.
 * Keys must match exact stream labels used in the app.
 */

export type QtyUnit = "m3" | "t" | "kg" | "m2" | "L";

export type StreamDefault = {
  densityKgM3: number;
  defaultUnit: QtyUnit;
  defaultThicknessM?: number;
};

export const STREAM_DEFAULTS: Record<string, StreamDefault> = {
  "Mixed C&D": { densityKgM3: 1200, defaultUnit: "m3" },
  "Timber (treated)": { densityKgM3: 178, defaultUnit: "m3" },
  Metals: { densityKgM3: 63, defaultUnit: "m3" },
  Cardboard: { densityKgM3: 38, defaultUnit: "m3" },
  "Hard plastics": { densityKgM3: 72, defaultUnit: "m3" },
  "E-waste (cables/lighting/appliances)": { densityKgM3: 300, defaultUnit: "m3" },
  "Ceiling tiles": { densityKgM3: 150, defaultUnit: "m2", defaultThicknessM: 0.015 },
  Insulation: { densityKgM3: 100, defaultUnit: "m3" },
  "Asphalt / roading material": { densityKgM3: 1500, defaultUnit: "m3" },
  "Concrete (unreinforced)": { densityKgM3: 900, defaultUnit: "m3" },
  "Roofing materials": { densityKgM3: 120, defaultUnit: "m2", defaultThicknessM: 0.01 },
  "Hazardous waste (general)": { densityKgM3: 225, defaultUnit: "m3" },
  "Cleanfill soil": { densityKgM3: 1500, defaultUnit: "m3" },
  "PVC pipes / services": { densityKgM3: 140, defaultUnit: "m3" },
  "Timber (untreated)": { densityKgM3: 178, defaultUnit: "m3" },
  "Plasterboard / GIB": { densityKgM3: 238, defaultUnit: "m3" },
  "Concrete / masonry": { densityKgM3: 1048, defaultUnit: "m3" },
  "Soft plastics (wrap/strapping)": { densityKgM3: 72, defaultUnit: "m3" },
  Glass: { densityKgM3: 411, defaultUnit: "m3" },
  "Paints/adhesives/chemicals": { densityKgM3: 1000, defaultUnit: "L" },
  "Carpet / carpet tiles": { densityKgM3: 200, defaultUnit: "m2", defaultThicknessM: 0.01 },
  "Soil / spoil (cleanfill if verified)": { densityKgM3: 1500, defaultUnit: "m3" },
  "Concrete (reinforced)": { densityKgM3: 1048, defaultUnit: "m3" },
  "Masonry / bricks": { densityKgM3: 1500, defaultUnit: "m3" },
  "Green waste / vegetation": { densityKgM3: 225, defaultUnit: "m3" },
  "Contaminated soil": { densityKgM3: 1500, defaultUnit: "m3" },
  "Packaging (mixed)": { densityKgM3: 38, defaultUnit: "m3" },
  "HDPE pipes / services": { densityKgM3: 100, defaultUnit: "m3" },
};

export type QtyToTonnesParams = {
  qty: number;
  unit: QtyUnit;
  densityKgM3: number;
  thicknessM?: number | null;
};

export type QtyToTonnesResult = {
  tonnes: number;
  missingThickness: boolean;
};

/**
 * Convert quantity in given unit to tonnes using density (and thickness for m2).
 * Returns tonnes and a flag when unit is m2 but thickness is missing (tonnes = 0 in that case).
 */
export function qtyToTonnes({
  qty,
  unit,
  densityKgM3,
  thicknessM,
}: QtyToTonnesParams): QtyToTonnesResult {
  if (qty < 0 || Number.isNaN(qty)) {
    return { tonnes: 0, missingThickness: false };
  }
  switch (unit) {
    case "t":
      return { tonnes: qty, missingThickness: false };
    case "kg":
      return { tonnes: qty / 1000, missingThickness: false };
    case "m3":
      return { tonnes: (qty * densityKgM3) / 1000, missingThickness: false };
    case "L":
      // L = litres → volume m³ = qty/1000; mass kg = volume * density; tonnes = mass/1000
      return { tonnes: (qty / 1000) * densityKgM3 / 1000, missingThickness: false };
    case "m2": {
      const t = thicknessM != null && !Number.isNaN(thicknessM) && thicknessM >= 0 ? thicknessM : null;
      if (t === null) {
        return { tonnes: 0, missingThickness: true };
      }
      return { tonnes: (qty * t * densityKgM3) / 1000, missingThickness: false };
    }
    default:
      return { tonnes: 0, missingThickness: false };
  }
}

/** Default unit for a stream label (from STREAM_DEFAULTS). Falls back to "m3" if not in map. */
export function getDefaultUnitForStreamLabel(stream: string): QtyUnit {
  const d = STREAM_DEFAULTS[stream];
  return d?.defaultUnit ?? "m3";
}

/** Default thickness (m) for m2 streams. Undefined if not m2 or not in map. */
export function getDefaultThicknessForStreamLabel(stream: string): number | undefined {
  const d = STREAM_DEFAULTS[stream];
  return d?.defaultThicknessM;
}

/** Density (kg/m³) for a stream label. Falls back to 1000 if not in map. */
export function getDensityForStreamLabel(stream: string): number {
  const d = STREAM_DEFAULTS[stream];
  return d?.densityKgM3 ?? 1000;
}

// ---------------------------------------------------------------------------
// Diversion calculator (Option B)
// ---------------------------------------------------------------------------

export type PlanForDiversion = {
  category: string;
  estimated_qty?: number | null;
  unit?: QtyUnit | string | null;
  density_kg_m3?: number | null;
  thickness_m?: number | null;
  intended_outcomes: string[];
};

export type DiversionResult = {
  totalTonnes: number;
  diversionReuseRecyclePct: number;
  landfillAvoidancePct: number;
  missingThicknessStreams: string[];
  missingQuantityStreams: string[];
};

/**
 * Compute diversion metrics from plans using qtyToTonnes.
 * diversionReuseRecyclePct: tonnes with Reuse or Recycle / total tonnes.
 * landfillAvoidancePct: tonnes with Reuse, Recycle, or Cleanfill / total tonnes.
 */
export function computeDiversion(plans: PlanForDiversion[]): DiversionResult {
  const missingThicknessStreams: string[] = [];
  const missingQuantityStreams: string[] = [];
  let totalTonnes = 0;
  let diversionTonnes = 0; // Reuse or Recycle
  let landfillAvoidanceTonnes = 0; // Reuse, Recycle, or Cleanfill

  for (const p of plans) {
    const qty = p.estimated_qty;
    const hasQty = typeof qty === "number" && !Number.isNaN(qty) && qty >= 0;
    if (!hasQty) {
      missingQuantityStreams.push(p.category);
      continue;
    }

    const unit = (p.unit ?? getDefaultUnitForStreamLabel(p.category)) as QtyUnit;
    const density = p.density_kg_m3 != null && p.density_kg_m3 > 0
      ? p.density_kg_m3
      : getDensityForStreamLabel(p.category);
    const thicknessM =
      unit === "m2"
        ? p.thickness_m != null && !Number.isNaN(p.thickness_m) && p.thickness_m >= 0
          ? p.thickness_m
          : getDefaultThicknessForStreamLabel(p.category)
        : undefined;

    const { tonnes, missingThickness } = qtyToTonnes({
      qty,
      unit,
      densityKgM3: density,
      thicknessM: thicknessM ?? null,
    });

    if (missingThickness) {
      missingThicknessStreams.push(p.category);
      continue;
    }

    totalTonnes += tonnes;
    const outcomes = p.intended_outcomes ?? [];
    const hasReuseRecycle =
      outcomes.includes("Reuse") || outcomes.includes("Recycle");
    const hasCleanfill = outcomes.includes("Cleanfill");
    if (hasReuseRecycle) {
      diversionTonnes += tonnes;
      landfillAvoidanceTonnes += tonnes;
    } else if (hasCleanfill) {
      landfillAvoidanceTonnes += tonnes;
    }
  }

  const diversionReuseRecyclePct =
    totalTonnes > 0 ? (diversionTonnes / totalTonnes) * 100 : 0;
  const landfillAvoidancePct =
    totalTonnes > 0 ? (landfillAvoidanceTonnes / totalTonnes) * 100 : 0;

  return {
    totalTonnes,
    diversionReuseRecyclePct,
    landfillAvoidancePct,
    missingThicknessStreams,
    missingQuantityStreams,
  };
}
