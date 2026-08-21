import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Staff-only: every active home with its quarterly review status. */
export const quarterlyReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadQuarterlyReviews } = await import("./quarterly.server");
    await assertStaff(context.supabase, context.userId);
    return loadQuarterlyReviews(context.supabase);
  });

/** Staff-only: open the quarterly review ticket for one home. */
export const startQuarterlyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("./vendor.server");
    const { openQuarterlyReview } = await import("./quarterly.server");
    await assertStaff(context.supabase, context.userId);
    return openQuarterlyReview(context.supabase, context.userId, data.propertyId);
  });

/** Staff-only: open reviews for every home that is due or overdue. */
export const startDueQuarterlyReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./vendor.server");
    const { openDueQuarterlyReviews } = await import("./quarterly.server");
    await assertStaff(context.supabase, context.userId);
    return openDueQuarterlyReviews(context.supabase, context.userId);
  });
