/**
 * Server functions for the Breezeway sync review board and document cleanup.
 *
 * Reading is staff-only; settling a difference or retiring a document is
 * supervisor-only. The UI gate is cosmetic — this is the real boundary.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertStaff(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Resolve staff can open the sync review.");
}

async function assertSupervisor(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("is_supervisor", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only supervisors can settle a difference.");
}

function uuid(value: unknown): string {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid record reference.");
  return id;
}

/** Everything the review board shows: unplaced updates, drift, held differences. */
export const syncReviewBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { listUnplacedEvents, detectAllDrift, listOpenConflicts } = await import(
      "@/lib/sync-review.server"
    );
    const [events, drift, conflicts] = await Promise.all([
      listUnplacedEvents(),
      detectAllDrift(),
      listOpenConflicts(),
    ]);
    return { events, drift, conflicts };
  });

/** Records today's drift as held differences. Never duplicates an existing one. */
export const syncReviewHoldDrift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSupervisor(context.supabase, context.userId);
    const { holdCurrentDrift } = await import("@/lib/sync-review.server");
    return holdCurrentDrift();
  });

/** Records a person's decision on one held difference. */
export const syncReviewSettleConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conflictId: string; chosenSource: string; note: string }) => {
    const chosenSource = input?.chosenSource === "breezeway" ? "breezeway" : "resolve";
    const note = String(input?.note ?? "").trim();
    if (note.length < 5) throw new Error("Say in a line why you chose that value.");
    return { conflictId: uuid(input?.conflictId), chosenSource, note } as const;
  })
  .handler(async ({ data, context }) => {
    await assertSupervisor(context.supabase, context.userId);
    const { settleConflict } = await import("@/lib/sync-review.server");
    return settleConflict({ ...data, userId: context.userId });
  });

/** Vendor paperwork completeness plus the leftovers that can be retired. */
export const documentCompletionBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { vendorDocumentCompletion, listRetirableDocuments } = await import(
      "@/lib/document-completion.server"
    );
    const [vendors, retirable] = await Promise.all([
      vendorDocumentCompletion(),
      listRetirableDocuments(),
    ]);
    return { vendors, retirable };
  });

/** Archives one leftover document — readable, out of the way, never deleted. */
export const documentRetire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; note?: string }) => ({
    documentId: uuid(input?.documentId),
    note: String(input?.note ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    await assertSupervisor(context.supabase, context.userId);
    const { retireDocument } = await import("@/lib/document-completion.server");
    return retireDocument({ ...data, userId: context.userId });
  });
