import { useEffect, useState } from "react";

/**
 * Deliberate "Preview as homeowner" selection for Platform Owners.
 *
 * Staff pick one existing program on the Active Owner board; the owner portal
 * then renders that program's owner/property context instead of the signed-in
 * account. Session-scoped, read-only and never impersonates the account.
 */
export type OwnerPreviewSelection = {
  programId: string;
  ownerName: string;
  demo: boolean;
  /** Staff page to return to when the preview is closed. */
  origin: string;
};

const KEY = "resolve.owner-preview";
const EVENT = "resolve:owner-preview";

export function readOwnerPreview(): OwnerPreviewSelection | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OwnerPreviewSelection;
    return parsed && typeof parsed.programId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function setOwnerPreview(selection: OwnerPreviewSelection | null) {
  if (typeof window === "undefined") return;
  if (selection) window.sessionStorage.setItem(KEY, JSON.stringify(selection));
  else window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function useOwnerPreview() {
  const [selection, setSelection] = useState<OwnerPreviewSelection | null>(null);

  useEffect(() => {
    const sync = () => setSelection(readOwnerPreview());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    ownerPreview: selection,
    setOwnerPreview,
    clearOwnerPreview: () => setOwnerPreview(null),
  };
}
