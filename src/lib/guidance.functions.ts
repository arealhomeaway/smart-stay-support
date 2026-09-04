/**
 * Low-noise telemetry for contextual guidance.
 *
 * One "shown" row per person per object per day, plus explicit opens. This is
 * enough to tell leadership whether guidance reaches people and which
 * scenarios have no approved Playbook — and deliberately not enough to score
 * anybody's day.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  event: z.enum(["shown", "opened", "no_guidance"]),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  playbookKey: z.string().nullable().optional(),
  playbookVersion: z.number().nullable().optional(),
});

export const recordGuidanceEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const action = `guidance_${data.event}`;

    // "shown" is passive, so collapse it to once per person, per object, per
    // day. Explicit opens are always recorded.
    if (data.event !== "opened") {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      const { data: existing } = await supabaseAdmin
        .from("audit_log")
        .select("id")
        .eq("actor_id", context.userId)
        .eq("action", action)
        .eq("entity_type", data.subjectType)
        .eq("entity_id", data.subjectId)
        .gte("created_at", since.toISOString())
        .limit(1);
      if (existing?.length) return { recorded: false };
    }

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorId: context.userId,
      action,
      entityType: data.subjectType,
      entityId: data.subjectId,
      entityLabel: data.playbookKey ?? null,
      after: data.playbookKey
        ? { playbook_key: data.playbookKey, version: data.playbookVersion ?? null }
        : null,
    });
    return { recorded: true };
  });
