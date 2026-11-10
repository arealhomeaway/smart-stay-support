import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * The Breezeway safety sweep (every 10 minutes while the bridge is on).
 *
 * Keeps Resolve's copy of current Breezeway work close to live for the verified homes and,
 * while the bridge is on, keeps reported issues and finished maintenance from after the start
 * line, so the bridge catches anything a webhook missed. Called only by the private scheduler
 * secret. Refuses while the bridge is off. It only ever reads from Breezeway.
 */
export const Route = createFileRoute("/api/public/hooks/breezeway-mirror")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        let limit = 10;
        try {
          const body = (await request.json()) as { limit?: unknown } | null;
          const n = Number(body?.limit);
          if (Number.isFinite(n) && n > 0) limit = Math.min(Math.trunc(n), 30);
        } catch {
          /* empty body: default batch */
        }

        const { runBreezewaySafetySweep } = await import("@/lib/breezeway-bridge.server");
        const result = await runBreezewaySafetySweep(limit);
        return Response.json(result, { status: "error" in result ? 500 : 200 });
      },
    },
  },
});
