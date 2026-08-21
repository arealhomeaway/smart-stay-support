import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff, dispatchVendor, loadVendors } from "./vendor.server";

export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    return { vendors: await loadVendors() };
  });

export const assignVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        vendorUserId: z.string().uuid().nullable(),
        brief: z.string().max(4000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    return dispatchVendor({
      ticketId: data.ticketId,
      vendorUserId: data.vendorUserId,
      brief: data.brief,
      dispatchedBy: context.userId,
    });
  });

export const rankVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ticketId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { rankVendorsForTicket } = await import("./vendor.server");
    return rankVendorsForTicket(data.ticketId);
  });
