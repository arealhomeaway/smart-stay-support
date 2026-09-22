import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startActAsFn, endActAsFn } from "./act-as.functions";

/**
 * Client side of staff "Act as" mode.
 *
 * The staff session tokens are parked in sessionStorage so the supervisor can
 * come straight back to their own account. Session-scoped only: closing the
 * tab ends both the record and the stored tokens.
 */
export const ACT_AS_KEY = "resolve.act-as";
export const ACT_AS_EVENT = "resolve:act-as";

export type ActAsRecord = {
  /** The homeowner being acted as. */
  userId: string;
  name: string;
  /** Where the supervisor started, to return them there. */
  origin: string;
  staffAccessToken: string;
  staffRefreshToken: string;
};

export function readActAs(): ActAsRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(ACT_AS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActAsRecord;
    return parsed && typeof parsed.userId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeActAs(record: ActAsRecord | null) {
  if (typeof window === "undefined") return;
  if (record) window.sessionStorage.setItem(ACT_AS_KEY, JSON.stringify(record));
  else window.sessionStorage.removeItem(ACT_AS_KEY);
  window.dispatchEvent(new Event(ACT_AS_EVENT));
}

/** Step into the homeowner's account. Resolves once the session is theirs. */
export async function beginActAs(input: { userId: string; origin: string }) {
  const { data: current } = await supabase.auth.getSession();
  const staff = current.session;
  if (!staff) throw new Error("Your session expired — sign in again.");

  const grant = await startActAsFn({ data: { userId: input.userId } });

  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: grant.tokenHash,
  });
  if (error) throw error;

  writeActAs({
    userId: grant.userId,
    name: grant.name,
    origin: input.origin,
    staffAccessToken: staff.access_token,
    staffRefreshToken: staff.refresh_token,
  });
  return grant;
}

/** Return to the supervisor's own account. Resolves once the session is back. */
export async function endActAs(): Promise<ActAsRecord | null> {
  const record = readActAs();
  if (!record) return null;
  const { error } = await supabase.auth.setSession({
    access_token: record.staffAccessToken,
    refresh_token: record.staffRefreshToken,
  });
  writeActAs(null);
  if (error) throw error;
  try {
    await endActAsFn({ data: { userId: record.userId } });
  } catch {
    // The return itself already happened; a missing audit line must not trap
    // the supervisor in the homeowner's account.
  }
  return record;
}

export function clearActAs() {
  writeActAs(null);
}

/** The current act-as record, if any. */
export function useActAs(): ActAsRecord | null {
  const [record, setRecord] = useState<ActAsRecord | null>(null);
  useEffect(() => {
    const sync = () => setRecord(readActAs());
    sync();
    window.addEventListener(ACT_AS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACT_AS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return record;
}
