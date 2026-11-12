/**
 * Owner activities (cards, Opportunities) come only from the automated homeowner plan, which starts when a home
 * is enrolled. The older manual release is refused so it can never add a second copy of the same work.
 */
export const OWNER_ACTIVITIES_FROM_PLAN = "Owner activities now come from the homeowner plan automatically.";

export function refuseManualOwnerRelease(): never {
  throw new Error(OWNER_ACTIVITIES_FROM_PLAN);
}
