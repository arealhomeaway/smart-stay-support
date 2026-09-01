import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled Breezeway mirror refresh.
 *
 * Keeps Resolve's copy of current Breezeway work — work orders, their photos
 * and the people directory — close to live for the verified portfolio, so a
 * coordinator opening a home does not have to wait on a cold read. Webhooks
 * still do the fast, per-task updating; this sweep catches anything a webhook
 * missed. It only ever reads from Breezeway.
 */
export const Route = createFileRoute("/api/public/hooks/breezeway-mirror")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || token !== expected) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? "20") || 20, 60);

        try {
          const people = await (await import("@/lib/breezeway-people.server")).syncBreezewayPeople();
          const wos = await import("@/lib/breezeway-workorders.server");
          const mirror = await wos.syncVerifiedPortfolio(limit);
          return Response.json({ ok: true, people, mirror });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Mirror refresh failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
