/**
 * One-off PID (Notion Property Information Database) → Resolve migration.
 *
 * Driven entirely by the approved mapping in
 * docs/pending/pid-import-mapping-v1.md. Nothing here is reachable from the
 * app; it runs from the sandbox with the service role.
 *
 * Guardrails (non-negotiable, enforced in code below):
 *  - Join key is `ownerrez_property_id` only. No name or address matching.
 *  - The nine credential/security fields are never read, written or logged.
 *  - OwnerRez stays authoritative for identity, address, listing facts,
 *    bedrooms, bathrooms and occupancy — differences are logged as conflicts.
 *  - Every written value gets a `property_field_provenance` row with
 *    source `notion_pid` and the Notion page's `as_of`.
 *  - Blanks are skipped. Higher-authority values are never overwritten.
 *
 * Usage: bun scripts/pid-import.ts [--apply]
 */

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const MAPPING_PATH = "docs/pending/pid-import-mapping-v1.md";
const PID_DB = "1444658d-5f4f-80e2-8d3a-f1d8f2758cd3";
const FOXTAIL_OR_ID = "494863";
const OWENS_OR_ID = "410153";

/** Permanently excluded. Values are never read out of the Notion payload. */
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

// ---------------------------------------------------------------- utilities

type Json = Record<string, any>;

const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
  auth: { persistSession: false },
});

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

// ---------------------------------------------------------------- fetching

async function notionRows() {
  const headers = {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "X-Connection-Api-Key": process.env["NOTION_API_KEY"]!,
    "Content-Type": "application/json",
  };
  const G = "https://connector-gateway.lovable.dev/notion/v1";
  let cursor: string | undefined;
  const rows: any[] = [];
  do {
    const res = await fetch(`${G}/databases/${PID_DB}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    const j: any = await res.json();
    if (!j.results) throw new Error(`Notion query failed: ${JSON.stringify(j).slice(0, 300)}`);
    rows.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function ownerRezGet<T>(path: string): Promise<T> {
  const auth = Buffer.from(
    `${process.env["OWNERREZ_USERNAME"]}:${process.env["OWNERREZ_ACCESS_TOKEN"]}`,
  ).toString("base64");
  const res = await fetch(`https://api.ownerreservations.com/v2${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json", "User-Agent": "ARHA-Resolve" },
  });
  if (!res.ok) throw new Error(`OwnerRez ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function geocode(address: string) {
  const res = await fetch(
    `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
        "X-Connection-Api-Key": process.env["GOOGLE_MAPS_API_KEY"]!,
      },
    },
  );
  const j: any = await res.json();
  const hit = j.results?.[0];
  if (j.status !== "OK" || !hit) return { status: j.status as string, hit: null };
  return {
    status: "OK",
    hit: { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng, formatted: hit.formatted_address },
  };
}

// ---------------------------------------------------------------- main

const report = {
  propertiesCreated: 0,
  propertiesUpdated: 0,
  valuesWritten: 0,
  provenanceRows: 0,
  blanksSkipped: 0,
  conflicts: [] as any[],
  manualReview: [] as any[],
  credentialFieldsSkipped: 0,
  credentialFieldNames: [...CREDENTIAL_FIELDS],
  linksByKind: {} as Record<string, number>,
  unmappableMarket: [] as any[],
  unparseableExpiry: [] as any[],
  gpsFallback: [] as any[],
  gpsDiffOwnerRezWins: [] as any[],
  foxtail: null as any,
  failures: [] as any[],
  excluded: [] as any[],
};

const md = await Bun.file(MAPPING_PATH).text();
const mapping = loadMapping(md);
const byName = new Map(mapping.map((m) => [m.name, m]));
console.log(`mapping rows: ${mapping.length}`);

const pages = await notionRows();
console.log(`PID rows: ${pages.length}`);

const { data: propRows, error: propErr } = await sb.from("properties").select("*").limit(1000);
if (propErr) throw propErr;
const byOwnerRez = new Map<string, any>();
for (const p of propRows!) if (p.ownerrez_property_id && !p.is_demo) byOwnerRez.set(String(p.ownerrez_property_id), p);

type Candidate = { page: any; values: Json; orId: string; prop: any | null; asOf: string };
const candidates: Candidate[] = [];

