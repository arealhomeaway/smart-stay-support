export type PropertyDeleteCheck = { allowed: boolean; address: string; reasons: string[]; counts: Record<string, number> };
export function validPropertyDeleteConfirmation(address: string, typed: string, reason: string): boolean {
  return address.trim().length > 0 && typed.trim() === address && reason.trim().length > 0;
}
export function canShowPropertyDelete(authorised: boolean, lifecycle: string | null, readOnly: boolean): boolean {
  return authorised && lifecycle === "onboarding" && !readOnly;
}
