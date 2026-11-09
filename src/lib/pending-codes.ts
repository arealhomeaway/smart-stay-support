/**
 * Pending codes line inside Entry & Access Details (Emily, Nov 9).
 *
 * Brings back what the old codes panel offered the people who manage codes
 * (Admin, Supervisor and Onboarding accounts; the server's canManageCredentials
 * decides): the import's waiting-for-review count, Mark current and Archive per
 * code. Values never appear here; they stay behind the logged Show.
 */

/** Shown only to people who manage codes, never while viewing as someone else. */
export function showPendingCodes(access: { canManageCodes: boolean; readOnly: boolean }): boolean {
  return access.canManageCodes && !access.readOnly;
}

export function pendingCodesLine(waiting: number): string {
  if (waiting <= 0) return "Nothing waiting for review";
  return `${waiting} code${waiting === 1 ? "" : "s"} from the import waiting for review`;
}

/** When a code was last confirmed as current. */
export function codeCheckedText(lastVerifiedOn: string | null): string {
  if (!lastVerifiedOn) return "Never checked";
  const [y, m, d] = lastVerifiedOn.slice(0, 10).split("-");
  return y && m && d ? `Checked ${Number(m)}/${Number(d)}/${y}` : "Never checked";
}