for (const page of pages) {
  const values: Json = {};
  for (const [k, v] of Object.entries<any>(page.properties)) {
    if (CREDENTIAL_FIELDS.has(k)) {
      // Never read. Only note that a value existed, without touching it.
      if (v?.type === "rich_text" ? v.rich_text.length > 0 : Boolean(v?.select ?? v?.number)) {
        report.credentialFieldsSkipped += 1;
      }
      continue;
    }
    values[k] = plain(v);
  }
  const rawId = values["OwnerRez Internal ID"];
  const orId = rawId == null ? null : String(rawId).replace(/[^0-9]/g, "") || null;
  const label = values["Property"] ?? "(untitled)";
  if (!orId) {
    report.excluded.push({ reason: "no OwnerRez ID (test row) — untouched", name: label });
    continue;
  }
  if (orId === OWENS_OR_ID) {
    report.excluded.push({ reason: "21036 Owens Rd — excluded by decision", name: label, ownerrez: orId });
    continue;
  }
  const prop = byOwnerRez.get(orId) ?? null;
  if (!prop && orId !== FOXTAIL_OR_ID) {
    report.excluded.push({ reason: "no Resolve match on ownerrez_property_id", name: label, ownerrez: orId });
    continue;
  }
  candidates.push({ page, values, orId, prop, asOf: page.last_edited_time ?? new Date().toISOString() });
}
console.log(`candidates: ${candidates.length}`);

// ------------------------------------------------- step 2: Foxtail creation

const foxtail = candidates.find((c) => c.orId === FOXTAIL_OR_ID);
if (foxtail && !foxtail.prop) {
  const listing = await ownerRezGet<any>(`/properties/${FOXTAIL_OR_ID}`);
  const addr = listing.address ?? {};
  const row: Json = {
    name: listing.name ?? listing.external_name ?? "1399 Foxtail Ln",
    address_line1: addr.street1 ?? null,
    city: addr.city ?? null,
    state: addr.state ?? null,
    postal_code: addr.postal_code ?? addr.zip ?? null,
    ownerrez_property_id: FOXTAIL_OR_ID,
    ownerrez_synced_at: new Date().toISOString(),
    lifecycle_status: "onboarding",
    onboarding_stage: "post_contract",
    active: true,
    is_demo: false,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    max_guests: listing.max_guests ?? null,
    living_area_sqft: listing.living_area ?? null,
    property_type: listing.property_type ?? null,
    check_in_time: listing.check_in ?? null,
    check_out_time: listing.check_out ?? null,
    time_zone: listing.time_zone ?? null,
    listing_public_url: listing.public_url ?? null,
  };
  const address = [row["address_line1"], row["city"], row["state"], row["postal_code"]]
    .filter(Boolean)
    .join(", ");
  let geo: any = { status: "skipped", hit: null };
  if (address) geo = await geocode(address);
  if (geo.hit) {
    Object.assign(row, {
      latitude: geo.hit.lat,
      longitude: geo.hit.lng,
      formatted_address: geo.hit.formatted,
      geocode_status: "ok",
      geocoded_at: new Date().toISOString(),
      geocode_source: "google_maps",
      geocode_address_fingerprint: fingerprint([
        row["address_line1"],
        row["city"],
        row["state"],
        row["postal_code"],
      ]),
    });
  } else {
    row["geocode_status"] = geo.status === "ZERO_RESULTS" ? "not_found" : "pending";
  }
  report.foxtail = {
    ownerrez_id: FOXTAIL_OR_ID,
    name: row["name"],
    address,
    lifecycle: "onboarding (In Preparation)",
    geocode: geo.hit ? { ...geo.hit, source: "google_maps" } : { status: geo.status, pidGpsUsed: false },
  };
  if (APPLY) {
    const { data, error } = await sb.from("properties").insert(row).select("*").single();
    if (error) {
      report.failures.push({ step: "foxtail insert", error: error.message });
    } else {
      foxtail.prop = data;
      report.propertiesCreated += 1;
    }
  }
}

// ------------------------------------------------- step 3: value planning

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



for (const p of plans) for (const l of p.links) report.linksByKind[l.kind] = (report.linksByKind[l.kind] ?? 0) + 1;
report.provenanceRows = plans.reduce((n, p) => n + p.provenance.length, 0);

// ------------------------------------------------- apply

