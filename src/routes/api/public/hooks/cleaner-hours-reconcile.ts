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
        // Only the private scheduler secret is accepted — never the public app key.
        const expected = process.env["LOVABLE_CRON_SECRET"] ?? "";
        const provided = request.headers.get("x-cron-secret") ?? "";
        const { timingSafeEqual } = await import("crypto");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
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
