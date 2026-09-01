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
          scanHomes?: number[];
        };
        const out: Record<string, unknown> = {};
        if (body.op === "people") {
          const mod = await import("@/lib/breezeway-people.server");
          out["people:sync"] = await mod.syncBreezewayPeople();
          out["people:audit"] = await mod.breezewayPeopleAudit();
        }
        if (body.op === "photos") {
          const mod = await import("@/lib/breezeway-workorders.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("breezeway_work_orders")
            .select("id, name, photo_count")
            .gt("photo_count", 0)
            .limit(body.limit ?? 5);
          const results: unknown[] = [];
          for (const wo of (data ?? []) as { id: string; name: string | null }[]) {
            results.push({ name: wo.name, ...(await mod.syncWorkOrderPhotos(wo.id)) });
          }
          out["photos"] = results;
        }
        for (const home of body.scanHomes ?? []) {
          try {
            const data = await breezewayRequest<{ results?: { id: number; photos?: unknown[] }[] }>(
              "/task/",
              { params: { home_id: home, limit: 100 } },
            );
            const withPhotos = (data.results ?? []).filter(
              (t) => Array.isArray(t.photos) && t.photos.length > 0,
            );
            out[`scan:${home}`] = {
              total: (data.results ?? []).length,
              withPhotos: withPhotos.length,
              sample: JSON.stringify(withPhotos[0]?.photos?.slice(0, 2) ?? []).slice(0, 1500),
              taskId: withPhotos[0]?.id ?? null,
            };
          } catch (e) {
            out[`scan:${home}`] = { error: String(e).slice(0, 200) };
          }
        }
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
