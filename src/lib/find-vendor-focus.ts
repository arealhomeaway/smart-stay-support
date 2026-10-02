/**
 * One-shot request to open a Work Order on its Find a Vendor section (used by
 * the Ticket's "Choose a different vendor" step). Kept in memory only.
 */
const pending = new Set<string>();
export function requestFindVendorFocus(workOrderId: string) { pending.add(workOrderId); }
export function consumeFindVendorFocus(workOrderId: string): boolean { return pending.delete(workOrderId); }
