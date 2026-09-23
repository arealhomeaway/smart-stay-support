/** Homeowner email wording RPCs. Reading is onboarding staff; saving is the director. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COPY = z.object({
  subject: z.string().max(200),
  greeting: z.string().max(200),
  intro: z.string().max(800),
  closing: z.string().max(600),
  actionLabel: z.string().max(80),
});

export const readOwnerEmailCopyFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readOwnerEmailCopySettings } = await import("./owner-email-copy.server");
    return readOwnerEmailCopySettings(context.supabase, context.userId);
  });

export const saveOwnerEmailCopyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ dispatch: COPY, alert: COPY }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveOwnerEmailCopySettings } = await import("./owner-email-copy.server");
    return saveOwnerEmailCopySettings(context.supabase, context.userId, data);
  });
