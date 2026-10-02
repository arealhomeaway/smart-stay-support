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
        .select("id, title, owner_content, status, source, source_task_id, retired_at, due_on")
        .eq("property_id", data.propertyId)
        .eq("kind", "opportunity")
        .is("retired_at", null),
      sb
        .from("owner_approval_publications")
        .select("id, title, detail, entity_id, due_on, reviewed_at")
        .eq("property_id", data.propertyId),
    ]);
    if (items.error) throw items.error;
    if (pubs.error) throw pubs.error;
    return ownerPreviewBuckets(items.data ?? [], pubs.data ?? []);
  });
