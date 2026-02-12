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

/** Ordered stream labels for dropdowns/multiselect (e.g. admin facilities). */
export const STREAM_LABELS = Object.keys(STREAM_DEFAULTS) as string[];

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
 * Convert a single value to tonnes. For reporting and display.
 * - t/tonne: value as-is
 * - kg: value / 1000
 * - m3: (value * densityKgM3) / 1000 — requires densityKgM3
 * - m2: (value * thicknessM * densityKgM3) / 1000 — requires densityKgM3 and thicknessM
 * - L: (value/1000)*densityKgM3/1000 — requires densityKgM3 (density in kg/m³; L as volume)
 * Returns null if conversion not possible (e.g. m2 without thickness).
 */
export function toTonnes(
  value: number,
  unit: string,
  options?: { densityKgM3?: number | null; thicknessM?: number | null }
): number | null {
  if (value < 0 || !Number.isFinite(value)) return null;
  const density = options?.densityKgM3 ?? 1000;
  const thicknessM = options?.thicknessM;
  const u = String(unit).toLowerCase();
  switch (u) {
    case "t":
    case "tonne":
    case "tonnes":
      return value;
    case "kg":
      return value / 1000;
    case "m3":
      return density != null && density > 0 ? (value * density) / 1000 : null;
    case "l":
      return density != null && density > 0 ? (value / 1000) * (density / 1000) : null;
    case "m2": {
      const t = thicknessM != null && !Number.isNaN(thicknessM) && thicknessM >= 0 ? thicknessM : null;
      if (t === null || density == null || density <= 0) return null;
      return (value * t * density) / 1000;
    }
    default:
      return null;
  }
}

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

export type PlanLikeForTonnes = {
  estimated_qty?: number | null;
  unit?: string | null;
  density_kg_m3?: number | null;
  thickness_m?: number | null;
};

/**
 * Compute manual quantity in tonnes from a plan (estimated_qty + unit + density/thickness).
 * Uses stream label for default density and thickness when plan values are missing.
 * Returns null if no quantity or conversion not possible (e.g. m2 without thickness).
 */
export function planManualQtyToTonnes(
  plan: PlanLikeForTonnes,
  streamLabel: string
): number | null {
  const qty = plan.estimated_qty;
  if (qty == null || !Number.isFinite(qty) || qty < 0) return null;
  const unit = (plan.unit ?? getDefaultUnitForStreamLabel(streamLabel)) as QtyUnit;
  const density =
    plan.density_kg_m3 != null && plan.density_kg_m3 > 0
      ? plan.density_kg_m3
      : getDensityForStreamLabel(streamLabel);
  const thicknessM =
    unit === "m2"
      ? plan.thickness_m ?? getDefaultThicknessForStreamLabel(streamLabel)
      : undefined;
  return toTonnes(qty, unit, {
    densityKgM3: density,
    thicknessM: thicknessM ?? undefined,
  });
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
  /** Manual quantity in plan unit (converted to tonnes if manual_qty_tonnes not provided). */
  estimated_qty?: number | null;
  unit?: QtyUnit | string | null;
  density_kg_m3?: number | null;
  thickness_m?: number | null;
  intended_outcomes: string[];
  /** Precomputed manual quantity in tonnes (overrides estimated_qty conversion when set). */
  manual_qty_tonnes?: number | null;
  /** Allocated forecast quantity in tonnes (from forecast items allocated to this stream). */
  forecast_qty_tonnes?: number | null;
};

export type DiversionResult = {
  totalTonnes: number;
  diversionReuseRecyclePct: number;
  landfillAvoidancePct: number;
  missingThicknessStreams: string[];
  missingQuantityStreams: string[];
};

/**
 * Compute diversion metrics from plans.
 * total_tonnes per stream = manual_qty_tonnes + forecast_qty_tonnes (converted as needed).
 * diversionReuseRecyclePct: tonnes with Reuse or Recycle / total tonnes.
 * landfillAvoidancePct: tonnes with Reuse, Recycle, or Cleanfill / total tonnes.
 * Stream "has quantity" when total_tonnes > 0.
 */
export function computeDiversion(plans: PlanForDiversion[]): DiversionResult {
  const missingThicknessStreams: string[] = [];
  const missingQuantityStreams: string[] = [];
  let totalTonnes = 0;
  let diversionTonnes = 0; // Reuse or Recycle
  let landfillAvoidanceTonnes = 0; // Reuse, Recycle, or Cleanfill

  for (const p of plans) {
    // Manual tonnes: use precomputed or convert estimated_qty
    let manualTonnes = 0;
    if (p.manual_qty_tonnes != null && Number.isFinite(p.manual_qty_tonnes) && p.manual_qty_tonnes >= 0) {
      manualTonnes = p.manual_qty_tonnes;
    } else {
      const qty = p.estimated_qty;
      const hasQty = typeof qty === "number" && !Number.isNaN(qty) && qty >= 0;
      if (hasQty) {
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
        manualTonnes = tonnes;
      }
    }

    const forecastTonnes =
      p.forecast_qty_tonnes != null && Number.isFinite(p.forecast_qty_tonnes) && p.forecast_qty_tonnes >= 0
        ? p.forecast_qty_tonnes
        : 0;
    const streamTotalTonnes = manualTonnes + forecastTonnes;

    if (streamTotalTonnes <= 0) {
      missingQuantityStreams.push(p.category);
      continue;
    }

    totalTonnes += streamTotalTonnes;
    const outcomes = p.intended_outcomes ?? [];
    const hasReuseRecycle =
      outcomes.includes("Reuse") || outcomes.includes("Recycle");
    const hasCleanfill = outcomes.includes("Cleanfill");
    if (hasReuseRecycle) {
      diversionTonnes += streamTotalTonnes;
      landfillAvoidanceTonnes += streamTotalTonnes;
    } else if (hasCleanfill) {
      landfillAvoidanceTonnes += streamTotalTonnes;
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
