import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** A vendor's own private scorecard. Vendors only ever get their own numbers. */
export const myScorecard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadVendorScorecard } = await import("./scorecard.server");
    return loadVendorScorecard(context.userId);
  });

/** Staff-only: named scoreboard across all vendors. */
export const vendorScoreboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadVendorScoreboard } = await import("./scorecard.server");
    await assertStaff(context.supabase, context.userId);
    return loadVendorScoreboard();
  });

export const getJobRating = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ticketId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadJobRating } = await import("./scorecard.server");
    await assertStaff(context.supabase, context.userId);
    return { rating: await loadJobRating(data.ticketId) };
  });

export const rateJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        thoroughness: z.number().int().min(1).max(5),
        communication: z.number().int().min(1).max(5),
        timeliness: z.number().int().min(1).max(5),
        photosComplete: z.boolean(),
        onTime: z.boolean(),
        reopened: z.boolean(),
        note: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("./vendor.server");
    const { rateVendorJob } = await import("./scorecard.server");
    await assertStaff(context.supabase, context.userId);
    return rateVendorJob({
      ticketId: data.ticketId,
      ratedBy: context.userId,
      rating: {
        thoroughness: data.thoroughness,
        communication: data.communication,
        timeliness: data.timeliness,
        photosComplete: data.photosComplete,
        onTime: data.onTime,
        reopened: data.reopened,
      },
      note: data.note?.trim() ? data.note.trim() : null,
    });
  });
