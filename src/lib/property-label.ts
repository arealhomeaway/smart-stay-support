/** Display-only home identity. Stored listing names and matching IDs never change. */
export type PropertyLabelFields = {
  name?: string | null | undefined;
  nickname?: string | null | undefined;
  address_line1?: string | null | undefined;
  unit?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  postal_code?: string | null | undefined;
  ownerrez_property_id?: string | number | null | undefined;
};

const trimmed = (value: unknown): string => typeof value === "string" ? value.trim() : "";

export function formatPropertyLabel(property: PropertyLabelFields | null | undefined) {
  const street = trimmed(property?.address_line1);
  const unit = trimmed(property?.unit);
  const primary = street
    ? `${street}${unit ? `, ${/^unit\b/i.test(unit) ? unit : `Unit ${unit}`}` : ""}`
    : `${trimmed(property?.name) || "Home"} (address missing)`;
  const city = trimmed(property?.city);
  const state = trimmed(property?.state);
  const zip = trimmed(property?.postal_code);
  const secondary = [city, state].filter(Boolean).join(", ");
  const region = [state, zip].filter(Boolean).join(" ");
  const full = [primary, city, region].filter(Boolean).join(", ");
  return { primary, secondary, full };
}

/** Aliases stay searchable, but are never substituted for an available street. */
export function propertySearchText(property: PropertyLabelFields) {
  return [property.address_line1, property.unit, property.city, property.state,
    property.postal_code, property.name, property.nickname, property.ownerrez_property_id]
    .filter(value => value !== null && value !== undefined).join(" ");
}

export function matchesPropertySearch(property: PropertyLabelFields, query: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const haystack = normalize(propertySearchText(property));
  return normalize(query).split(/\s+/).filter(Boolean).every(token => haystack.includes(token));
}

export const PROPERTY_LABEL_SELECT = "name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id";