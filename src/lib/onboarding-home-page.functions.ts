/**
 * Server actions for one home's Onboarding page (Part 1). Every call runs as the signed-in
 * teammate; Add task re-checks who may add (Admin, Director of Onboarding, the home's Project
 * Manager, Designer and Utilities for their own work). The Status to stage map is staff-read,
 * Admin-written (app_settings RLS), and every save is logged.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_STATUS_STAGE_MAP, STATUS_STAGE_MAP_KEY, parseStatusStageMap } from "@/lib/onboarding-home-page";

const whose = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("you") }),
  z.object({
    kind: z.literal("role"),
    role: z.enum(["onboarding_director", "onboarding_manager", "onboarding_project_manager", "utilities", "lead_designer", "designer", "staging_team"]),
  }),
  z.object({ kind: z.literal("person"), personId: z.string().uuid() }),
  z.object({ kind: z.literal("homeowner") }),
]);

export const addStageTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        stage: z.string().min(1).max(60),
        title: z.string().trim().min(3).max(200),
        whose,
        dueOn: z.string().date().nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { loadCatchUpViewer } = await import("@/lib/plan-catch-up.functions");
    const { addStageTask } = await import("@/lib/onboarding-home-page.server");
    const { writeAudit } = await import("@/lib/audit.server");
    const viewer = await loadCatchUpViewer(context.supabase as never, context.userId, data.propertyId);
    return addStageTask(context.supabase as never, context.userId, viewer, data, async (e) => {
      await writeAudit(e);
    });
  });

export const readStatusStageMapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("app_settings").select("value, updated_at").eq("key", STATUS_STAGE_MAP_KEY).maybeSingle();
    if (error) throw new Error(error.message);
    // Until the staged seed is applied the approved defaults are what the page reads.
    return { map: data ? parseStatusStageMap(data.value) : { ...DEFAULT_STATUS_STAGE_MAP }, stored: Boolean(data) };
  });

export const saveStatusStageMapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ map: z.record(z.string().min(1).max(80), z.number().int().min(1).max(6).nullable()) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (admin.data !== true) throw new Error("Only an Admin can change which stage each Status means.");
    const prev = await context.supabase.from("app_settings").select("value").eq("key", STATUS_STAGE_MAP_KEY).maybeSingle();
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: STATUS_STAGE_MAP_KEY, value: data.map as never, updated_at: new Date().toISOString() } as never, { onConflict: "key" });
    if (error) throw new Error(error.message);
    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorId: context.userId,
      action: "onboarding_status_stage_map_saved",
      entityType: "app_settings",
      entityLabel: STATUS_STAGE_MAP_KEY,
      before: prev.data?.value ?? null,
      after: data.map,
    });
    return { ok: true };
  });
