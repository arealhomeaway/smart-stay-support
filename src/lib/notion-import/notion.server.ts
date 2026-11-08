/**
 * Read-only Notion access for the ticket import. Only GET requests and the
 * read-only data source query (a POST that reads) are ever sent. Calls are
 * spaced to respect Notion's rate limit (about 3 a second) and retried with
 * backoff on 429, timeouts, server errors and dropped connections.
 */
import { CLOSED_NOTION_STATUSES, NOTION_TICKET_DATA_SOURCE_ID, type ImportGroup, type NotionPage } from "./mapping";
import { NOTION_ATTEMPTS, isRetryableStatus, retryDelayMs } from "./runner";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";
const MIN_GAP_MS = 350;
let lastCall = 0;

export class NotionError extends Error {
  constructor(public status: number | null, public body: string) {
    super(`Notion request failed${status ? ` [${status}]` : ""}: ${body.slice(0, 300)}`);
  }
}

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const notion = process.env["NOTION_API_KEY"];
  if (!lovable) throw new NotionError(null, "LOVABLE_API_KEY is not configured");
  if (!notion) throw new NotionError(null, "The Notion connection is not linked (NOTION_API_KEY missing)");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": notion,
    "Notion-Version": "2025-09-03",
    "Content-Type": "application/json",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function notion<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const method = init?.method ?? "GET";
  // Only the data source query is allowed as POST; it reads, it never writes.
  if (method === "POST" && !/^\/data_sources\/[^/]+\/query$/.test(path)) {
    throw new Error("The import only reads from Notion");
  }
  let last: NotionError | null = null;
  for (let attempt = 0; attempt < NOTION_ATTEMPTS; attempt++) {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    let res: Response;
    try {
      res = await fetch(`${GATEWAY_URL}${path}`, {
        method,
        headers: headers(),
        ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      });
    } catch (e) {
      if (e instanceof NotionError) throw e;
      last = new NotionError(null, e instanceof Error ? e.message : String(e));
      await sleep(retryDelayMs(attempt, null));
      continue;
    }
    if (isRetryableStatus(res.status)) {
      last = new NotionError(res.status, await res.text().catch(() => ""));
      await sleep(retryDelayMs(attempt, res.headers.get("retry-after")));
      continue;
    }
    if (!res.ok) throw new NotionError(res.status, await res.text().catch(() => ""));
    return (await res.json()) as T;
  }
  throw last ?? new NotionError(429, "Notion kept rate limiting");
}

const openFilter = {
  and: CLOSED_NOTION_STATUSES.map((s) => ({ property: "Issue Status", status: { does_not_equal: s } })),
};

/** Narrows the Notion query to one group. The mapping rules still decide; this only saves reads. */
export function groupFilter(group: ImportGroup | null, cutoffIso: string) {
  const day = cutoffIso.slice(0, 10);
  if (group === "closed") return { or: CLOSED_NOTION_STATUSES.map((s) => ({ property: "Issue Status", status: { equals: s } })) };
  if (group === "recent_open") return { and: [...openFilter.and, { property: "Created Date", date: { on_or_after: day } }] };
  if (group === "older_open")
    return {
      and: [
        ...openFilter.and,
        { or: [{ property: "Created Date", date: { before: day } }, { property: "Created Date", date: { is_empty: true } }] },
      ],
    };
  return undefined;
}

export type TicketPageResult = { results: NotionPage[]; has_more: boolean; next_cursor: string | null };

export async function queryTicketPage(opts: { cursor: string | null; pageSize: number; group: ImportGroup | null; cutoffIso: string }) {
  const filter = groupFilter(opts.group, opts.cutoffIso);
  return notion<TicketPageResult>(`/data_sources/${NOTION_TICKET_DATA_SOURCE_ID}/query`, {
    method: "POST",
    body: {
      page_size: opts.pageSize,
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
      ...(filter ? { filter } : {}),
      ...(opts.cursor ? { start_cursor: opts.cursor } : {}),
    },
  });
}

/** True when Notion refused a saved cursor (it has expired); the job restarts that group safely. */
export function isBadCursor(e: unknown): boolean {
  return e instanceof NotionError && e.status === 400 && /start_cursor/i.test(e.body);
}

