import type { Capability } from "@/lib/permissions";

/**
 * Finance opens read only for people who may view it but not work it
 * (the Director of Onboarding). Finance staff, leadership and Admin keep
 * their existing rules.
 */
export function financeViewOnly(can: (capability: Capability) => boolean): boolean {
  return can("finance_view") && !can("finance_workspace");
}
