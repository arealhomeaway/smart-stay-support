/**
 * Plain wording when a home's bulk Task Save is refused (Build 17 finding 1). The database locks
 * the home's project under its row rule, so a person who may read but not edit the home was told
 * the project had not started. When the project does exist, say who can change these Tasks.
 */
export const HOME_BULK_NOT_ALLOWED =
  "Only this home's Project Manager, the Director of Onboarding or a Supervisor can change these Tasks.";

export function bulkEditRefusal(message: string | null | undefined, projectExists: boolean): string {
  const m = (message ?? "").trim();
  if (projectExists && (m.includes("Start the onboarding project") || /permission denied|row-level security/i.test(m)))
    return HOME_BULK_NOT_ALLOWED;
  if (/permission denied|row-level security/i.test(m)) return "Nothing was saved. You cannot change these Tasks.";
  return m || "Nothing was saved. Review the Tasks and try again.";
}
