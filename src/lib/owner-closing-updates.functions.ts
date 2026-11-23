/**
 * Owner updates after closing (Nov 22): the Owner tab read, Edit and Hold (caller-authenticated RPCs
 * in docs/pending/owner-closing-updates) and a test copy to the test inbox. Nothing here sends to an owner.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const NOT_YET = "Edit and Hold start once the Admin approves the database change.";

function friendly(e: { message?: string; code?: string } | null | undefined): never {
  if (e && (e.code === "42883" || e.code === "PGRST202" || /does not exist|could not find/i.test(e.message ?? ""))) throw new Error(NOT_YET);
  throw new Error(e?.message ?? "Something went wrong. Please try again.");
}

export const readOwnerUpdatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const { loadOwnerTabViewer } = await import("@/lib/owner-tab.server");
    const { ownerTabRights } = await import("@/lib/owner-tab");
    const viewer = await loadOwnerTabViewer(context.supabase, context.userId, data.propertyId);
    const rights = ownerTabRights(viewer);
    if (!viewer.isStaff) throw new Error("You cannot open this home's owner updates.");
    const m = await import("@/lib/owner-closing-updates.server");
    const updates = await m.readHomeUpdates(context.supabase, data.propertyId);
    return { updates, canChange: rights.sendWeekly };
  });

export const editOwnerUpdateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, subject: z.string().max(200), body: z.string().max(8000) }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc("edit_owner_closing_update" as never, { _id: data.id, _subject: data.subject, _body: data.body } as never);
    if (r.error) friendly(r.error);
    return r.data as unknown as { ok: true; cleared: boolean };
  });

export const holdOwnerUpdateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc("hold_owner_closing_update" as never, { _id: data.id } as never);
    if (r.error) friendly(r.error);
    return r.data as unknown as { ok: true; already: boolean };
  });

/** A copy of one update to the test inbox only (the home's Project Manager, the Director of Onboarding, Admin). */
export const sendOwnerUpdateTestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid, no: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).parse(d))
  .handler(async ({ context, data }) => {
    const { loadOwnerTabViewer } = await import("@/lib/owner-tab.server");
    const { ownerTabRights } = await import("@/lib/owner-tab");
    const viewer = await loadOwnerTabViewer(context.supabase, context.userId, data.propertyId);
    if (!ownerTabRights(viewer).sendWeekly) throw new Error("Only this home's Project Manager can send a test copy.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = await import("@/lib/owner-closing-updates.server");
    return m.sendTestCopy(supabaseAdmin, data.propertyId, data.no);
  });
