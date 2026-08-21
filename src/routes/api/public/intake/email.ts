import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().max(20000).default(""),
  from: z.string().max(320).nullish(),
  property: z.string().max(200).nullish(),
  source: z.string().max(40).nullish(),
  externalId: z.string().max(200).nullish(),
  externalUrl: z.string().url().max(2000).nullish(),
});

/**
 * Inbound message intake. An email forwarding service, OwnerRez notification
 * relay or any other tool can POST here with the shared secret and the message
 * becomes a matter in the queue.
 */
export const Route = createFileRoute("/api/public/intake/email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided = request.headers.get("x-intake-secret") ?? "";
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { createIntakeMatter } = await import("@/lib/intake.server");

        try {
          const result = await createIntakeMatter(supabaseAdmin, parsed.data);
          return Response.json(result);
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Intake failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
