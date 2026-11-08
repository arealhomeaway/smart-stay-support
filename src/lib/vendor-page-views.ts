import type { Capability } from "@/lib/permissions";

/**
 * Which leadership views the Vendors page shows. The Director of Onboarding,
 * Project Manager and Utilities roles keep the vendor list, profiles and their
 * allowed edits (companies, service areas, home coverage), but the Database
 * tab, Needs Review and the screening panel are hidden from them instead of
 * shown and refused on save. Everyone else sees exactly what they saw before.
 */
export function vendorPageViews(can: (c: Capability) => boolean) {
  return {
    database: can("vendor_database"),
    review: can("vendor_screening"),
    screening: can("vendor_screening"),
  };
}
