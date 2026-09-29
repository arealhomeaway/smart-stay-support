import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly STR cleaner-hours reconciliation (called by the scheduler around
 * 2 a.m. Central, a few times so the work is split into small resumable
 * slices). Reads from Breezeway only; covers only properties designated for
 * STR cleaner-hours tracking. Once tonight's run is complete, calls are no-ops.
 */
export const Route = createFileRoute("/api/public/hooks/cleaner-hours-reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Only a private scheduler key is accepted — never the public app key.
        // Either the app's LOVABLE_CRON_SECRET, or the database-held scheduler
        // token (checked by a service-role-only function).
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (provided.length < 32) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        const { timingSafeEqual } = await import("crypto");
        const expected = process.env["LOVABLE_CRON_SECRET"] ?? "";
        let ok = false;
        if (expected) {
          const a = Buffer.from(provided);
          const b = Buffer.from(expected);
          ok = a.length === b.length && timingSafeEqual(a, b);
        }
        if (!ok) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.rpc("cleaner_verify_cron_token", { _token: provided });
          ok = data === true;
        }
        if (!ok) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        try {
          const { runReconcileSlice } = await import("@/lib/cleaner-hours.server");
          return Response.json({ ok: true, ...(await runReconcileSlice()) });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Reconciliation failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
