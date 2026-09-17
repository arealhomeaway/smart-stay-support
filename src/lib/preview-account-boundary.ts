import { VIEW_AS_EVENT, VIEW_AS_KEY } from "@/hooks/useViewAs";
import { OWNER_PREVIEW_EVENT, OWNER_PREVIEW_KEY } from "./owner-preview";
import { DEMO_FLAG_EVENT, DEMO_FLAG_KEY, PREVIEW_SEAT_EVENT, PREVIEW_SEAT_KEY } from "./demo-mode";

const ACCOUNT_KEY = "resolve.preview-account";
type PreviewStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Legacy unbound selections are cleared; never infer which account selected them. */
export function bindPreviewAccount(storage: PreviewStorage, userId: string | null): boolean {
  if (userId !== null && storage.getItem(ACCOUNT_KEY) === userId) return false;
  for (const key of [VIEW_AS_KEY, OWNER_PREVIEW_KEY, DEMO_FLAG_KEY, PREVIEW_SEAT_KEY]) {
    storage.removeItem(key);
  }
  if (userId) storage.setItem(ACCOUNT_KEY, userId);
  else storage.removeItem(ACCOUNT_KEY);
  return true;
}

export function syncPreviewAccount(userId: string | null) {
  if (typeof window === "undefined") return;
  if (!bindPreviewAccount(window.sessionStorage, userId)) return;
  for (const event of [VIEW_AS_EVENT, OWNER_PREVIEW_EVENT, DEMO_FLAG_EVENT, PREVIEW_SEAT_EVENT]) {
    window.dispatchEvent(new Event(event));
  }
}
