/**
 * PID refresh DRY RUN (approved by the Admin, Nov 12, 2026).
 *
 * Reads the Notion PID and the live database, writes NOTHING to either. Output goes to
 * docs/pending/pid-refresh-2026-11-12/ (README.md, changes.csv, apply.sql, apply.undo.sql).
 *
 * Reuse: the constants, value transforms (plain, yesNo, scrub, toInt, parseExpiry, urlsIn,
 * linkKindFor), mapping loader (loadMapping, targetPath) and the whole field-planning loop are
 * copied unchanged from scripts/pid-import.ts (the Sep 1 importer), driven by the same
 * docs/pending/pid-import-mapping-v1.md. Only the refresh rules below are new:
 *  1. Homes with no notion_pid provenance: a mapped Notion value is a proposed fill.
 *  2. Imported homes: a differing value is a proposed update only while its provenance row is still
 *     notion_pid and no newer Resolve edit (property_profile_edits) exists; otherwise
 *     "Resolve changed, Notion differs".
 *  3. Blank in Notion never clears a Resolve value (the planning loop skips blanks).
 * Guardrails: join by ownerrez_property_id only; credential fields 45 to 53 are dropped before any
 * value is read; OwnerRez-owned fields are never written, differences are conflicts.
 *
 * Usage: bun scripts/pid-refresh-dry-run.ts   (needs NOTION_API_KEY, LOVABLE_API_KEY, PG* env)
 */

const MAPPING_PATH = "docs/pending/pid-import-mapping-v1.md";
const PID_DATA_SOURCE = "5d086f00-6da6-44a6-bab4-7eb5e8547baf"; // database 1444658d-5f4f-80e2-8d3a-f1d8f2758cd3
const FOXTAIL_OR_ID = "494863";
const OWENS_OR_ID = "410153";
const OUT = "docs/pending/pid-refresh-2026-11-12";
const AS_OF = "2026-11-12";
const MARK = "PID refresh 2026-11-12";

const CREDENTIAL_FIELDS = new Set([
  "Access Codes",
  "Gate Code",
  "Alarm Code",
  "Garage Keypad Code",
  "Garage Trim Lockbox Code",
  "Closet Supply Box Code",
  "Storage Closet/Cabinet Code",
  "WiFi Password",
  "Neighborhood Pool Access Key/Fob",
]);

/** Identity / higher-authority columns the importer may never write. */
const WRITE_PROTECTED = new Set([
  "name",
  "address_line1",
  "city",
  "state",
  "postal_code",
  "ownerrez_property_id",
  "latitude",
  "longitude",
  "formatted_address",
  "handoff_accepted_at",
]);

const MARKETS = ["OKC", "Tulsa", "Fort Worth", "Indy", "Carlton Landing", "Houston"];

type Json = Record<string, any>;
function plain(v: any): any {
  if (!v) return null;
  switch (v.type) {
    case "title":
    case "rich_text":
      return v[v.type].map((t: any) => t.plain_text).join("").trim() || null;
    case "select":
      return v.select?.name ?? null;
    case "multi_select":
      return v.multi_select.length ? v.multi_select.map((s: any) => s.name) : null;
    case "number":
      return v.number ?? null;
    case "checkbox":
      return v.checkbox;
    case "date":
      return v.date?.start ?? null;
    case "url":
      return v.url ?? null;
    case "email":
      return v.email ?? null;
    case "phone_number":
      return v.phone_number ?? null;
    case "formula": {
      const f = v.formula;
      return f?.string ?? f?.number ?? f?.boolean ?? f?.date?.start ?? null;
    }
    case "rollup": {
      const r = v.rollup;
      if (r?.type === "array") {
        const parts = r.array.map((x: any) => plain(x)).filter(Boolean);
        return parts.length ? parts.join("; ") : null;
      }
      return r?.number ?? r?.date?.start ?? null;
    }
    default:
      return null;
  }
}

function yesNo(v: any): boolean | string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["yes", "true", "y"].includes(s)) return true;
  if (["no", "false", "n"].includes(s)) return false;
  return String(v).trim() || null;
}

/**
 * Free-text safety net. Operators occasionally typed a password or door code
 * into a descriptive field (e.g. TV Specs). Those never enter Resolve: the
 * secret itself is replaced before the value is planned, written or logged.
 */
const SECRET_PATTERN =
  /\b(passwords?|passcodes?|pass\s?code|pwd|wifi\s*pass\w*|login\s*(?:info\w*|details)?|credentials?|access\s*code|gate\s*code|alarm\s*code|keypad\s*code|lockbox\s*code|door\s*code|profile\s*code|pin)\b\s*(?:is|are|:|=|-)?\s*[^\s,;\n]{2,}/gi;

let secretsRedacted = 0;
function scrub(text: string): string {
  return text.replace(SECRET_PATTERN, (_m, label) => {
    secretsRedacted += 1;
    return `${label}: [removed — credentials are not stored in Resolve]`;
  });
}


