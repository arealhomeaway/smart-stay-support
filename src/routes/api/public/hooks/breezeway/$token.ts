import { createFileRoute } from "@tanstack/react-router";

/**
 * Breezeway task webhook receiver.
 *
 * The URL's last segment is a random shared secret held only in server env
 * (BREEZEWAY_WEBHOOK_PATH_TOKEN). It is compared in constant time and is never
 * logged, stored, or returned — including in error responses.
 *
 * Preview-only: deliveries are verified against the Breezeway API, filtered to
 * the approved pilot company/property, counted, and dropped. No matters,
 * assignments, messages, stage changes, or Breezeway writes happen here.
 */
export const Route = createFileRoute("/api/public/hooks/breezeway/$token")({
  server: {
    handlers: {
      GET: async () => new Response("ok", { status: 200 }),
      POST: async ({ request, params }) => {
        const { secretMatches, webhookPathToken, processBreezewayWebhook } = await import(
          "@/lib/breezeway-webhook.server"
        );

        const expected = webhookPathToken();
        if (!expected || !secretMatches(params.token ?? "", expected)) {
          return new Response("Not found", { status: 404 });
        }

        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: true, outcome: "invalid" }, { status: 200 });
        }

        try {
          const result = await processBreezewayWebhook(body);
          // Always 200: Breezeway does not need to retry anything we chose to
          // ignore, and we never reveal what was or was not in scope.
          return Response.json({ ok: true, outcome: result.outcome }, { status: 200 });
        } catch {
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