if (APPLY) {
  const ids = plans.map((p) => p.c.prop?.id).filter(Boolean) as string[];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    await sb.from("property_field_provenance").delete().eq("value_source", "notion_pid").in("property_id", chunk);
    await sb
      .from("field_conflicts")
      .delete()
      .eq("system", "notion_pid")
      .eq("status", "open")
      .in("entity_id", chunk);
  }

  const provPayload: Json[] = [];
  for (const p of plans) {
    const prop = p.c.prop;
    if (!prop) {
      report.failures.push({ property: p.c.values["Property"], error: "no Resolve row (not created)" });
      continue;
    }
    const patch: Json = { ...p.columns };
    for (const [group, value] of Object.entries(p.groups)) {
      patch[group] = { ...(prop[group] ?? {}), ...value };
    }
    if (Object.keys(patch).length === 0) continue;
    const { error } = await sb.from("properties").update(patch).eq("id", prop.id);
    if (error) {
      report.failures.push({ property: prop.name, error: error.message });
      continue;
    }
    report.propertiesUpdated += 1;
    for (const pr of p.provenance)
      provPayload.push({
        property_id: prop.id,
        field_key: pr.field_key,
        value_source: "notion_pid",
        source_record_id: p.c.page.id,
        as_of: pr.as_of,
        note: pr.field_key.startsWith("systems.smoke.expires")
          ? "Source supplied month/year precision only where expires_precision = month."
          : null,
      });
  }

  for (let i = 0; i < provPayload.length; i += 500) {
    const { error } = await sb.from("property_field_provenance").insert(provPayload.slice(i, i + 500));
    if (error) report.failures.push({ step: "provenance insert", error: error.message });
  }

  const linkPayload: Json[] = [];
  for (const p of plans) {
    if (!p.c.prop) continue;
    const seen = new Set<string>();
    for (const l of p.links) {
      const k = `${l.kind}|${l.url}`;
      if (seen.has(k)) continue;
      seen.add(k);
      linkPayload.push({ property_id: p.c.prop.id, ...l });
    }
  }
  for (let i = 0; i < linkPayload.length; i += 300) {
    const { error } = await sb
      .from("property_external_links")
      .upsert(linkPayload.slice(i, i + 300), { onConflict: "property_id,kind,url", ignoreDuplicates: true });
    if (error) report.failures.push({ step: "links insert", error: error.message });
  }

  const conflictPayload = report.conflicts
    .filter((x) => x.property_id)
    .map((x) => ({
      entity_type: "property",
      entity_id: x.property_id,
      system: "notion_pid",
      field_key: x.field,
      field_label: x.field,
      resolve_value: String(x.ownerrez_value),
      external_value: String(x.pid_value),
      status: "open",
      note: "PID differs from the authoritative value. Not written — review required.",
    }));
  for (let i = 0; i < conflictPayload.length; i += 300) {
    const { error } = await sb.from("field_conflicts").insert(conflictPayload.slice(i, i + 300));
    if (error) report.failures.push({ step: "conflict insert", error: error.message });
  }
}

const summary = {
  mode: APPLY ? "APPLIED" : "DRY RUN",
  ...report,
  conflicts: report.conflicts.length,
  conflictDetail: report.conflicts,
  manualReview: report.manualReview.length,
  manualReviewDetail: report.manualReview,
  linkTotal: Object.values(report.linksByKind).reduce((a, b) => a + b, 0),
};
await Bun.write("/tmp/pid/result.json", JSON.stringify(summary, null, 1));
console.log(
  JSON.stringify(
    {
      mode: summary.mode,
      propertiesCreated: summary.propertiesCreated,
      propertiesUpdated: summary.propertiesUpdated,
      valuesWritten: summary.valuesWritten,
      provenanceRows: summary.provenanceRows,
      blanksSkipped: summary.blanksSkipped,
      conflicts: summary.conflicts,
      manualReview: summary.manualReview,
      credentialFieldsSkipped: summary.credentialFieldsSkipped,
      linksByKind: summary.linksByKind,
      unmappableMarket: summary.unmappableMarket,
      unparseableExpiry: summary.unparseableExpiry.length,
      gpsFallback: summary.gpsFallback.length,
      gpsDiffOwnerRezWins: summary.gpsDiffOwnerRezWins.length,
      excluded: summary.excluded,
      failures: summary.failures,
      foxtail: summary.foxtail,
    },
    null,
    1,
  ),
);
