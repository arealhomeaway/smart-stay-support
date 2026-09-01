/**
 * TEMPORARY diagnostic route — Breezeway capability probe.
 * Requires the cron secret; deleted once the audit is recorded.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bz-probe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = "b3f1c9a7-2d4e-4f8a-9c11-7e6d5a0b2c3f-probe";
        if (request.headers.get("x-probe-secret") !== secret) {
          return new Response("no", { status: 401 });
        }
        const { breezewayRequest, BreezewayError } = await import("@/lib/breezeway.server");
        const body = (await request.json().catch(() => ({}))) as {
          paths?: string[];
        };
        const out: Record<string, unknown> = {};
        for (const p of body.paths ?? []) {
          try {
            const data = await breezewayRequest<unknown>(p);
            const json = JSON.stringify(data);
            out[p] = { ok: true, sample: json.slice(0, 2500), length: json.length };
          } catch (e) {
            out[p] =
              e instanceof BreezewayError
                ? { ok: false, status: e.status, message: e.message.slice(0, 300) }
                : { ok: false, message: String(e).slice(0, 300) };
          }
        }
        return Response.json(out);
      },
    },
  },
});
