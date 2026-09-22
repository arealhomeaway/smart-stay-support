import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Begin a staff test session as an Active Owner. Supervisors only. */
export const startActAsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { startActAs } = await import("./act-as.server");
    return startActAs(context.supabase, context.userId, data.userId);
  });

/** Record the return to the staff account (called after the session is restored). */
export const endActAsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { endActAs } = await import("./act-as.server");
    return endActAs(context.supabase, context.userId, data.userId);
  });
