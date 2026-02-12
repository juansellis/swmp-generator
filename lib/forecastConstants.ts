/**
 * Shared constants for Forecast feature: material types, units, waste stream options.
 */

export const FORECAST_UNIT_OPTIONS = ["tonne", "kg", "m", "m³", "m²", "L"] as const;
export type ForecastUnit = (typeof FORECAST_UNIT_OPTIONS)[number];

/** Material type options for forecast items (interim select; later auto-categorise). */
export const MATERIAL_TYPE_OPTIONS = [
  "Mixed C&D",
  "Timber",
  "Concrete / masonry",
  "Metals",
  "Plasterboard / GIB",
  "Cardboard",
  "Plastics",
  "Glass",
  "Green waste",
  "Soil / spoil",
  "Hazardous",
  "Other",
] as const;
export type MaterialType = (typeof MATERIAL_TYPE_OPTIONS)[number];

/** Waste stream keys for stream allocation (match Inputs waste stream labels). */
export const WASTE_STREAM_OPTIONS = [
  "Mixed C&D",
  "Timber (untreated)",
  "Timber (treated)",
  "Plasterboard / GIB",
  "Metals",
  "Concrete / masonry",
  "Cardboard",
  "Soft plastics (wrap/strapping)",
  "Hard plastics",
  "Glass",
  "E-waste (cables/lighting/appliances)",
  "Paints/adhesives/chemicals",
  "Ceiling tiles",
  "Carpet / carpet tiles",
  "Insulation",
  "Soil / spoil (cleanfill if verified)",
  "Asphalt / roading material",
  "Concrete (reinforced)",
  "Concrete (unreinforced)",
  "Masonry / bricks",
  "Roofing materials",
  "Green waste / vegetation",
  "Hazardous waste (general)",
  "Contaminated soil",
  "Cleanfill soil",
  "Packaging (mixed)",
  "PVC pipes / services",
  "HDPE pipes / services",
] as const;
