import { useEffect, useState } from "react";
import type { AppRole } from "@/lib/permissions";

/**
 * Read-only "View As" preview for Platform Owners.
 *
 * It never impersonates an account: the session, the audit actor and every
 * server call stay the real user. It only narrows what the UI shows and puts
 * the app in read-only mode so a preview can never change data by accident.
 */
const KEY = "resolve.view-as";
const EVENT = "resolve:view-as";

export function readViewAs(): AppRole | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(KEY);
  return (value as AppRole) || null;
}

export function setViewAs(role: AppRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.sessionStorage.setItem(KEY, role);
  else window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function useViewAs() {
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const sync = () => setRole(readViewAs());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { viewAs: role, setViewAs, clearViewAs: () => setViewAs(null) };
}