function toInt(v: any): number | null {
  const m = String(v).replace(/,/g, "").match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Parses free-text expiration copy without ever guessing an ambiguous date.
 * Source precision is preserved: a month/year source yields the last day of
 * that month, a year-only source the last day of that year, and anything
 * narrative stays unparsed for manual review.
 */
function parseExpiry(raw: string): { date: string; precision: "day" | "month" | "year" } | null {
  const s = raw.trim();
  // 2036-03-28
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { date: `${m[1]}-${pad(m[2])}-${pad(m[3])}`, precision: "day" };
  // 03.28.2036 / 07/19/2036
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return { date: `${m[3]}-${pad(m[1])}-${pad(m[2])}`, precision: "day" };
  // July 19, 2036 / 2035 June 9 / Jul 5 2034 / Feb 4, 2035
  const mon = MONTHS.findIndex((x) => new RegExp(`\\b${x.slice(0, 3)}\\w*\\b`, "i").test(s));
  const yr = s.match(/\b(20\d{2})\b/);
  const day = s.replace(/\b20\d{2}\b/, "").match(/\b(\d{1,2})\b/);
  if (mon >= 0 && yr) {
    if (day && Number(day[1]) >= 1 && Number(day[1]) <= 31)
      return { date: `${yr[1]}-${pad(mon + 1)}-${pad(day[1])}`, precision: "day" };
    return { date: lastDayOfMonth(Number(yr[1]), mon + 1), precision: "month" };
  }
  // 07/2035 or 2035/07
  m = s.match(/^(\d{1,2})[./-](\d{4})$/);
  if (m) return { date: lastDayOfMonth(Number(m[2]), Number(m[1])), precision: "month" };
  m = s.match(/^(\d{4})[./-](\d{1,2})$/);
  if (m) return { date: lastDayOfMonth(Number(m[1]), Number(m[2])), precision: "month" };
  // "01 2021" (month year)
  m = s.match(/^(\d{1,2})\s+(20\d{2})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12)
    return { date: lastDayOfMonth(Number(m[2]), Number(m[1])), precision: "month" };
  // MM/YY
  m = s.match(/^(\d{1,2})[./-](\d{2})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12)
    return { date: lastDayOfMonth(2000 + Number(m[2]), Number(m[1])), precision: "month" };
  // Year only — precision preserved, never coerced to January.
  m = s.match(/^(19|20)(\d{2})$/);
  if (m) return { date: `${m[1]}${m[2]}-12-31`, precision: "year" };
  return null;
}


function pad(n: string | number) {
  return String(n).padStart(2, "0");
}
function lastDayOfMonth(year: number, month: number) {
  return `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
}

function urlsIn(text: string): string[] {
  return [...new Set((text.match(/https?:\/\/[^\s)\]"']+/g) ?? []).map((u) => u.replace(/[.,;]+$/, "")))];
}

function fingerprint(parts: (string | null | undefined)[]) {
  return parts.map((p) => (p ?? "").trim().toLowerCase()).filter(Boolean).join("|");
}

function linkKindFor(url: string): { kind: string; staffOnly: boolean; canonical: boolean } {
  const h = url.toLowerCase();
  if (h.includes("ring.com") || h.includes("blink.com") || h.includes("alarm.com"))
    return { kind: "camera_portal", staffOnly: true, canonical: false };
  if (h.includes("sharepoint.com")) return { kind: "legacy_onedrive", staffOnly: true, canonical: false };
  if (h.includes("fillout.com")) return { kind: "fillout_form", staffOnly: true, canonical: false };
  if (h.includes("app.ownerrez.com") || h.includes("app.breezeway.io"))
    return { kind: "system", staffOnly: true, canonical: true };
  if (/drhorton|capitalhomes|homesbytaber|rwcwarranty/.test(h))
    return { kind: "builder", staffOnly: true, canonical: false };
  if (/hoa|southforklife|vintageokc|gozego/.test(h)) return { kind: "hoa", staffOnly: true, canonical: false };
  return { kind: "reference", staffOnly: true, canonical: false };
}

// ---------------------------------------------------------------- mapping

type MapRow = {
  i: number;
  name: string;
  type: string;
  target: string;
  action: string;
  authority: string;
  transform: string;
  sensitivity: string;
};

function loadMapping(md: string): MapRow[] {
  const out: MapRow[] = [];
  for (const line of md.split("\n")) {
    if (!line.startsWith("| ")) continue;
    const c = line.split("|").map((s) => s.trim());
    if (c.length < 13 || !/^\d+$/.test(c[1]!)) continue;
    out.push({
      i: Number(c[1]),
      name: c[2]!.replace(/\*\*/g, ""),
      type: c[3]!,
      target: c[6]!,
      action: c[7]!,
      authority: c[8]!,
      transform: c[9]!,
      sensitivity: c[11]!,
    });
  }
  return out;
}

/** "properties.systems.smoke.brand (seeded, dated)" → ["systems","smoke","brand"] */
function targetPath(target: string): string[] | null {
  const clean = target.replace(/\(.*?\)/g, "").trim();
  if (!clean.startsWith("properties.")) return null;
  return clean.slice("properties.".length).split(".").map((s) => s.trim()).filter(Boolean);
}


// ---------------------------------------------------------------- reads (read only)

function sql<T>(q: string): T {
  const r = Bun.spawnSync(["psql", "-At", "-v", "ON_ERROR_STOP=1", "-c", q], { stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`psql: ${r.stderr.toString()}`);
  return JSON.parse(r.stdout.toString().trim() || "null") as T;
}

async function notionRows() {
  const headers = {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "X-Connection-Api-Key": process.env["NOTION_API_KEY"]!,
    "Content-Type": "application/json",
    "Notion-Version": "2025-09-03",
  };
  const G = "https://connector-gateway.lovable.dev/notion/v1";
  let cursor: string | undefined;
  const rows: any[] = [];
  do {
    const res = await fetch(`${G}/data_sources/${PID_DATA_SOURCE}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    const j: any = await res.json();
    if (!res.ok || !j.results) throw new Error(`Notion query failed [${res.status}]: ${JSON.stringify(j).slice(0, 300)}`);
    rows.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return rows;
}

const report = {
  blanksSkipped: 0,
  valuesWritten: 0,
  conflicts: [] as any[],
  manualReview: [] as any[],
  unmappableMarket: [] as any[],
  unparseableExpiry: [] as any[],
  gpsFallback: [] as any[],
  gpsDiffOwnerRezWins: [] as any[],
  failures: [] as any[],
  excluded: [] as any[],
  foxtail: null as any,
};

const md = await Bun.file(MAPPING_PATH).text();
const mapping = loadMapping(md);
const pages = await notionRows();

const propRows = sql<any[]>("select coalesce(json_agg(to_jsonb(p)), '[]') from public.properties p") ?? [];
const provRows = sql<any[]>(
  "select coalesce(json_agg(json_build_object('property_id',property_id,'field_key',field_key,'value_source',value_source,'source_record_id',source_record_id,'as_of',as_of,'note',note,'updated_at',updated_at)), '[]') from public.property_field_provenance",
) ?? [];
const editRows = sql<any[]>(
  "select coalesce(json_agg(json_build_object('property_id',property_id,'item_key',item_key,'edited_at',edited_at)), '[]') from public.property_profile_edits",
) ?? [];
const linkRows = sql<any[]>(
  "select coalesce(json_agg(json_build_object('property_id',property_id,'kind',kind,'url',url,'source_field',source_field)), '[]') from public.property_external_links",
) ?? [];
const factRows = sql<any[]>(
  "select coalesce(json_agg(json_build_object('property_id',property_id,'field_key',field_key,'reviewed_at',reviewed_at)), '[]') from public.property_fact_proposals where status = 'accepted'",
) ?? [];
// save_home_profile_card's item map (item_key -> field), so an edit names the field it changed.
const fnDef = sql<string>("select to_json(pg_get_functiondef('public.save_home_profile_card'::regproc))") ?? "";
const allowed: Record<string, string> = JSON.parse(fnDef.match(/v_allowed constant jsonb := '(\{.*?\})'::jsonb/s)?.[1] ?? "{}");
const itemField = (item: string): string | null => {
  const spec = allowed[item];
  if (!spec) return null;
  if (spec.startsWith("column:")) return spec.slice(7);
  if (spec.startsWith("json:")) { const [, col, path] = spec.split(":"); return `${col}.${path}`; }
  if (spec.startsWith("link:")) return `link:${spec.slice(5)}`;
  return null;
};

const digits = (v: any) => (v == null ? null : String(v).replace(/[^0-9]/g, "") || null);
const byOwnerRez = new Map<string, any>();
const resolveIdFormat: any[] = [];
for (const p of propRows) {
  if (!p.ownerrez_property_id || p.is_demo) continue;
  const k = digits(p.ownerrez_property_id)!;
  if (k !== String(p.ownerrez_property_id)) resolveIdFormat.push({ home: p.name, stored: p.ownerrez_property_id, joinedAs: k });
  byOwnerRez.set(k, p);
}
const provBy = new Map<string, any>();
const pidHomes = new Set<string>();
for (const r of provRows) {
  provBy.set(`${r.property_id}|${r.field_key}`, r);
  if (r.value_source === "notion_pid") pidHomes.add(r.property_id);
}
const editsBy = new Map<string, string[]>();
const addEdit = (pid: string, key: string | null, at: string) => {
  if (!key) return;
  const k = `${pid}|${key}`;
  editsBy.set(k, [...(editsBy.get(k) ?? []), at]);
};
for (const e of editRows) addEdit(e.property_id, itemField(e.item_key) ?? e.item_key, e.edited_at);
for (const f of factRows) if (f.reviewed_at) addEdit(f.property_id, f.field_key, f.reviewed_at);
const linkSet = new Set(linkRows.map((l) => `${l.property_id}|${l.kind}|${l.url}`));

// Notion fields against the mapping (names only, never values).
const notionFields = new Set<string>();
for (const pg of pages) for (const k of Object.keys(pg.properties ?? {})) notionFields.add(k);
const mapped = new Set(mapping.map((m) => m.name));
const unmappedNotionFields = [...notionFields].filter((f) => !mapped.has(f) && !mapped.has(f.trim())).sort();
const trimmedFields = new Set([...notionFields].map((f) => (!mapped.has(f) && mapped.has(f.trim()) ? f.trim() : f)));
const missingMappedFields = mapping.filter((m) => m.action === "Import" && !trimmedFields.has(m.name)).map((m) => `${m.i} ${m.name}`);
const trimMatched = [...notionFields].filter((f) => !mapped.has(f) && mapped.has(f.trim()));

type Candidate = { page: any; values: Json; orId: string; prop: any | null; asOf: string };
const candidates: Candidate[] = [];
const unmatched: any[] = [];
const pidPages: any[] = [];
for (const page of pages) {
  const values: Json = {};
  for (const [raw, v] of Object.entries<any>(page.properties)) {
    // Mapping row 41's transform says "trim field name": Notion's name has a trailing space.
    const k = !mapped.has(raw) && mapped.has(raw.trim()) ? raw.trim() : raw;
    if (CREDENTIAL_FIELDS.has(k) || CREDENTIAL_FIELDS.has(raw)) continue; // never read
    values[k] = plain(v);
  }
  const orId = digits(values["OwnerRez Internal ID"]);
  const label = values["Property"] ?? "(untitled)";
  const address = [values["Property Address"], values["City"], values["State"]].filter(Boolean).join(", ") || "(no address)";
  pidPages.push({ id: page.id, label, address, orId, rawId: values["OwnerRez Internal ID"] ?? null, edited: page.last_edited_time });
  if (!orId) { unmatched.push({ label, address, ownerrez: null, reason: "no OwnerRez ID on the PID page", page: page.id }); continue; }
  if (orId === OWENS_OR_ID) { unmatched.push({ label, address, ownerrez: orId, reason: "21036 Owens Rd, excluded by the Sep 1 decision", page: page.id }); continue; }
  const prop = byOwnerRez.get(orId) ?? null;
  if (!prop) { unmatched.push({ label, address, ownerrez: orId, reason: "no Resolve home with this OwnerRez ID", page: page.id }); continue; }
  candidates.push({ page, values, orId, prop, asOf: page.last_edited_time ?? new Date().toISOString() });
}
// Two PID pages on one OwnerRez ID: merge them. A field both pages fill differently is held as a conflict.
const dupeConflicts: { c: Candidate; field: string; values: string[] }[] = [];
const dupes: { home: string; orId: string; pages: string[] }[] = [];
{
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) groups.set(c.prop.id, [...(groups.get(c.prop.id) ?? []), c]);
  candidates.length = 0;
  for (const list of groups.values()) {
    if (list.length === 1) { candidates.push(list[0]!); continue; }
    list.sort((a, b) => String(b.page.last_edited_time).localeCompare(String(a.page.last_edited_time)));
    const keep = list[0]!;
    dupes.push({ home: keep.prop.name, orId: keep.orId, pages: list.map((c) => `${c.values["Property"]} (${c.page.id})`) });
    const merged: Json = { ...keep.values };
    for (const k of new Set(list.flatMap((c) => Object.keys(c.values)))) {
      const vals = list.map((c) => c.values[k]).filter((v) => !(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)));
      const distinct = [...new Set(vals.map((v) => JSON.stringify(v)))];
      if (distinct.length === 0) merged[k] = keep.values[k] ?? null;
      else if (distinct.length === 1) merged[k] = vals[0];
      else if (k === "Property") merged[k] = keep.values[k];
      else { merged[k] = null; if (mapping.some((m) => m.name === k && (m.action === "Import" || m.action === "External Link"))) dupeConflicts.push({ c: keep, field: k, values: distinct }); }
    }
    candidates.push({ ...keep, values: merged });
  }
}

