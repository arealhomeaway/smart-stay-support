/**
 * The homeowner portal's "Chat with ARHA" panel state, shared by the top bar button and the
 * portal page. Browser-only store; nothing is saved.
 */
import { useSyncExternalStore } from "react";

export type ChatHome = { propertyId: string; name: string };
type State = { open: boolean; homes: ChatHome[]; selected: string | null; canPost: boolean };

let state: State = { open: false, homes: [], selected: null, canPost: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  emit();
};

export const ownerChatPanel = {
  /** The portal page names the owner's homes; the button shows only once there are homes. */
  register(homes: ChatHome[], canPost: boolean) {
    const same = homes.length === state.homes.length && homes.every((h, i) => h.propertyId === state.homes[i]?.propertyId && h.name === state.homes[i]?.name);
    if (same && canPost === state.canPost) return;
    set({ homes, canPost, selected: homes.some((h) => h.propertyId === state.selected) ? state.selected : null });
  },
  unregister() {
    set({ open: false, homes: [], selected: null, canPost: false });
  },
  open(propertyId?: string | null) {
    set({ open: true, selected: propertyId ?? (state.homes.length === 1 ? state.homes[0]!.propertyId : state.selected) });
  },
  close() {
    set({ open: false });
  },
  select(propertyId: string | null) {
    set({ selected: propertyId });
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => state;
const serverSnapshot: State = { open: false, homes: [], selected: null, canPost: false };

export function useOwnerChatPanel(): State {
  return useSyncExternalStore(subscribe, snapshot, () => serverSnapshot);
}

/** Unread owner chat messages across the given homes. */
export function ownerUnread(rows: { property_id: string; kind: string; unread: number }[], homes: ChatHome[]): number {
  const ids = new Set(homes.map((h) => h.propertyId));
  return rows.filter((r) => r.kind === "owner" && ids.has(r.property_id)).reduce((n, r) => n + (Number(r.unread) || 0), 0);
}