const pidCache = new Map<string, { ownerRez: string | null; label: string | null }>();
/** The OwnerRez ID written on a Notion PID home page. */
export async function pidOwnerRez(pageId: string) {
  const hit = pidCache.get(pageId);
  if (hit) return hit;
  const page = await notion<NotionPage>(`/pages/${pageId}`);
  let ownerRez: string | null = null;
  let label: string | null = null;
  for (const [name, p] of Object.entries(page.properties)) {
    const v = readAny(p as unknown as Record<string, unknown> & { type: string });
    if (p.type === "title") label = v;
    if (/ownerrez/i.test(name) && /id/i.test(name) && v && !ownerRez) ownerRez = v;
  }
  const out = { ownerRez, label };
  pidCache.set(pageId, out);
  return out;
}
/** Seeds the home cache from the saved run state so a new server instance does not reread every home. */
export function seedPidCache(entries: Record<string, { ownerRez: string | null; label: string | null }>) {
  for (const [k, v] of Object.entries(entries)) if (!pidCache.has(k)) pidCache.set(k, v);
}
export function pidCacheSnapshot(): Record<string, { ownerRez: string | null; label: string | null }> {
  return Object.fromEntries(pidCache);
}

function readAny(p: Record<string, unknown> & { type: string }): string | null {
  const v = p[p.type] as unknown;
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map((t) => (t as { plain_text?: string }).plain_text ?? "").join("").trim() || null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o["string"] === "string") return o["string"];
    if (typeof o["number"] === "number") return String(o["number"]);
    if (typeof o["name"] === "string") return o["name"];
  }
  return null;
}

const userCache = new Map<string, string | null>();
export async function notionUserName(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  if (userCache.has(id)) return userCache.get(id)!;
  let name: string | null = null;
  try {
    name = (await notion<{ name?: string }>(`/users/${id}`)).name ?? null;
  } catch {
    name = null;
  }
  userCache.set(id, name);
  return name;
}

export type NotionComment = {
  id: string;
  created_time: string;
  created_by?: { id?: string; name?: string };
  display_name?: { resolved_name?: string };
  rich_text?: unknown;
  attachments?: { category?: string; file?: { url: string }; name?: string }[];
};

export async function listComments(pageId: string, limit = Infinity): Promise<NotionComment[]> {
  const out: NotionComment[] = [];
  let cursor: string | null = null;
  do {
    const q = new URLSearchParams({ block_id: pageId, page_size: String(Math.min(100, limit)) });
    if (cursor) q.set("start_cursor", cursor);
    const r = await notion<{ results: NotionComment[]; has_more: boolean; next_cursor: string | null }>(`/comments?${q}`);
    out.push(...r.results);
    cursor = r.has_more && out.length < limit ? r.next_cursor : null;
  } while (cursor);
  return out;
}

export type NotionFile = { key: string; url: string; name: string; kind: "photo" | "file" };
type Block = { id: string; type: string; has_children?: boolean } & Record<string, unknown>;

/** Notion-hosted files in the page body plus a plain text copy of the body. */
export async function pageBody(pageId: string): Promise<{ files: NotionFile[]; text: string }> {
  const files: NotionFile[] = [];
  const lines: string[] = [];
  let cursor: string | null = null;
  do {
    const q = new URLSearchParams({ page_size: "100" });
    if (cursor) q.set("start_cursor", cursor);
    const r = await notion<{ results: Block[]; has_more: boolean; next_cursor: string | null }>(`/blocks/${pageId}/children?${q}`);
    for (const b of r.results) {
      const v = b[b.type] as { type?: string; file?: { url: string }; name?: string; caption?: unknown; rich_text?: unknown } | undefined;
      if (!v) continue;
      if (["image", "file", "pdf", "video", "audio"].includes(b.type)) {
        if (v.type === "file" && v.file?.url) {
          const fromUrl = decodeURIComponent(new URL(v.file.url).pathname.split("/").pop() ?? "");
          files.push({ key: `notion:${b.id}`, url: v.file.url, name: v.name || fromUrl || `${b.type}-${b.id}`, kind: b.type === "image" ? "photo" : "file" });
        }
      } else if (Array.isArray(v.rich_text)) {
        const t = (v.rich_text as { plain_text?: string }[]).map((x) => x.plain_text ?? "").join("");
        if (t.trim()) lines.push(t);
      }
    }
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return { files, text: lines.join("\n") };
}

export function commentFiles(c: NotionComment): NotionFile[] {
  return (c.attachments ?? [])
    .filter((a) => a.file?.url)
    .map((a, i) => {
      const fromUrl = decodeURIComponent(new URL(a.file!.url).pathname.split("/").pop() ?? "");
      return {
        key: `notion:${c.id}:${i}`,
        url: a.file!.url,
        name: a.name || fromUrl || `comment-file-${i}`,
        kind: a.category === "image" ? ("photo" as const) : ("file" as const),
      };
    });
}
