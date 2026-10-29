/**
 * One canonical way to render a property address.
 *
 * Property context appears in several places (Property Hub, the ticket context
 * drawer, ticket details, search). They previously each composed the address
 * from a different subset of columns, so the same home could read "No address
 * on file" in one surface while showing a full street address in another.
 * Every surface now calls this helper.
 */
import { formatPropertyLabel, type PropertyLabelFields } from "./property-label";

export type PropertyAddressFields = PropertyLabelFields & {
  address_line1?: string | null;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  formatted_address?: string | null;
};

/** Full structured address, using the same label rule as home headings. */
export function propertyAddress(p: PropertyAddressFields | null | undefined): string {
  if (!p) return "";
  return formatPropertyLabel(p).full;
}

/** The same address, or the shared empty-state sentence. */
export function propertyAddressLabel(p: PropertyAddressFields | null | undefined): string {
  return propertyAddress(p) || "No address on file";
}
