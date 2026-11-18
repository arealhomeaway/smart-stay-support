/** Save calls for homeowner reopen (Nov 18); the rules are in homeowner-reopen.ts. */
import { supabase } from "@/integrations/supabase/client";
import { isMissingDbObject } from "@/lib/ao-ui";
import { REOPEN_COPY } from "@/lib/homeowner-reopen";

const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

function fail(error: unknown): never {
  if (isMissingDbObject(error)) throw new Error(REOPEN_COPY.notOn);
  throw new Error((error as { message?: string })?.message || "Not saved. Try again.");
}

/** Edit or Add more on her own hours entry. Returns the new entry id; the original is kept. */
export async function saveHoursChange(
  entryId: string,
  change: { mode: "edit" | "add"; activity?: string; entryDate?: string; minutes?: number; note?: string; addPaths?: string[] },
): Promise<string> {
  const r = await db.rpc("owner_update_time_entry", { _entry_id: entryId, _change: change });
  if (r.error) fail(r.error);
  return r.data as string;
}

/** Add more on a finished (or open) Opportunity. A finished one opens again. */
export async function addToOpportunity(workItemId: string, body: string): Promise<string> {
  const r = await db.rpc("owner_add_to_opportunity", { _id: workItemId, _body: body });
  if (r.error) fail(r.error);
  return r.data as string;
}

/** Add more on an owner item she already answered (or any item she can write in). */
export async function addToOwnerItem(reviewId: string, body: string): Promise<string> {
  const r = await db.rpc("owner_item_add", { _review_id: reviewId, _body: body });
  if (r.error) fail(r.error);
  return r.data as string;
}