// ---------------------------------------------------------------- Sep 1 planning loop (unchanged)
type Write = { path: string[]; value: any; sourceField: string };
type Plan = {
  c: Candidate;
  columns: Json;
  groups: Record<string, Json>;
  provenance: { field_key: string; as_of: string }[];
  links: Json[];
};

const plans: Plan[] = [];

for (const c of candidates) {
  const prop = c.prop;
  const columns: Json = {};
  const groups: Record<string, Json> = {};
  const provenance: { field_key: string; as_of: string }[] = [];
  const links: Json[] = [];
  const label = c.values["Property"] ?? c.orId;

  const put = (path: string[], value: any, sourceField: string) => {
    if (value === null || value === undefined || value === "") return;
    if (typeof value === "string") {
      if (value.trim() === "" || value.trim() === "undefined") return;
      value = scrub(value);
    }
    const key = path.join(".");

    if (WRITE_PROTECTED.has(path[0]!)) {
      report.failures.push({ property: label, field: sourceField, error: `write-protected target ${key}` });
      return;
    }
    if (path.length === 1) columns[path[0]!] = value;
    else {
      const g = (groups[path[0]!] ??= {});
      let node = g;
      for (const seg of path.slice(1, -1)) node = node[seg] ??= {};
      node[path[path.length - 1]!] = value;
    }
    provenance.push({ field_key: key, as_of: c.asOf });
    report.valuesWritten += 1;
  };

  const addLink = (url: string, sourceField: string, over: Json = {}) => {
    if (!/^https?:\/\//i.test(url)) return;
    const meta = linkKindFor(url);
    links.push({
      kind: over["kind"] ?? meta.kind,
      url,
      label: over["label"] ?? null,
      context: over["context"] ?? null,
      staff_only: over["staff_only"] ?? meta.staffOnly,
      canonical: over["canonical"] ?? meta.canonical,
      needs_replacement: over["needs_replacement"] ?? false,
      source: "notion_pid",
      source_field: sourceField,
      as_of: c.asOf,
      note: over["note"] ?? null,
    });
  };

  const conflict = (field_key: string, field_label: string, resolveValue: any, pidValue: any) => {
    report.conflicts.push({
      property: label,
      property_id: prop?.id ?? null,
      field: field_key,
      ownerrez_value: resolveValue,
      pid_value: pidValue,
    });
  };

  for (const m of mapping) {
    if (CREDENTIAL_FIELDS.has(m.name)) continue;
    if (m.action !== "Import" && m.action !== "External Link" && m.name !== "GPS Coordinates") continue;
    const v = c.values[m.name];
    const blank = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    if (blank && m.type !== "checkbox") {
      report.blanksSkipped += 1;
      continue;
    }

    switch (m.name) {
      // ---- special cases -------------------------------------------------
      case "Greater Area": {
        const hit = MARKETS.find((mk) => mk.toLowerCase() === String(v).trim().toLowerCase());
        if (!hit) {
          report.unmappableMarket.push({ property: label, value: v });
          break;
        }
        if (!prop?.market) put(["market"], hit, m.name);
        else if (prop.market !== hit) conflict("market", "Market", prop.market, hit);
        break;
      }
      case "Status": {
        const s = String(v).trim();
        const lifecycle =
          s === "In Preparation"
            ? "onboarding"
            : s === "Live - Onboarding in Progress"
              ? "onboarding"
              : s === "Live" || s === "Live_12M"
                ? null // Resolve lifecycle is authoritative for live homes
                : null;
        if (s === "Live_12M") put(["min_stay_months"], 12, m.name);
        if (lifecycle && prop && !prop.handoff_accepted_at && prop.lifecycle_status !== "active_operations") {
          put(["lifecycle_status"], lifecycle, m.name);
        }
        break;
      }
      case "Handoff Date": {
        if (prop?.handoff_accepted_at) break; // Resolve wins, never overwritten
        put(["legacy_handoff_date"], String(v).slice(0, 10), m.name);
        break;
      }
      case "Bedrooms":
      case "Bathrooms":
      case "Occupancy Limit": {
        const col = m.name === "Bedrooms" ? "bedrooms" : m.name === "Bathrooms" ? "bathrooms" : "max_guests";
        const pid = Number(v);
        if (!Number.isFinite(pid) || pid <= 0 || pid >= 30) {
          report.manualReview.push({ property: label, field: m.name, value: v, reason: "out of range" });
          break;
        }
        const current = prop?.[col];
        if (current == null) put([col], pid, m.name);
        else if (Number(current) !== pid) conflict(col, m.name, current, pid);
        break;
      }
      case "Square Footage": {
        const n = toInt(v);
        if (n == null || n < 100 || n > 20000) {
          report.manualReview.push({ property: label, field: m.name, value: v, reason: "unparseable" });
          break;
        }
        if (prop?.living_area_sqft == null) put(["living_area_sqft"], n, m.name);
        else if (Number(prop.living_area_sqft) !== n)
          conflict("living_area_sqft", "Square footage", prop.living_area_sqft, n);
        break;
      }
      case "Property Built Year": {
        const y = toInt(v);
        if (y == null || y < 1900 || y > new Date().getFullYear()) {
          report.manualReview.push({ property: label, field: m.name, value: v, reason: "out of range" });
          break;
        }
        put(["year_built"], y, m.name);
        break;
      }
      case "Smoke Detector Expiration": {
        const parsed = parseExpiry(String(v));
        if (!parsed) {
          report.unparseableExpiry.push({ property: label, ownerrez: c.orId, value: String(v) });
          report.manualReview.push({ property: label, field: m.name, value: String(v), reason: "unparseable date" });
          break;
        }
        put(["systems", "smoke", "expires_on"], parsed.date, m.name);
        put(["systems", "smoke", "expires_precision"], parsed.precision, m.name);
        put(["systems", "smoke", "expires_source_text"], String(v).slice(0, 200), m.name);
        break;
      }
      case "Sprinkler System Set for Season?": {
        put(["sprinklers", "set_for_season"], { value: yesNo(v), as_of: c.asOf, source: "notion_pid" }, m.name);
        break;
      }
      case "Rental Restriction Notes": {
        put(
          ["compliance", "rental_restrictions"],
          { text: String(v).slice(0, 1000), as_of: c.asOf, source: "notion_pid", reference_only: true },
          m.name,
        );
        break;
      }
      case "Permit Review Status & Notes": {
        put(
          ["compliance", "permit_status"],
          { text: String(v).slice(0, 1000), as_of: c.asOf, source: "notion_pid", reference_only: true },
          m.name,
        );
        break;
      }
      case "Number of Trash Carts": {
        const n = toInt(v);
        if (n != null && n > 0 && n < 20) put(["waste", "cart_count"], n, m.name);
        put(["waste", "cart_notes"], String(v).slice(0, 300), m.name);
        break;
      }
      case "Air Filter Sizes": {
        const sizes = [...new Set((String(v).match(/\d{1,2}\s*[x×]\s*\d{1,2}\s*[x×]\s*\d{1,2}/gi) ?? []).map((s) =>
          s.replace(/\s+/g, "").replace(/×/g, "x").toLowerCase(),
        ))];
        if (sizes.length) put(["hvac", "filter_sizes"], sizes, m.name);
        put(["hvac", "filter_notes"], String(v).slice(0, 500), m.name);
        break;
      }
      case "GPS Coordinates": {
        const mm = String(v).match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        if (!mm) {
          report.manualReview.push({ property: label, field: m.name, value: String(v), reason: "unparseable" });
          break;
        }
        const lat = Number(mm[1]);
        const lng = Number(mm[2]);
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          report.manualReview.push({ property: label, field: m.name, value: String(v), reason: "out of range" });
          break;
        }
        const hasCoords =
          (prop?.latitude != null && prop?.longitude != null) ||
          (prop == null && report.foxtail?.geocode?.lat != null);
        if (hasCoords) {
          const curLat = prop?.latitude ?? report.foxtail?.geocode?.lat;
          const curLng = prop?.longitude ?? report.foxtail?.geocode?.lng;
          const diff = Math.abs(lat - Number(curLat)) > 0.001 || Math.abs(lng - Number(curLng)) > 0.001;
          if (diff) report.gpsDiffOwnerRezWins.push({ property: label });
          break; // a valid derived pin is never overwritten by PID
        }
        // Only reached when authoritative geocoding produced nothing at all.
        report.gpsFallback.push({ property: label, lat, lng });
        columns["latitude"] = lat;
        columns["longitude"] = lng;
        columns["geocode_source"] = "notion_pid_fallback";
        columns["geocode_status"] = "pid_fallback";
        provenance.push({ field_key: "latitude", as_of: c.asOf });
        provenance.push({ field_key: "longitude", as_of: c.asOf });
        report.valuesWritten += 2;
        break;

      }

      // ---- external links ------------------------------------------------
      case "OR Property Link":
      case "BW Property Link": {
        const path = targetPath(m.target)!;
        put(path, String(v).trim(), m.name);
        addLink(String(v).trim(), m.name, { kind: "system", canonical: true, label: m.name });
        break;
      }
      case "Security Camera Feed": {
        for (const u of urlsIn(String(v)))
          addLink(u, m.name, {
            kind: "camera_portal",
            staff_only: true,
            label: "Camera portal",
            note: "Portal reference only — no credentials stored.",
          });
        break;
      }
      case "Pool & Hot Tub Technician Form": {
        for (const u of urlsIn(String(v)))
          addLink(u, m.name, {
            kind: "fillout_form",
            needs_replacement: true,
            label: "Pool & hot tub technician form",
            note: "Temporary external form — to be replaced by a Resolve workflow.",
          });
        break;
      }
      case "Furniture Pick List Link": {
        for (const u of urlsIn(String(v)))
          addLink(u, m.name, {
            kind: "legacy_onedrive",
            canonical: false,
            label: "Furniture pick list (legacy OneDrive)",
            note: "Legacy OneDrive link — not a Resolve document. Pending SharePoint migration.",
          });
        break;
      }
      case "Listing Photos":
        break; // excluded — OwnerRez photos remain authoritative

      // ---- generic ---------------------------------------------------------
      default: {
        const path = targetPath(m.target);
        if (!path) break;
        let value: any = v;
        const t = m.transform.toLowerCase();
        if (t.includes("boolean")) value = yesNo(v);
        else if (t.includes("integer") || t.includes("numeric")) value = toInt(v);
        else if (Array.isArray(v)) value = v;
        else if (typeof v === "string") value = v.trim();
        if (typeof value === "string" && value.length > 2000) value = value.slice(0, 2000);
        put(path, value, m.name);
        // Pull embedded URLs out of long-form operational text into links.
        if (typeof v === "string" && /https?:\/\//.test(v)) {
          const ctx = /HOA/i.test(m.name) ? "hoa" : /Warranty|Builder/i.test(m.name) ? "warranty" : "reference";
          for (const u of urlsIn(v)) addLink(u, m.name, { context: ctx });
        }
        break;
      }
    }
  }

  plans.push({ c, columns, groups, provenance, links });
}

