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

/** Staff-only: the markets and the regional cleaning manager who inspects each. */
export const cleaningRegions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadCleaningRegions } = await import("./quarterly.server");
    await assertStaff(context.supabase, context.userId);
    const { loadTeamAccess } = await import("./access.server");
    const [regions, team] = await Promise.all([
      loadCleaningRegions(context.supabase),
      loadTeamAccess(),
    ]);
    const staff = team
      .filter((m) => m.roles.some((r) => r === "admin" || r === "manager" || r === "tech"))
      .map((m) => ({ id: m.id, name: m.full_name ?? m.email ?? "Teammate" }));
    return { regions, staff };
  });

/** Supervisor-only: set the regional cleaning manager for a market. */
export const assignCleaningManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ market: z.string().min(1), managerId: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setCleaningRegionManager } = await import("./quarterly.server");
    return setCleaningRegionManager(context.supabase, data.market, data.managerId);
  });
