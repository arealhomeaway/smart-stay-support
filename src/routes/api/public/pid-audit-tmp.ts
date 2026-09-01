/** TEMPORARY read-only PID audit endpoint. Delete after the audit run. */
import { createFileRoute } from "@tanstack/react-router";

const PID = "1444658d-5f4f-80e2-8d3a-f1d8f2758cd3";

export const Route = createFileRoute("/api/public/pid-audit-tmp")({
  server: {
    handlers: {
      GET: async () => {
        const { notionFetch, queryDatabase, plainProperties } = await import("@/lib/notion.server");

        const db = await notionFetch<{ properties?: Record<string, { type: string; relation?: { database_id?: string } }> }>(
          `/databases/${PID}`,
        );
        const schema = Object.entries(db.properties ?? {}).map(([name, v]) => ({
          name,
          type: v.type,
          relationDb: v.relation?.database_id ?? null,
        }));

        const pages = await queryDatabase(PID, 500);
        const rows = pages.map((p) => plainProperties(p));

        // fill rate per field
        const fill: Record<string, number> = {};
        for (const r of rows) for (const [k, v] of Object.entries(r)) if (v) fill[k] = (fill[k] ?? 0) + 1;

        // document/media links
        const linkRe = /https?:\/\/[^\s,)]+/g;
        const hosts: Record<string, number> = {};
        const fieldsWithLinks: Record<string, number> = {};
        for (const r of rows) {
          for (const [k, v] of Object.entries(r)) {
            const m = v.match(linkRe);
            if (!m) continue;
            fieldsWithLinks[k] = (fieldsWithLinks[k] ?? 0) + m.length;
            for (const u of m) {
              try {
                hosts[new URL(u).hostname] = (hosts[new URL(u).hostname] ?? 0) + 1;
              } catch { /* ignore */ }
            }
          }
        }

        // files properties
        const fileFields = Object.entries(db.properties ?? {})
          .filter(([, v]) => v.type === "files")
          .map(([n]) => n);

        // related databases accessibility
        const relIds = [...new Set(schema.map((s) => s.relationDb).filter(Boolean) as string[])];
        const related: { id: string; ok: boolean; title: string | null; error: string | null }[] = [];
        for (const id of relIds) {
          try {
            const d = await notionFetch<{ title?: { plain_text?: string }[] }>(`/databases/${id}`);
            related.push({
              id,
              ok: true,
              title: (d.title ?? []).map((t) => t.plain_text ?? "").join("") || null,
              error: null,
            });
          } catch (e) {
            related.push({ id, ok: false, title: null, error: e instanceof Error ? e.message : "error" });
          }
        }

        return new Response(
          JSON.stringify({
            rowCount: rows.length,
            schema,
            fill,
            fileFields,
            fieldsWithLinks,
            hosts,
            related,
            ids: rows.map((r) => ({ name: r["Property"], orid: r["OwnerRez Internal ID"], orlink: r["OR Property Link"], nickname: r["Property Nickname"], status: r["Status"] })),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
