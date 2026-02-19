export const PROJECT_TYPE_GROUPS: { label: string; options: string[] }[] = [
  { label: "Residential", options: ["New build house", "Townhouse / multi-unit (residential)", "Residential renovation", "Residential fit-out"] },
  { label: "Commercial fit-out", options: ["Commercial fit-out", "Office fit-out", "Retail fit-out", "Hospitality fit-out"] },
  { label: "Commercial", options: ["Commercial Build", "Commercial renovation", "Demolition / strip-out (commercial)"] },
  { label: "Civil / infrastructure", options: ["Civil works / earthworks", "Roading", "Three waters / underground services", "Landscaping"] },
  { label: "Industrial & other", options: ["Industrial build", "Warehouse / logistics facility", "School / education", "Healthcare", "Public sector / council project", "Other"] },
];

export const PROJECT_TYPE_OPTIONS = PROJECT_TYPE_GROUPS.flatMap((g) => g.options);
