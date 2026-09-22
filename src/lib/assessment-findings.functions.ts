import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAssessmentFindings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { loadFindings } = await import("./assessment-findings.server");
    return loadFindings(context.supabase, context.userId, data.propertyId);
  });

export const recordAssessmentFindingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        sourceTaskId: z.string().uuid().nullable().default(null),
        context: z.enum(["new_house_setup", "pre_work", "standard_assessment"]),
        category: z.enum([
          "missing_item",
          "damage",
          "plumbing",
          "electrical",
          "appliance",
          "hvac",
          "maintenance",
          "supplies",
          "inventory",
          "other",
        ]),
        title: z.string().trim().min(3).max(160),
        detail: z.string().trim().max(2000).nullable().default(null),
        location: z.string().trim().max(120).nullable().default(null),
        severity: z.enum(["urgent", "normal", "minor"]),
        photoUrl: z.string().trim().url().max(2000).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { recordFinding } = await import("./assessment-findings.server");
    return recordFinding(context.supabase, context.userId, data);
  });

export const setFindingStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        findingId: z.string().uuid(),
        status: z.enum(["open", "corrected", "dismissed"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setFindingStatus } = await import("./assessment-findings.server");
    return setFindingStatus(context.supabase, context.userId, data);
  });
