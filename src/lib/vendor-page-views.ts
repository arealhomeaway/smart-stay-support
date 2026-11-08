import type { Capability } from "@/lib/permissions";

export const VENDOR_TABS = ["directory", "database", "gold", "coverage", "review"] as const;
export type VendorTab = (typeof VENDOR_TABS)[number];

/**
 * What the Vendors page shows and allows (Nov 8, 2026, Emily).
 *
 * Onboarding uses all of ARHA's vendors: the Director of Onboarding, Project
 * Managers and Utilities see every tab and every vendor record and field,
 * exactly like the Operations Supervisor. They edit vendor companies, service
 * areas and home coverage (`vendor_admin`). Status (Approved or Gold), Gold
 * Standard and compliance fields, screening decisions, documents, vendor
 * logins, imports, columns and saved views stay with Operations leadership
 * (`vendor_leadership`): shown read only with a plain label, never hidden.
 * Design never opens Vendors. A coordinator sees what they saw before.
 */
export function vendorPageAccess(can: (c: Capability) => boolean, readOnly = false) {
  const edit = can("vendor_admin") && !readOnly;
  const lead = can("vendor_leadership") && !readOnly;
  const tabs: VendorTab[] = can("vendor_directory")
    ? VENDOR_TABS.filter((t) => t !== "database" || can("vendor_admin"))
    : [];
  return { tabs, edit, lead, screening: tabs.length > 0 };
}

/** Plain label shown where Operations leadership keeps the control. */
export const LEADERSHIP_ONLY_LABEL = "Changed by Operations leadership.";