// ---------------------------------------------------------------- refresh classification

const OWNERREZ_COLUMNS = new Set(["bedrooms", "bathrooms", "max_guests", "living_area_sqft", "latitude", "longitude", "instant_book"]);
// Mapping rows whose Authority is OwnerRez (GPS 8, OR Property Link 13, Bedrooms 21, Bathrooms 22, Occupancy 23, Instant Book 27).
const OWNERREZ_KEYS = new Set<string>(["link:OR Property Link"]);
for (const m of mapping) if (m.authority === "OwnerRez") { const t = targetPath(m.target); if (t) OWNERREZ_KEYS.add(t.join(".")); }
const getPath = (obj: any, path: string[]) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
const isBlank = (v: any) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && v !== null && Object.keys(v).length === 0);
function norm(v: any): any {
  if (isBlank(v)) return null;
  if (typeof v === "string") { const s = v.replace(/\s+/g, " ").trim(); return s !== "" && !Number.isNaN(Number(s)) && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s; }
  if (Array.isArray(v)) return v.map(norm);
  if (typeof v === "object") {
    const o: Json = {};
    for (const k of Object.keys(v).sort()) if (k !== "as_of" && k !== "source") o[k] = norm(v[k]);
    return o;
  }
  return v;
}
const same = (a: any, b: any) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const show = (v: any) => (v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v));

