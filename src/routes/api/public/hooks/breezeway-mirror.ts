import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * The Breezeway safety sweep, scheduled every 10 minutes.
 *
 * Every run refreshes Resolve's copy of current Breezeway work for the verified homes and the
 * people directory, whatever the bridge switch says, as the published Nov 6 refresh did. While
 * the bridge is on it also keeps reported issues and finished maintenance from after the start
 * line; only then can the database make tickets and reviews. Called only by the private
 * scheduler secret. It only ever reads from Breezeway.
 */
export const Route = createFileRoute("/api/public/hooks/breezeway-mirror")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { runBreezewaySafetySweep, SWEEP_DEFAULT_HOMES, SWEEP_MAX_HOMES } = await import("@/lib/breezeway-bridge.server");
        let limit = SWEEP_DEFAULT_HOMES;
        try {
          const body = (await request.json()) as { limit?: unknown } | null;
          const n = Number(body?.limit);
          if (Number.isFinite(n) && n > 0) limit = Math.min(Math.trunc(n), SWEEP_MAX_HOMES);
        } catch {
          /* empty body: default batch */
        }

        const result = await runBreezewaySafetySweep(limit);
        return Response.json(result, { status: "error" in result ? 500 : 200 });
      },
    },
  },
});
