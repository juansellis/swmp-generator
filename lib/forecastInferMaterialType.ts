/**
 * Categorization hook for forecast items: infer material type from item name.
 * For now returns null; TODO: add rules-based or LLM-based inference and return
 * when confidence is high enough to pre-select in the UI.
 */

export type InferMaterialTypeResult = {
  materialTypeName: string;
  confidence: number;
};

/**
 * Infer a material type (waste stream type name) from an item name.
 * Returns null when disabled or when inference is not confident enough.
 *
 * TODO: Implement via keyword rules or LLM. When confident (e.g. confidence >= 0.8),
 * the UI can pre-select the material type in the dropdown.
 */
export function inferMaterialType(_itemName: string): InferMaterialTypeResult | null {
  const name = typeof _itemName === "string" ? _itemName.trim() : "";
  if (!name) return null;

  // TODO: Add rules-based matching (e.g. "timber" -> "Timber (untreated)")
  // or call LLM for free-text -> waste_stream_types.name with confidence.
  return null;
}
