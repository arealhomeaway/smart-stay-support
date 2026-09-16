import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStageCaptures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { loadStageCapturesForActor } = await import("./onboarding-stage.server");
    return loadStageCapturesForActor(context.supabase, context.userId, data.propertyId);
  });

export const saveStageCaptureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        stage: z.string().max(60),
        expectedRevision: z.number().int().min(0),
        action: z.enum(["save", "submit", "approve", "return", "reopen"]),
        observation: z.string().trim().max(6000),
        evidenceIds: z.array(z.string().uuid()).max(50),
        reason: z.string().trim().max(1000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveStageCapture } = await import("./onboarding-stage.server");
    return saveStageCapture(context.supabase, context.userId, data);
  });
