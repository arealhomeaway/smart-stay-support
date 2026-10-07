/**
 * Which accounts the Onboarding Director may create or deactivate.
 * Pure rule shared by the server checks and the screen.
 * In scope: only onboarding and/or homeowner roles, and no seat or pool
 * membership outside the Onboarding team. Anything broader stays with an admin.
 */
export const DIRECTOR_CREATABLE_ROLES = ["onboarding", "owner"] as const;
export type DirectorCreatableRole = (typeof DIRECTOR_CREATABLE_ROLES)[number];

export const ONBOARDING_POOL_CODES = new Set([
  "onboarding_project_manager",
  "utilities",
  "design_staging",
]);

export type ScopeInput = {
  roles: string[];
  /** Functional role pool codes the person belongs to. */
  poolCodes: string[];
  /** Seat codes the person currently holds (functional_roles.current_seat_holder). */
  seatCodes: string[];
};

export function accountScope(p: ScopeInput): { inScope: boolean; reason: string | null } {
  const outsideRoles = p.roles.filter((r) => !(DIRECTOR_CREATABLE_ROLES as readonly string[]).includes(r));
  if (outsideRoles.length)
    return { inScope: false, reason: `Also holds ${outsideRoles.join(", ")} access — an administrator manages this account.` };
  if (p.seatCodes.length)
    return { inScope: false, reason: "Holds a responsibility seat — an administrator manages this account." };
  const outsidePools = p.poolCodes.filter((c) => !ONBOARDING_POOL_CODES.has(c));
  if (outsidePools.length)
    return { inScope: false, reason: "Belongs to a team outside Onboarding — an administrator manages this account." };
  if (p.roles.length === 0) return { inScope: false, reason: "Has no Onboarding or homeowner access." };
  return { inScope: true, reason: null };
}
