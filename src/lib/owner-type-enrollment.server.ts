import type { SupabaseClient } from "@supabase/supabase-js";
import { ownerTypeTurnsOnActiveOwner, type OwnerTypeOutcome } from "./owner-type-enrollment";
import type { AutoEnrollDeps, AutoEnrollOutcome } from "./active-owner-auto-enroll.server";

import { MODULE_FROM_OWNER_TYPE } from "./active-owner-auto-enroll";

/** Reason recorded in History when Owner Type turns the Active Owner module on. */
export const OWNER_TYPE_MODULE_REASON = MODULE_FROM_OWNER_TYPE;

/** Replaceable only in tests. */
export type OwnerTypeDeps = { db?: SupabaseClient; auto?: AutoEnrollDeps };

export function toOwnerTypeOutcome(o: AutoEnrollOutcome): OwnerTypeOutcome {
  switch (o.kind) {
    case "enrolled": return { kind: "enrolled", email: o.email, welcomeHeld: o.welcomeHeld };
    case "enrolled_no_email": return { kind: "enrolled_no_email" };
    case "waiting_closing": return { kind: "waiting_closing" };
    case "already_enrolled": return { kind: "already_enrolled" };
    case "skipped": return { kind: "needs_attention", detail: "This home is not open for Active Owner setup." };
    case "needs_attention": return { kind: "needs_attention", detail: o.detail };
  }
}

/**
 * Owner Type changed to "Active Owner", by anyone: enroll the home fully through the one
 * automatic path, recorded as the person who saved. Never creates a second program and never
 * removes anything. Every problem is returned as an outcome and flagged; the Owner Type save
 * itself has already succeeded.
 */
export async function enrollForOwnerType(
  actor: SupabaseClient,
  userId: string,
  input: { projectId: string; before: string | null | undefined; after: string | null | undefined },
  deps: OwnerTypeDeps = {},
): Promise<OwnerTypeOutcome | null> {
  if (!ownerTypeTurnsOnActiveOwner(input.before, input.after)) return null;
  try {
    const db = deps.db ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const project = await db.from("onboarding_projects").select("property_id").eq("id", input.projectId).maybeSingle();
    const propertyId = (project.data as { property_id: string } | null)?.property_id;
    if (!propertyId) return { kind: "needs_attention", detail: "This home's project could not be read." };
    const { autoEnrollHome } = await import("./active-owner-auto-enroll.server");
    const outcome = await autoEnrollHome(db, { propertyId, actorId: userId, source: "owner_type", actorClient: actor }, deps.auto);
    return toOwnerTypeOutcome(outcome);
  } catch (e) {
    return { kind: "needs_attention", detail: e instanceof Error ? e.message : "Active Owner setup will try again shortly." };
  }
}

/** Owner Type before a save, so only a real change to Active Owner enrolls. */
export async function readOwnerType(actor: SupabaseClient, projectId: string) {
  const r = await actor.from("onboarding_projects").select("owner_type").eq("id", projectId).maybeSingle();
  return (r.data?.owner_type as string | null | undefined) ?? null;
}
