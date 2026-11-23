import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EnrollmentReceipt } from "./active-owner-enrollment";
import type { SetupItemKind } from "./active-owner-auto-enroll";

export type ActiveOwnerSetupItemRow = {
  id: string;
  property_id: string;
  kind: SetupItemKind;
  title: string;
  detail: string | null;
  link_path: string;
  created_at: string;
};

/** Open Active Owner setup items for the signed-in teammate (their own; the Director and Admin also see the shared ones). */
export const myActiveOwnerSetupItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as never as import("@supabase/supabase-js").SupabaseClient;
    const res = await db
      .from("active_owner_setup_items" as never)
      .select("id, property_id, kind, title, detail, link_path, created_at, is_demo")
      .eq("status", "open")
      .eq("is_demo", false)
      .order("created_at");
    if (res.error && ["42P01", "PGRST205"].includes(res.error.code ?? "")) return { ready: false, rows: [] as ActiveOwnerSetupItemRow[] };
    if (res.error) throw new Error("Active Owner setup items could not be loaded.");
    return { ready: true, rows: (res.data ?? []) as unknown as ActiveOwnerSetupItemRow[] };
  });

/**
 * Add property, step 3 "Yes, Active Owner": anyone who can add a home. Runs the one automatic
 * enrollment on the server, recorded as the person who added the home. Missing details never block.
 */
export const autoEnrollFromAddProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        ownerName: z.string().trim().max(160).nullable(),
        ownerEmail: z.string().trim().max(200).nullable(),
        closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        notes: z.string().max(4000).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const actor = context.supabase as never as import("@supabase/supabase-js").SupabaseClient;
    const roles = await actor.from("user_roles").select("role").eq("user_id", context.userId);
    const list = ((roles.data ?? []) as { role: string }[]).map((r) => r.role);
    const director = await actor.rpc("is_onboarding_director" as never, { _user_id: context.userId } as never);
    const { canAddHome } = await import("./property-page");
    if (!canAddHome({ roles: list, onboardingDirector: director.data === true })) throw new Error("Only the onboarding team can add a home.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { autoEnrollHome } = await import("./active-owner-auto-enroll.server");
    const { ownerTypeMessage } = await import("./owner-type-enrollment");
    const { toOwnerTypeOutcome } = await import("./owner-type-enrollment.server");
    const outcome = await autoEnrollHome(supabaseAdmin as never, {
      propertyId: data.propertyId,
      actorId: context.userId,
      source: "add_property",
      actorClient: actor,
      overrides: { ownerName: data.ownerName, ownerEmail: data.ownerEmail, closingDate: data.closingDate, notes: data.notes },
    });
    const ok = outcome.kind !== "needs_attention" && outcome.kind !== "skipped";
    const fallback: EnrollmentReceipt = { programId: null, accountId: null, accountCreated: false, welcomeHeld: false, complete: ok, steps: [], onboardingAdded: 0, operatingAdded: 0 };
    const receipt = "receipt" in outcome && outcome.receipt ? outcome.receipt : fallback;
    const notice = outcome.kind === "enrolled" ? null : (ownerTypeMessage(toOwnerTypeOutcome(outcome))?.text ?? null);
    return { receipt: { ...receipt, complete: ok }, notice };
  });
