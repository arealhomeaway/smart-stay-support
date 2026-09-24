import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Leadership: the whole Active Owner program on one screen.
 *
 * Separate from the program admin function so the access rule and the audit
 * entry for program-wide reads live in one place.
 */
export const ownerOversight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ demo: z.boolean().optional() })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { requireLeadership, recordOversightAccess } = await import("./oversight-access.server");
    const { loadPrograms } = await import("./owner-program.server");
    const role = await requireLeadership(
      context.supabase,
      context.userId,
      "Active Owner program oversight",
      { allowOnboardingDirector: true },
    );
    const result = await loadPrograms(context.supabase, data?.demo === true);
    await recordOversightAccess({
      actorId: context.userId,
      role,
      action: "oversight_viewed",
      entityType: "owner_program_oversight",
      recordCount: result.rows.length,
    });
    return result;
  });

/** Read the alert thresholds for the oversight screen. */
export const oversightAlertConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireLeadership } = await import("./oversight-access.server");
    await requireLeadership(context.supabase, context.userId, "Active Owner program oversight");
    const { loadAlertConfig } = await import("./oversight-settings.server");
    return loadAlertConfig(context.supabase);
  });

/** Change the alert thresholds. Recorded in the audit trail. */
export const setOversightAlertConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        behindHours: z.number(),
        checkinOverdueDays: z.number(),
        ownerItemDays: z.number(),
        behindEnabled: z.boolean(),
        checkinEnabled: z.boolean(),
        ownerItemsEnabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { requireLeadership } = await import("./oversight-access.server");
    const role = await requireLeadership(
      context.supabase,
      context.userId,
      "Active Owner alert settings",
    );
    const { saveAlertConfig } = await import("./oversight-settings.server");
    return saveAlertConfig(context.supabase, context.userId, role, data);
  });

/** Who has read program-wide homeowner data, and when. */
export const oversightAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        actor: z.string().optional(),
        role: z.string().optional(),
        target: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { requireLeadership, recordOversightAccess } = await import("./oversight-access.server");
    const role = await requireLeadership(
      context.supabase,
      context.userId,
      "The oversight access log",
    );
    const { loadAccessLog } = await import("./oversight-settings.server");
    const rows = await loadAccessLog(data ?? {});
    await recordOversightAccess({
      actorId: context.userId,
      role,
      action: "oversight_access_log_viewed",
      entityType: "oversight_access_log",
      recordCount: rows.length,
    });
    return rows;
  });