type Change = {
  orId: string; home: string; propertyId: string; pageId: string; field: string; path: string[];
  current: any; notion: any; kind: "fill" | "update" | "conflict"; conflictWith: "" | "Resolve" | "OwnerRez"; reason: string;
};
const changes: Change[] = [];
let unchanged = 0;
const linkFills: { c: Candidate; link: Json }[] = [];

for (const p of plans) {
  const prop = p.c.prop!;
  const imported = pidHomes.has(prop.id);
  const seen = new Set<string>();
  for (const pr of p.provenance) {
    if (seen.has(pr.field_key)) continue;
    seen.add(pr.field_key);
    const path = pr.field_key.split(".");
    const notion = path.length === 1 ? p.columns[path[0]!] : getPath(p.groups[path[0]!], path.slice(1));
    const current = getPath(prop, path);
    const base = { orId: p.c.orId, home: prop.name, propertyId: prop.id, pageId: p.c.page.id, field: pr.field_key, path, current, notion };
    if (same(current, notion)) { unchanged += 1; continue; }
    const prov = provBy.get(`${prop.id}|${pr.field_key}`);
    const ownerRezOwned = OWNERREZ_COLUMNS.has(path[0]!) || OWNERREZ_KEYS.has(pr.field_key) || String(prov?.value_source ?? "").startsWith("ownerrez");
    const since = prov?.updated_at ?? prov?.as_of ?? "1970-01-01";
    const edited = (editsBy.get(`${prop.id}|${pr.field_key}`) ?? []).some((at) => !imported || at > since);
    if (ownerRezOwned) { changes.push({ ...base, kind: "conflict", conflictWith: "OwnerRez", reason: "OwnerRez-owned field; never written" }); continue; }
    if (isBlank(current)) {
      if (!imported) changes.push({ ...base, kind: "fill", conflictWith: "", reason: "home not imported before" });
      else if (prov && prov.value_source !== "notion_pid") changes.push({ ...base, kind: "conflict", conflictWith: "Resolve", reason: `set by ${prov.value_source} since the import` });
      else if (edited) changes.push({ ...base, kind: "conflict", conflictWith: "Resolve", reason: "cleared in Resolve since the import" });
      else changes.push({ ...base, kind: "fill", conflictWith: "", reason: prov ? "blank, still notion_pid" : "new Notion value" });
      continue;
    }
    if (!imported) { changes.push({ ...base, kind: "conflict", conflictWith: "Resolve", reason: "Resolve already has a different value" }); continue; }
    if (prov?.value_source === "notion_pid" && !edited) changes.push({ ...base, kind: "update", conflictWith: "", reason: "still notion_pid, not edited since" });
    else changes.push({ ...base, kind: "conflict", conflictWith: "Resolve", reason: !prov ? "Resolve value has no notion_pid source" : prov.value_source !== "notion_pid" ? `set by ${prov.value_source} since the import` : "edited in Resolve since the import" });
  }
  const seenLink = new Set<string>();
  for (const l of p.links) {
    const k = `${prop.id}|${l.kind}|${l.url}`;
    if (linkSet.has(k) || seenLink.has(k)) continue;
    seenLink.add(k);
    const lbase = { orId: p.c.orId, home: prop.name, propertyId: prop.id, pageId: p.c.page.id, field: `link:${l.source_field}`, path: [] as string[], current: null, notion: l.url };
    if (OWNERREZ_KEYS.has(`link:${l.source_field}`)) { changes.push({ ...lbase, kind: "conflict", conflictWith: "OwnerRez", reason: "OwnerRez-owned link; never written" }); continue; }
    linkFills.push({ c: p.c, link: l });
    changes.push({ ...lbase, kind: "fill", conflictWith: "", reason: `new ${l.kind} link` });
  }
}
// The loop's own conflicts (Resolve market or an OwnerRez value already present and different).
for (const x of report.conflicts) {
  const c = candidates.find((k) => k.prop?.id === x.property_id)!;
  changes.push({
    orId: c.orId, home: c.prop.name, propertyId: c.prop.id, pageId: c.page.id, field: x.field, path: [x.field],
    current: x.ownerrez_value, notion: x.pid_value, kind: "conflict",
    conflictWith: x.field === "market" ? "Resolve" : "OwnerRez",
    reason: x.field === "market" ? "Resolve market differs" : "OwnerRez value differs; OwnerRez wins",
  });
}
for (const d of dupeConflicts) {
  changes.push({ orId: d.c.orId, home: d.c.prop.name, propertyId: d.c.prop.id, pageId: d.c.page.id, field: `notion:${d.field}`, path: [], current: null, notion: d.values.join(" | "), kind: "conflict", conflictWith: "Resolve", reason: "two PID pages on this OwnerRez ID disagree; nothing proposed" });
}
for (const g of report.gpsDiffOwnerRezWins) {
  const c = candidates.find((k) => (k.values["Property"] ?? k.orId) === g.property)!;
  changes.push({ orId: c.orId, home: c.prop.name, propertyId: c.prop.id, pageId: c.page.id, field: "latitude,longitude", path: [], current: `${c.prop.latitude}, ${c.prop.longitude}`, notion: c.values["GPS Coordinates"], kind: "conflict", conflictWith: "OwnerRez", reason: "PID pin more than 0.001 from the Resolve pin" });
}

