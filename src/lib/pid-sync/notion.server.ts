/**
 * Read-only Notion access for the nightly PID copy: the PID data source, its field types and the
 * titles of records its linked fields point at. Only GET and the read-only data source query are
 * sent. Retries follow the ticket import's rules (src/lib/notion-import/runner.ts).
 */
import { NOTION_ATTEMPTS, isRetryableStatus, retryDelayMs } from "@/lib/notion-import/runner";
import { PID_DATA_SOURCE_ID, type PidPage } from "./plan";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";
const MIN_GAP_MS = 350;
const MAX_TITLE_PAGES = 60; // 6,000 linked records per list at most
let lastCall = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class PidNotionError extends Error {}

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const notion = process.env["NOTION_API_KEY"];
  if (!lovable) throw new PidNotionError("LOVABLE_API_KEY is not configured");
  if (!notion) throw new PidNotionError("The Notion connection is not linked");
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": notion, "Notion-Version": "2025-09-03", "Content-Type": "application/json" };
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  if (body !== undefined && !/^\/data_sources\/[^/?]+\/query(\?.*)?$/.test(path)) throw new Error("The PID copy only reads from Notion");
  let last = "Notion could not be reached";
  for (let attempt = 0; attempt < NOTION_ATTEMPTS; attempt++) {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    let res: Response;
    try {
      res = await fetch(`${GATEWAY_URL}${path}`, { method: body === undefined ? "GET" : "POST", headers: headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch (e) {
      if (e instanceof PidNotionError) throw e;
      last = e instanceof Error ? e.message : String(e);
      await sleep(retryDelayMs(attempt, null));
      continue;
    }
    if (isRetryableStatus(res.status)) {
      last = `Notion request failed [${res.status}]: ${(await res.text().catch(() => "")).slice(0, 200)}`;
      await sleep(retryDelayMs(attempt, res.headers.get("retry-after")));
      continue;
    }
    if (!res.ok) throw new PidNotionError(`Notion request failed [${res.status}]: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return (await res.json()) as T;
  }
  throw new PidNotionError(last);
}

/** Every PID page (all fields). */
export async function fetchPidPages(): Promise<PidPage[]> {
  const pages: PidPage[] = [];
  let cursor: string | undefined;
  do {
    const j = await call<{ results: PidPage[]; has_more: boolean; next_cursor: string | null }>(
      `/data_sources/${PID_DATA_SOURCE_ID}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    );
    pages.push(...j.results);
    cursor = j.has_more && j.next_cursor ? j.next_cursor : undefined;
  } while (cursor);
  return pages;
}

/** Linked field name → the data source it points at (only the ones the connection can read). */
export async function fetchPidRelationSources(): Promise<Record<string, string>> {
  const j = await call<{ properties: Record<string, any> }>(`/data_sources/${PID_DATA_SOURCE_ID}`);
  const out: Record<string, string> = {};
  for (const [name, p] of Object.entries(j.properties ?? {})) {
    const id = p?.type === "relation" ? p.relation?.data_source_id : null;
    if (id) out[name] = String(id);
  }
  return out;
}

/** Titles of every record in the given data sources, keyed by page ID without dashes. */
export async function fetchTitles(dataSourceIds: string[]): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  for (const ds of [...new Set(dataSourceIds)]) {
    let cursor: string | undefined;
    let n = 0;
    do {
      const j = await call<{ results: { id: string; properties: Record<string, any> }[]; has_more: boolean; next_cursor: string | null }>(
        `/data_sources/${ds}/query?filter_properties[]=title`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
      );
      for (const r of j.results) {
        const t = Object.values(r.properties ?? {}).find((p: any) => p?.type === "title") as any;
        const text = (t?.title ?? []).map((x: any) => x.plain_text).join("").trim();
        if (text) titles.set(r.id.replace(/-/g, ""), text);
      }
      cursor = j.has_more && j.next_cursor ? j.next_cursor : undefined;
    } while (cursor && ++n < MAX_TITLE_PAGES);
  }
  return titles;
}
