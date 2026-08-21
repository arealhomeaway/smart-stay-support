import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIn, checkOut, loadVisits } from "./visits.server";

const fixSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100000),
  })
  .nullable();

export const startVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ticketId: z.string().uuid(), fix: fixSchema }).parse(data),
  )
  .handler(({ context, data }) => checkIn(context.supabase, context.userId, data.ticketId, data.fix));

export const endVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        fix: fixSchema,
        notes: z.string().max(4000).optional(),
      })
      .parse(data),
  )
  .handler(({ context, data }) =>
    checkOut(context.supabase, context.userId, { ticketId: data.ticketId, fix: data.fix, notes: data.notes ?? "" }),
  );

export const getVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ticketId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => ({
    visits: await loadVisits(context.supabase, data.ticketId),
  }));
