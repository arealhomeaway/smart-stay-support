import { compareArhaPriority } from "./v2-workflow.functions";
import type { OwnerTabItem } from "./onboarding-cleanup";
export type OrderedOpportunity = { id: string; source: string | null; status: string; owner_priority: number | null; sent_at: string | null; created_at: string };
export function sentStaffOrder<T extends OrderedOpportunity>(opps: T[]): T[] {
  return opps.filter(o => o.source === "arha" && !["draft", "complete", "archived"].includes(o.status)).sort(compareArhaPriority);
}
export function savedWaitingOrder(items: OwnerTabItem[], allStaffIds: string[]): OwnerTabItem[] {
  const byId = new Map(items.filter(i => i.kind === "request").map(i => [i.id, i]));
  const staff = allStaffIds.flatMap(id => { const item = byId.get(id); return item ? [item] : []; });
  const ids = new Set(staff.map(i => i.id));
  return [...staff, ...items.filter(i => i.kind !== "request" || !ids.has(i.id))];
}
export function moveWaiting(ids: string[], from: number, to: number): string[] {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
  const next = [...ids], [id] = next.splice(from, 1);
  if (id === undefined) return ids;
  next.splice(to, 0, id); return next;
}
/** Preserve nonwaiting staff slots while sending the complete canonical order once. */
export function mergeWaitingOrder(all: string[], waiting: string[]): string[] {
  const selected = new Set(waiting); let index = 0;
  return all.map(id => selected.has(id) ? waiting[index++] ?? id : id);
}
export class WaitingOrderDraft {
  ids: string[];
  constructor(private saved: string[], private writable: boolean) { this.ids = [...saved]; }
  move(from: number, to: number) { if (this.writable) this.ids = moveWaiting(this.ids, from, to); }
  cancel() { this.ids = [...this.saved]; }
  async save(all: string[], persist: (ids: string[]) => Promise<unknown>) {
    if (!this.writable) throw new Error("You do not have permission to reorder Opportunities.");
    const full = mergeWaitingOrder(all, this.ids);
    if (new Set(full).size !== full.length || this.ids.some(id => !all.includes(id))) throw new Error("This list has changed. Cancel and reopen Reorder.");
    await persist(full); this.saved = [...this.ids]; return full;
  }
}