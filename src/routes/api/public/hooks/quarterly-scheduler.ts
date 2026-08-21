import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly pass that opens quarterly inspections as their dates arrive and
 * assigns each one to the regional cleaning manager for that market.
 */
export const Route = createFileRoute("/api/public/hooks/quarterly-scheduler")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || token !== expected) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { autoScheduleDueReviews } = await import("@/lib/quarterly.server");

        try {
          const result = await autoScheduleDueReviews(supabaseAdmin);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Scheduling failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
