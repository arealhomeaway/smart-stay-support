/**
 * Email intake entry points shared by the public routes (server only).
 *
 * The routes stay thin so the rules below can be checked with fake messages:
 * the timed sweep accepts only the private scheduler secret, and neither the
 * sweep nor a Microsoft notification does anything while the email intake
 * switch is off.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { INTAKE_OFF_MESSAGE } from "./email-intake";
import {
  fetchMessage as fetchMailboxMessage,
  processMessage,
  readIntakeGate,
  recordSweepRun,
  syncMailbox,
  type GraphMessage,
} from "./mailbox.server";

type Db = SupabaseClient<Database>;

/**
 * True only for the scheduler: the `x-cron-secret` header must equal the app's
 * private scheduler secret or the database held scheduler token. The public
 * project key is never accepted.
 */
export async function authoriseSweep(
  headers: Headers,
  deps: { appSecret: string | undefined; verifyToken: (token: string) => Promise<boolean> },
): Promise<boolean> {
  const provided = headers.get("x-cron-secret") ?? "";
  if (provided.length < 16) return false;
  if (deps.appSecret && provided === deps.appSecret) return true;
  try {
    return await deps.verifyToken(provided);
  } catch {
    return false;
  }
}

/** One timed sweep: refused while the switch is off; otherwise renew, then read every page. */
export async function runSweep(
  db: Db,
  deps: {
    ensureSubscription: (
      db: Db,
    ) => Promise<{ ok: boolean; action: string; expiresAt?: string | undefined; error?: string | undefined }>;
  },
) {
  const gate = await readIntakeGate(db);
  if (!gate.on) return { ok: false as const, refused: true as const, error: INTAKE_OFF_MESSAGE };
  // Renews the push subscription when under 12 hours remain (or replaces an expired one).
  const subscription = await deps.ensureSubscription(db);
  const result = await syncMailbox(db, { limit: 50, paging: true });
  await recordSweepRun(db, result, subscription);
  return { ...result, refused: false as const, subscription };
}

/**
 * Microsoft change notifications. While the switch is off nothing is fetched,
 * recorded or created.
 */
export async function handleNotifications(
  db: Db,
  messageIds: string[],
  deps: { fetchMessage?: (id: string) => Promise<GraphMessage | null> } = {},
): Promise<{ refused: boolean; processed: number; message?: string }> {
  const gate = await readIntakeGate(db);
  if (!gate.on) return { refused: true, processed: 0, message: INTAKE_OFF_MESSAGE };
  const fetchOne = deps.fetchMessage ?? ((id: string) => fetchMailboxMessage(id));
  let processed = 0;
  for (const id of messageIds.slice(0, 20)) {
    try {
      const message = await fetchOne(id);
      if (!message) continue;
      await processMessage(db, message, false, gate);
      processed++;
    } catch (err) {
      console.error("Outlook notification failed:", err instanceof Error ? err.message : err);
    }
  }
  return { refused: false, processed };
}
