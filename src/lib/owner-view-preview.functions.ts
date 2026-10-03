import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ownerPreviewBuckets } from "./owner-view-preview";

/**
 * Owner view preview for one onboarding property. Read-only, staff-only:
 * applies the same rules the homeowner portal uses (published approvals,
 * non-draft ARHA Opportunities) — never impersonates an owner and never
 * reads another property.
 */
export const ownerViewPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { onboardingTaskAccess } = await import("./onboarding-task-access.server");
    await onboardingTaskAccess(context.supabase, context.userId, data.propertyId, null);
    const sb = context.supabase;
    const [items, pubs] = await Promise.all([
      sb
        .from("work_items")
        .select("id, title, owner_content, status, source, source_task_id, retired_at, due_on, program_id")
        .eq("property_id", data.propertyId)
        .eq("kind", "opportunity")
        .neq("status", "archived")
        .is("retired_at", null),
      sb
        .from("owner_approval_publications")
        .select("id, title, detail, entity_id, due_on, reviewed_at")
        .eq("property_id", data.propertyId),
    ]);
    if (items.error) throw items.error;
    if (pubs.error) throw pubs.error;
    // Owners only read Opportunities in a live (non-archived) program they own.
    const programIds = [...new Set((items.data ?? []).map((i) => i.program_id).filter(Boolean))] as string[];
    const live = new Set<string>();
    if (programIds.length) {
      const progs = await sb.from("owner_programs").select("id, owner_user_id, archived_at").in("id", programIds);
      if (progs.error) throw progs.error;
      for (const p of progs.data ?? []) if (!p.archived_at && p.owner_user_id) live.add(p.id);
    }
    const scoped = (items.data ?? []).map((i) => ({ ...i, program_id: i.program_id && live.has(i.program_id) ? i.program_id : null }));
    return ownerPreviewBuckets(scoped, pubs.data ?? []);
  });
