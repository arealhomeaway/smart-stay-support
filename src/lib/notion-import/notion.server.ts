/**
 * Read-only Notion access for the ticket import. Only GET requests and the
 * read-only data source query (a POST that reads) are ever sent. Calls are
 * spaced to respect Notion's rate limit and retried on 429.
 */
import { NOTION_CLAIM_REVIEW_STATUS, NOTION_TICKET_DATA_SOURCE_ID, SCOPE_DAYS, type NotionPage } from "./mapping";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";
const MIN_GAP_MS = 350;
let lastCall = 0;

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const notion = process.env["NOTION_API_KEY"];
  if (!lovable) throw new Error("LOVABLE_API_KEY is not configured");
  if (!notion) throw new Error("The Notion connection is not linked");
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
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method,
      headers: headers(),
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    });
    if (res.status === 429 || res.status >= 500) {
      const retry = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await sleep(Math.min(retry, 30) * 1000);
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion request failed [${res.status}]: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }
  throw new Error("Notion kept rate limiting; try again shortly. Nothing is lost.");
}

export function scopeFilter(now = Date.now()) {
  const cutoff = new Date(now - SCOPE_DAYS * 86_400_000).toISOString();
  return {
    or: [
      { property: "Issue Status", status: { equals: "In progress" } },
      { property: "Issue Status", status: { equals: NOTION_CLAIM_REVIEW_STATUS } },
      { timestamp: "last_edited_time", last_edited_time: { on_or_after: cutoff } },
      { timestamp: "created_time", created_time: { on_or_after: cutoff } },
      { property: "Created Date", date: { on_or_after: cutoff } },
    ],
  };
}

export async function queryTicketPage(cursor: string | null, pageSize = 25) {
  return notion<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>(
    `/data_sources/${NOTION_TICKET_DATA_SOURCE_ID}/query`,
    { method: "POST", body: { page_size: pageSize, filter: scopeFilter(), ...(cursor ? { start_cursor: cursor } : {}) } },
  );
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

export async function listComments(pageId: string): Promise<NotionComment[]> {
  const out: NotionComment[] = [];
  let cursor: string | null = null;
  do {
    const q = new URLSearchParams({ block_id: pageId, page_size: "100" });
    if (cursor) q.set("start_cursor", cursor);
    const r = await notion<{ results: NotionComment[]; has_more: boolean; next_cursor: string | null }>(`/comments?${q}`);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : null;
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