// ---------------------------------------------------------------- credential safety net (refresh)
// The Sep 1 scrub misses some forms ("The Pool Code is: 42909", a password typed after a removed login).
// Any change whose Notion or Resolve text still looks like it holds a code is withheld: never proposed,
// never written to these files, and listed by home and field only.
const stripUrls = (t: string) => t.replace(/https?:\/\/\S+/g, " ");
const SUSPECT = [
  /\b(codes?|pins?|passcodes?|passwords?|pwd|logins?|combo|combination|fob)\b[^\n]{0,25}?\d{3,}/i,
  /\[removed[^\]]*\]\s*[^\s\]]*(?=[^\s\]]*\d)(?=[^\s\]]*[A-Za-z])[^\s\]]{5,}/i,
  /(?<![\w@.])(?=\S*\d)(?=\S*[A-Za-z])(?=\S*[!#$%^&*?])[^\s@]{7,}(?![\w@])/,
];
const suspect = (v: any) => { if (v == null) return false; const t = stripUrls(typeof v === "string" ? v : JSON.stringify(v)); return SUSPECT.some((r) => r.test(t)); };
const withheld: { home: string; orId: string; field: string; kind: string; side: string }[] = [];
const MASK = "[withheld: may contain a code]";
for (const ch of changes) {
  const n = suspect(ch.notion), r = suspect(ch.current);
  if (!n && !r) continue;
  if (ch.kind === "fill" || ch.kind === "update") {
    withheld.push({ home: ch.home, orId: ch.orId, field: ch.field, kind: ch.kind, side: [n ? "Notion" : "", r ? "Resolve" : ""].filter(Boolean).join(" and ") });
    (ch as any).withheld = true;
  }
  if (n) ch.notion = MASK;
  if (r) ch.current = MASK;
}
for (let i = changes.length - 1; i >= 0; i--) if ((changes[i] as any).withheld) changes.splice(i, 1);
for (let i = linkFills.length - 1; i >= 0; i--) if (suspect(linkFills[i]!.link.url)) linkFills.splice(i, 1);

// ---------------------------------------------------------------- outputs

const csvCell = (v: any) => { const s = show(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = ["ownerrez_id,home,field_key,current_resolve_value,notion_value,kind,conflict_with,reason"];
const order = { fill: 0, update: 1, conflict: 2 } as const;
changes.sort((a, b) => a.home.localeCompare(b.home) || order[a.kind] - order[b.kind] || a.field.localeCompare(b.field));
for (const ch of changes) csv.push([ch.orId, ch.home, ch.field, ch.current, ch.notion, ch.kind, ch.conflictWith, ch.reason].map(csvCell).join(","));
await Bun.write(`${OUT}/changes.csv`, csv.join("\n") + "\n");

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const jlit = (v: any) => { const s = JSON.stringify(v); if (s.includes("$pid$")) throw new Error("literal clash"); return `$pid$${s}$pid$::jsonb`; };
const colType = new Map<string, string>(sql<any[]>("select json_agg(json_build_object('n',attname,'t',format_type(atttypid,atttypmod))) from pg_attribute where attrelid='public.properties'::regclass and attnum>0 and not attisdropped")!.map((c) => [c.n, c.t]));
const writes = changes.filter((c) => (c.kind === "fill" || c.kind === "update") && c.path.length > 0);
const byProp = new Map<string, Change[]>();
for (const w of writes) byProp.set(w.propertyId, [...(byProp.get(w.propertyId) ?? []), w]);

const objOr = (e: string) => `CASE WHEN jsonb_typeof(${e}) = 'object' THEN ${e} ELSE '{}'::jsonb END`;
const pathLit = (segs: string[]) => q(`{${segs.map((x) => `"${x.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`);
/** col with value v at path (path[0] is the column), creating missing objects on the way. */
function setExpr(path: string[], v: any): string {
  const col = path[0]!;
  let expr = objOr(col);
  for (let d = 2; d < path.length; d++) expr = `jsonb_set(${expr}, ${pathLit(path.slice(1, d))}, ${objOr(`${col} #> ${pathLit(path.slice(1, d))}`)}, true)`;
  return `jsonb_set(${expr}, ${pathLit(path.slice(1))}, ${jlit(v)}, true)`;
}
const colSet = (col: string, v: any) => `${col} = (jsonb_populate_record(NULL::public.properties, ${jlit({ [col]: v })})).${col}`;
const colIs = (col: string, v: any) => `to_jsonb(${col}) IS NOT DISTINCT FROM ${v == null ? "NULL" : jlit(v)}`;
const pathIs = (path: string[], v: any) => `coalesce(${path[0]} #> ${pathLit(path.slice(1))}, 'null'::jsonb) = ${jlit(v === undefined ? null : v)}`;

const apply: string[] = [
  `-- ${MARK}: DRY RUN OUTPUT. NOT RUN. Apply only with approval.`,
  "-- Makes exactly the proposed fills and updates in changes.csv, with provenance rows (value_source notion_pid, as_of today).",
  "-- Each value is written only if Resolve still holds the value seen in the dry run; any difference aborts the whole file.",
  "BEGIN;",
];
const undo: string[] = [
  `-- UNDO for ${MARK} apply.sql. Restores every touched value, provenance row and inserted link.`,
  "-- Each restore checks the value is still the applied one; any difference aborts the whole file.",
  "BEGIN;",
];
const step = (sqlText: string, label: string, what: string) =>
  `DO $do$ BEGIN\n  ${sqlText};\n  IF NOT FOUND THEN RAISE EXCEPTION '${what}: %', ${label}; END IF;\nEND $do$;`;
for (const [pid, list] of byProp) {
  const prop = propRows.find((p) => p.id === pid)!;
  const label = q(`${prop.name} ${list[0]!.field}`.slice(0, 0) + prop.name);
  apply.push(`\n-- ${prop.name} (OwnerRez ${digits(prop.ownerrez_property_id)}): ${list.length} value(s)`);
  undo.push(`\n-- ${prop.name}`);
  const created = new Set<string>();
  for (const w of list) {
    const lbl = q(`${prop.name} / ${w.field}`);
    if (w.path.length === 1) {
      apply.push(step(`UPDATE public.properties SET ${colSet(w.field, w.notion)}, updated_at = now() WHERE id = ${q(pid)} AND ${colIs(w.field, w.current)}`, lbl, "Changed since the dry run"));
      undo.push(step(`UPDATE public.properties SET ${colSet(w.field, w.current ?? null)}, updated_at = now() WHERE id = ${q(pid)} AND ${colIs(w.field, w.notion)}`, lbl, "Changed since the refresh"));
    } else {
      if (colType.get(w.path[0]!) !== "jsonb") throw new Error(`${w.path[0]} is not jsonb`);
      apply.push(step(`UPDATE public.properties SET ${w.path[0]} = ${setExpr(w.path, w.notion)}, updated_at = now() WHERE id = ${q(pid)} AND ${pathIs(w.path, w.current)}`, lbl, "Changed since the dry run"));
      const restore = w.current === undefined ? `${w.path[0]} #- ${pathLit(w.path.slice(1))}` : setExpr(w.path, w.current);
      undo.push(step(`UPDATE public.properties SET ${w.path[0]} = ${restore}, updated_at = now() WHERE id = ${q(pid)} AND ${pathIs(w.path, w.notion)}`, lbl, "Changed since the refresh"));
      const top = prop[w.path[0]!];
      if (top != null && (typeof top !== "object" || Array.isArray(top))) throw new Error(`${prop.name} ${w.path[0]} is not an object`);
      for (let d = 2; d < w.path.length; d++) {
        const mid = getPath(prop, w.path.slice(0, d));
        if (mid != null && (typeof mid !== "object" || Array.isArray(mid))) throw new Error(`${prop.name} ${w.path.slice(0, d).join(".")} is not an object`);
        if (mid === undefined) created.add(JSON.stringify(w.path.slice(0, d)));
      }
      if (top == null) created.add(JSON.stringify([w.path[0]!]));
    }
    const prior = provBy.get(`${pid}|${w.field}`);
    apply.push(`INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)\n  VALUES (${q(pid)}, ${q(w.field)}, 'notion_pid', ${q(w.pageId)}, ${q(AS_OF)}, ${q(MARK)})\n  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,\n    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();`);
    undo.push(prior
      ? `UPDATE public.property_field_provenance SET value_source = ${q(prior.value_source)}, source_record_id = ${prior.source_record_id == null ? "NULL" : q(prior.source_record_id)}, as_of = ${q(prior.as_of)}, note = ${prior.note == null ? "NULL" : q(prior.note)}, updated_at = now()\n  WHERE property_id = ${q(pid)} AND field_key = ${q(w.field)} AND note = ${q(MARK)};`
      : `DELETE FROM public.property_field_provenance WHERE property_id = ${q(pid)} AND field_key = ${q(w.field)} AND note = ${q(MARK)};`);
  }
  // Objects the refresh created on the way (and columns that were empty) go back to how they were.
  for (const c of [...created].map((x) => JSON.parse(x) as string[]).sort((x, y) => y.length - x.length)) {
    undo.push(c.length === 1
      ? `UPDATE public.properties SET ${c[0]} = NULL, updated_at = now() WHERE id = ${q(pid)} AND ${c[0]} = '{}'::jsonb;`
      : `UPDATE public.properties SET ${c[0]} = ${c[0]} #- ${pathLit(c.slice(1))}, updated_at = now() WHERE id = ${q(pid)} AND ${c[0]} #> ${pathLit(c.slice(1))} = '{}'::jsonb;`);
  }
  void label;
}
if (linkFills.length) {
  apply.push("\n-- New reference links (same kinds and flags as the Sep 1 importer).");
  undo.push("\n-- Links added by the refresh.");
}
for (const { c, link } of linkFills) {
  const l = link;
  apply.push(`INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)\n  VALUES (${q(c.prop.id)}, ${q(l.kind)}, ${l.label == null ? "NULL" : q(l.label)}, ${q(l.url)}, ${l.context == null ? "NULL" : q(l.context)}, ${l.staff_only}, ${l.canonical}, ${l.needs_replacement}, 'notion_pid', ${q(l.source_field)}, ${q(AS_OF)}, ${l.note == null ? "NULL" : q(l.note)})\n  ON CONFLICT (property_id, kind, url) DO NOTHING;`);
  undo.push(`DELETE FROM public.property_external_links WHERE property_id = ${q(c.prop.id)} AND kind = ${q(l.kind)} AND url = ${q(l.url)} AND source = 'notion_pid' AND as_of = ${q(AS_OF)}::timestamptz;`);
}
apply.push("\nCOMMIT;");
undo.push("\nCOMMIT;");
await Bun.write(`${OUT}/apply.sql`, apply.join("\n") + "\n");
await Bun.write(`${OUT}/apply.undo.sql`, undo.join("\n") + "\n");

const count = (k: string, w?: string) => changes.filter((c) => c.kind === k && (w === undefined || c.conflictWith === w)).length;
const perHome = new Map<string, { home: string; orId: string; fill: number; update: number; conflict: number; imported: boolean }>();
for (const c of candidates) perHome.set(c.prop.id, { home: c.prop.name, orId: c.orId, fill: 0, update: 0, conflict: 0, imported: pidHomes.has(c.prop.id) });
for (const ch of changes) perHome.get(ch.propertyId)![ch.kind] += 1;

await Bun.write(`/tmp/pidr/summary.json`, JSON.stringify({
  pidRows: pages.length, matched: candidates.length, matchedHomes: perHome.size, dupes, pidPagesMatched: pages.length - unmatched.length,
  unmatched, unchanged, fills: count("fill"), linkFills: linkFills.length, updates: count("update"),
  resolveConflicts: count("conflict", "Resolve"), ownerRezConflicts: count("conflict", "OwnerRez"),
  invalid: { manualReview: report.manualReview, unmappableMarket: report.unmappableMarket, failures: report.failures },
  withheld, blanksSkipped: report.blanksSkipped, secretsRedacted, trimMatched, dupeConflicts: dupeConflicts.map((d) => d.field), resolveIdFormat, unmappedNotionFields, missingMappedFields,
  perHome: [...perHome.values()], pidPages, profileEdits: editRows.length, factEdits: factRows.length, writeHomes: byProp.size, writes: writes.length,
  mappingRows: mapping.length, importRows: mapping.filter((m) => m.action === "Import").length,
}, null, 1));
console.log(JSON.stringify({ pidRows: pages.length, matched: candidates.length, fills: count("fill"), updates: count("update"), rc: count("conflict", "Resolve"), oc: count("conflict", "OwnerRez"), unmatched: unmatched.length }));
