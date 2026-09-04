/**
 * Notion access (server-only).
 *
 * Every call goes through the Lovable connector gateway using the workspace
 * Notion connection. Notion stays the source of truth for property master
 * information; Resolve keeps a mirror for permissions, relationships and
 * reporting. Nothing here is ever reachable from the browser.
 */

import { NOTION_SOURCES, type NotionProbe, type NotionSource } from "@/lib/notion";

const GATEWAY = "https://connector-gateway.lovable.dev/notion/v1";

export class NotionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "NotionError";
  }
}

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const notion = process.env["NOTION_API_KEY"];
  if (!lovable || !notion) {
    throw new NotionError(500, "The Notion connection is not configured for this project.");
  }
  return { lovable, notion };
}

export async function notionFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const { lovable, notion } = keys();
  const res = await fetch(`${GATEWAY}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": notion,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : null,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Notion ${path} failed [${res.status}]: ${text}`);
    throw new NotionError(res.status, friendlyError(res.status, text));
  }
  return JSON.parse(text) as T;
}

function friendlyError(status: number, body: string) {
  if (status === 404 || body.includes("object_not_found")) {
    return "Notion cannot see this page yet. Open it in Notion and add the Lovable connection under the ⋯ menu.";
  }
  if (status === 401 || status === 403) {
    return "Notion rejected the connection. Reconnect Notion in settings.";
  }
  if (status === 429) return "Notion is rate limiting us. The sync will retry shortly.";
  return `Notion request failed (${status}).`;
}

function titleOf(obj: Record<string, unknown>): string | null {
  const title = (obj as { title?: { plain_text?: string }[] }).title;
  if (Array.isArray(title))
    return (
      title
        .map((t) => t.plain_text ?? "")
        .join("")
        .trim() || null
    );
  const props = (
    obj as { properties?: Record<string, { type?: string; title?: { plain_text?: string }[] }> }
  ).properties;
  for (const value of Object.values(props ?? {})) {
    if (value?.type === "title" && Array.isArray(value.title)) {
      return (
        value.title
          .map((t) => t.plain_text ?? "")
          .join("")
          .trim() || null
      );
    }
  }
  return null;
}

/** Reads each configured source and reports whether the integration can see it. */
export async function probeNotionSources(sources: NotionSource[] = NOTION_SOURCES) {
  const probes: NotionProbe[] = [];
  for (const source of sources) {
    const base = {
      key: source.key,
      label: source.label,
      id: source.id,
      kind: source.kind,
      blurb: source.blurb,
    };
    try {
      const db = await notionFetch<{
        object: string;
        properties?: Record<string, { type: string }>;
      }>(`/databases/${source.id}`);
      probes.push({
        ...base,
        object: "database",
        title: titleOf(db as unknown as Record<string, unknown>),
        fields: Object.entries(db.properties ?? {}).map(([name, v]) => ({ name, type: v.type })),
        shared: true,
        error: null,
      });
      continue;
    } catch (dbError) {
      const dbMessage = dbError instanceof Error ? dbError.message : "Unknown error";
      try {
        const page = await notionFetch<Record<string, unknown>>(`/pages/${source.id}`);
        probes.push({
          ...base,
          object: "page",
          title: titleOf(page),
          fields: [],
          shared: true,
          error: null,
        });
      } catch {
        probes.push({
          ...base,
          object: "missing",
          title: null,
          fields: [],
          shared: false,
          error: dbMessage,
        });
      }
    }
  }
  return probes;
}

/** Pages through a Notion database and returns every row. */
export async function queryDatabase(databaseId: string, limit = 500) {
  const results: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  while (results.length < limit) {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body["start_cursor"] = cursor;
    const page = await notionFetch<{
      results: Record<string, unknown>[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/databases/${databaseId}/query`, { method: "POST", body });
    results.push(...page.results);
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return results;
}

/** Flattens a Notion page's properties into plain strings for mirroring. */
export function plainProperties(page: Record<string, unknown>) {
  const props = (page["properties"] ?? {}) as Record<string, Record<string, unknown>>;
  const flat: Record<string, string> = {};
  for (const [name, value] of Object.entries(props)) {
    flat[name] = plainValue(value) ?? "";
  }
  return flat;
}

function plainValue(value: Record<string, unknown>): string | null {
  const type = value["type"] as string | undefined;
  if (!type) return null;
  const raw = value[type];
  switch (type) {
    case "title":
    case "rich_text":
      return Array.isArray(raw)
        ? (raw as { plain_text?: string }[])
            .map((t) => t.plain_text ?? "")
            .join("")
            .trim()
        : null;
    case "select":
      return (raw as { name?: string } | null)?.name ?? null;
    case "status":
      return (raw as { name?: string } | null)?.name ?? null;
    case "multi_select":
      return Array.isArray(raw)
        ? (raw as { name?: string }[]).map((o) => o.name ?? "").join(", ")
        : null;
    case "people":
      return Array.isArray(raw)
        ? (raw as { name?: string }[]).map((p) => p.name ?? "").join(", ")
        : null;
    case "date":
      return (raw as { start?: string } | null)?.start ?? null;
    case "checkbox":
      return raw ? "true" : "false";
    case "number":
      return raw == null ? null : String(raw);
    case "url":
    case "email":
    case "phone_number":
      return (raw as string | null) ?? null;
    case "formula": {
      const f = raw as Record<string, unknown> | null;
      if (!f) return null;
      const inner = f[(f["type"] as string) ?? ""];
      return inner == null ? null : String(inner);
    }
    case "rollup": {
      const r = raw as { array?: Record<string, unknown>[] } | null;
      if (!r?.array) return null;
      return r.array
        .map((item) => plainValue(item) ?? "")
        .filter(Boolean)
        .join(", ");
    }
    default:
      return null;
  }
}
