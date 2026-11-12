/**
 * The PID refresh rules, shared by the nightly copy (run.server.ts) and the Nov 12 dry run
 * (scripts/pid-refresh-dry-run.ts). Pure: it reads a Notion snapshot and a Resolve snapshot and
 * returns what would change. The field-planning loop is the Sep 1 importer's, unchanged.
 *
 *  - Join by OwnerRez ID only (digits on both sides). 21036 Owens Rd stays excluded.
 *  - Code fields 45 to 53 are never part of these values (see credentials-plan.ts for the vault).
 *  - A blank Notion value never clears a Resolve value.
 *  - OwnerRez-owned fields are never written; a difference is listed.
 *  - Home never copied before: a value is a fill where Resolve is blank.
 *  - Home copied before: a differing value is an update only while its source is still notion_pid
 *    and nobody changed it in Resolve since (a newer edit, an accepted fact, or a value that no
 *    longer matches what the last copy wrote). Otherwise it goes on the review list.
 *  - Text that may hold a code is never copied (withheld).
 */
import { PID_MAPPING_V1, type PidMapRow } from "./mapping-v1";
import {
  digits, linkKindFor, parseExpiry, plain, scrub, suspect, targetPath, toInt, urlsIn, yesNo, type Json,
} from "./transforms";

export const PID_DATA_SOURCE_ID = "5d086f00-6da6-44a6-bab4-7eb5e8547baf";
export const OWENS_OR_ID = "410153";

export const CREDENTIAL_FIELDS = new Set([
  "Access Codes", "Gate Code", "Alarm Code", "Garage Keypad Code", "Garage Trim Lockbox Code",
  "Closet Supply Box Code", "Storage Closet/Cabinet Code", "WiFi Password", "Neighborhood Pool Access Key/Fob",
]);

/** Identity / higher-authority columns the copy may never write (Sep 1 list). */
export const WRITE_PROTECTED = new Set([
  "name", "address_line1", "city", "state", "postal_code", "ownerrez_property_id",
  "latitude", "longitude", "formatted_address", "handoff_accepted_at",
]);
export const OWNERREZ_COLUMNS = new Set(["bedrooms", "bathrooms", "max_guests", "living_area_sqft", "latitude", "longitude", "instant_book"]);
/** Resolve workflow fields (ownership model: workflow and status belong to Resolve). */
export const RESOLVE_WORKFLOW = new Set(["lifecycle_status"]);
const MARKETS = ["OKC", "Tulsa", "Fort Worth", "Indy", "Carlton Landing", "Houston"];

export type PidPage = { id: string; last_edited_time?: string | null; properties: Record<string, any> };
export type ProvRow = { property_id: string; field_key: string; value_source: string; source_record_id?: string | null; as_of?: string | null; note?: string | null; updated_at?: string | null };
export type PidSnapshot = {
  /** Every non-demo Resolve home, all columns. */
  properties: Json[];
  provenance: ProvRow[];
  /** Resolve edits by field key (profile edits mapped to fields, accepted facts). */
  edits: { property_id: string; field_key: string; at: string }[];
  links: { property_id: string; kind: string; url: string }[];
  /** `${property_id}|${field_key}` whose Resolve value no longer matches the last copy. */
  changedSinceCopy?: Set<string>;
};
export type PlanOptions = {
  /** Nightly: a value the Sep 1 scrub had to redact is withheld too, never copied with the marker. */
  withholdRedacted: boolean;
  mapping?: PidMapRow[];
};

export type ChangeKind = "fill" | "update" | "conflict";
export type Change = {
  orId: string; home: string; propertyId: string; pageId: string; field: string; path: string[];
  current: any; notion: any; kind: ChangeKind; conflictWith: "" | "Resolve" | "OwnerRez" | "Notion"; reason: string;
  /** Provenance seen when planned (the write is refused if it changed). */
  prov?: { value_source: string; updated_at: string | null } | null;
};
export type Withheld = { field: string; kind: ChangeKind; side: string; notionRaw: string | null };
export type LinkInsert = {
  kind: string; url: string; label: string | null; context: string | null; staff_only: boolean; canonical: boolean;
  needs_replacement: boolean; source: "notion_pid"; source_field: string; as_of: string; note: string | null;
};
export type HomePlan = {
  propertyId: string; home: string; orId: string; pageId: string; asOf: string; imported: boolean;
  /** Fills, updates and review items (withheld removed). */
  changes: Change[];
  links: LinkInsert[];
  withheld: Withheld[];
  invalid: { field: string; value: string; reason: string }[];
  unchanged: number;
  /** Raw Notion properties of the page used (the newest when two pages share an OwnerRez ID). */
  raw: Record<string, any>;
  /** Other pages on the same OwnerRez ID (older first after the newest). */
  otherRaw: Record<string, any>[];
};
export type PidPlan = {
  homes: HomePlan[];
  unmatched: { label: string; address: string; ownerrez: string | null; reason: string; page: string }[];
  dupes: { home: string; orId: string; pages: string[] }[];
  unmappedNotionFields: string[];
  trimMatched: string[];
  blanksSkipped: number;
  secretsRedacted: number;
};

const getPath = (obj: any, path: string[]) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
export const isBlankValue = (v: any) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && v !== null && Object.keys(v).length === 0);
function norm(v: any): any {
  if (isBlankValue(v)) return null;
  if (typeof v === "string") {
    const s = v.replace(/\s+/g, " ").trim();
    return s !== "" && !Number.isNaN(Number(s)) && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
  }
  if (Array.isArray(v)) return v.map(norm);
  if (typeof v === "object") {
    const o: Json = {};
    for (const k of Object.keys(v).sort()) if (k !== "as_of" && k !== "source") o[k] = norm(v[k]);
    return o;
  }
  return v;
}
export const sameValue = (a: any, b: any) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

type Candidate = { page: PidPage; values: Json; orId: string; prop: Json; asOf: string; raw: Record<string, any>; otherRaw: Record<string, any>[] };

export function planPidRefresh(pages: PidPage[], snap: PidSnapshot, opts: PlanOptions): PidPlan {
  const mapping = opts.mapping ?? PID_MAPPING_V1;
  let secretsRedacted = 0;
  let blanksSkipped = 0;

  const byOwnerRez = new Map<string, Json>();
  for (const p of snap.properties) {
    if (!p["ownerrez_property_id"] || p["is_demo"]) continue;
    byOwnerRez.set(digits(p["ownerrez_property_id"])!, p);
  }
  const provBy = new Map<string, ProvRow>();
  const pidHomes = new Set<string>();
  for (const r of snap.provenance) {
    provBy.set(`${r.property_id}|${r.field_key}`, r);
    if (r.value_source === "notion_pid") pidHomes.add(r.property_id);
  }
  const editsBy = new Map<string, string[]>();
  for (const e of snap.edits) {
    const k = `${e.property_id}|${e.field_key}`;
    editsBy.set(k, [...(editsBy.get(k) ?? []), e.at]);
  }
  const linkSet = new Set(snap.links.map((l) => `${l.property_id}|${l.kind}|${l.url}`));

  const notionFields = new Set<string>();
  for (const pg of pages) for (const k of Object.keys(pg.properties ?? {})) notionFields.add(k);
  const mapped = new Set(mapping.map((m) => m.name));
  const unmappedNotionFields = [...notionFields].filter((f) => !mapped.has(f) && !mapped.has(f.trim())).sort();
  const trimMatched = [...notionFields].filter((f) => !mapped.has(f) && mapped.has(f.trim()));

  const candidates: Candidate[] = [];
  const unmatched: PidPlan["unmatched"] = [];
  for (const page of pages) {
    const values: Json = {};
    for (const [raw, v] of Object.entries<any>(page.properties ?? {})) {
      // Mapping row 41's transform says "trim field name": Notion's name has a trailing space.
      const k = !mapped.has(raw) && mapped.has(raw.trim()) ? raw.trim() : raw;
      if (CREDENTIAL_FIELDS.has(k) || CREDENTIAL_FIELDS.has(raw)) continue; // never part of these values
      values[k] = plain(v);
    }
    const orId = digits(values["OwnerRez Internal ID"]);
    const label = values["Property"] ?? "(untitled)";
    const address = [values["Property Address"], values["City"], values["State"]].filter(Boolean).join(", ") || "(no address)";
    if (!orId) { unmatched.push({ label, address, ownerrez: null, reason: "no OwnerRez ID on the PID page", page: page.id }); continue; }
    if (orId === OWENS_OR_ID) { unmatched.push({ label, address, ownerrez: orId, reason: "21036 Owens Rd, excluded by the Sep 1 decision", page: page.id }); continue; }
    const prop = byOwnerRez.get(orId);
    if (!prop) { unmatched.push({ label, address, ownerrez: orId, reason: "no Resolve home with this OwnerRez ID", page: page.id }); continue; }
    candidates.push({ page, values, orId, prop, asOf: page.last_edited_time ?? new Date().toISOString(), raw: page.properties ?? {}, otherRaw: [] });
  }

  // Two PID pages on one OwnerRez ID: merged; a field both fill differently is held as a conflict.
  const dupeConflicts: { c: Candidate; field: string; values: string[] }[] = [];
  const dupes: PidPlan["dupes"] = [];
  {
    const groups = new Map<string, Candidate[]>();
    for (const c of candidates) groups.set(c.prop["id"], [...(groups.get(c.prop["id"]) ?? []), c]);
    candidates.length = 0;
    for (const list of groups.values()) {
      if (list.length === 1) { candidates.push(list[0]!); continue; }
      list.sort((a, b) => String(b.page.last_edited_time).localeCompare(String(a.page.last_edited_time)));
      const keep = list[0]!;
      dupes.push({ home: keep.prop["name"], orId: keep.orId, pages: list.map((c) => `${c.values["Property"]} (${c.page.id})`) });
      const merged: Json = { ...keep.values };
      for (const k of new Set(list.flatMap((c) => Object.keys(c.values)))) {
        const vals = list.map((c) => c.values[k]).filter((v) => !(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)));
        const distinct = [...new Set(vals.map((v) => JSON.stringify(v)))];
        if (distinct.length === 0) merged[k] = keep.values[k] ?? null;
        else if (distinct.length === 1) merged[k] = vals[0];
        else if (k === "Property") merged[k] = keep.values[k];
        else {
          merged[k] = null;
          if (mapping.some((m) => m.name === k && (m.action === "Import" || m.action === "External Link"))) dupeConflicts.push({ c: keep, field: k, values: distinct });
        }
      }
      candidates.push({ ...keep, values: merged, otherRaw: list.slice(1).map((c) => c.page.properties ?? {}) });
    }
  }

  const homes: HomePlan[] = [];
  for (const c of candidates) {
    const prop = c.prop;
    const columns: Json = {};
    const groups: Record<string, Json> = {};
    const provenance: string[] = [];
    const links: LinkInsert[] = [];
    const invalid: HomePlan["invalid"] = [];
    const ownConflicts: { field: string; current: any; notion: any }[] = [];
    const redactedKeys = new Set<string>();
    const rawByKey = new Map<string, string>();
    let gpsDiff = false;

    const put = (path: string[], value: any, sourceField: string) => {
      if (value === null || value === undefined || value === "") return;
      const key = path.join(".");
      if (typeof value === "string") {
        if (value.trim() === "" || value.trim() === "undefined") return;
        const s = scrub(value);
        if (s.redacted) { secretsRedacted += s.redacted; redactedKeys.add(key); rawByKey.set(key, value); }
        value = s.text;
      }
      if (WRITE_PROTECTED.has(path[0]!)) { invalid.push({ field: sourceField, value: "", reason: `write-protected target ${key}` }); return; }
      if (path.length === 1) columns[path[0]!] = value;
      else {
        const g = (groups[path[0]!] ??= {});
        let node = g;
        for (const seg of path.slice(1, -1)) node = node[seg] ??= {};
        node[path[path.length - 1]!] = value;
      }
      if (!rawByKey.has(key)) rawByKey.set(key, typeof c.values[sourceField] === "string" ? c.values[sourceField] : JSON.stringify(c.values[sourceField] ?? null));
      provenance.push(key);
    };
    const addLink = (url: string, sourceField: string, over: Json = {}) => {
      if (!/^https?:\/\//i.test(url)) return;
      const meta = linkKindFor(url);
      links.push({
        kind: over["kind"] ?? meta.kind, url, label: over["label"] ?? null, context: over["context"] ?? null,
        staff_only: over["staff_only"] ?? meta.staffOnly, canonical: over["canonical"] ?? meta.canonical,
        needs_replacement: over["needs_replacement"] ?? false, source: "notion_pid", source_field: sourceField,
        as_of: c.asOf, note: over["note"] ?? null,
      });
    };
    const conflict = (field: string, current: any, notion: any) => ownConflicts.push({ field, current, notion });

    for (const m of mapping) {
      if (CREDENTIAL_FIELDS.has(m.name)) continue;
      if (m.action !== "Import" && m.action !== "External Link" && m.name !== "GPS Coordinates") continue;
      const v = c.values[m.name];
      const blank = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
      if (blank && m.type !== "checkbox") { blanksSkipped += 1; continue; }

      switch (m.name) {
        case "Greater Area": {
          const hit = MARKETS.find((mk) => mk.toLowerCase() === String(v).trim().toLowerCase());
          if (!hit) { invalid.push({ field: m.name, value: String(v), reason: "unknown market" }); break; }
          if (!prop["market"]) put(["market"], hit, m.name);
          else if (prop["market"] !== hit) conflict("market", prop["market"], hit);
          break;
        }
        case "Status": {
          const s = String(v).trim();
          const lifecycle = s === "In Preparation" || s === "Live - Onboarding in Progress" ? "onboarding" : null;
          if (s === "Live_12M") put(["min_stay_months"], 12, m.name);
          if (lifecycle && !prop["handoff_accepted_at"] && prop["lifecycle_status"] !== "active_operations") put(["lifecycle_status"], lifecycle, m.name);
          break;
        }
        case "Handoff Date": {
          if (prop["handoff_accepted_at"]) break; // Resolve wins, never overwritten
          put(["legacy_handoff_date"], String(v).slice(0, 10), m.name);
          break;
        }
        case "Bedrooms":
        case "Bathrooms":
        case "Occupancy Limit": {
          const col = m.name === "Bedrooms" ? "bedrooms" : m.name === "Bathrooms" ? "bathrooms" : "max_guests";
          const pid = Number(v);
          if (!Number.isFinite(pid) || pid <= 0 || pid >= 30) { invalid.push({ field: m.name, value: String(v), reason: "out of range" }); break; }
          const current = prop[col];
          if (current == null) put([col], pid, m.name);
          else if (Number(current) !== pid) conflict(col, current, pid);
          break;
        }
        case "Square Footage": {
          const n = toInt(v);
          if (n == null || n < 100 || n > 20000) { invalid.push({ field: m.name, value: String(v), reason: "unparseable" }); break; }
          if (prop["living_area_sqft"] == null) put(["living_area_sqft"], n, m.name);
          else if (Number(prop["living_area_sqft"]) !== n) conflict("living_area_sqft", prop["living_area_sqft"], n);
          break;
        }
        case "Property Built Year": {
          const y = toInt(v);
          if (y == null || y < 1900 || y > new Date().getFullYear()) { invalid.push({ field: m.name, value: String(v), reason: "out of range" }); break; }
          put(["year_built"], y, m.name);
          break;
        }
        case "Smoke Detector Expiration": {
          const parsed = parseExpiry(String(v));
          if (!parsed) { invalid.push({ field: m.name, value: String(v), reason: "unparseable date" }); break; }
          put(["systems", "smoke", "expires_on"], parsed.date, m.name);
          put(["systems", "smoke", "expires_precision"], parsed.precision, m.name);
          put(["systems", "smoke", "expires_source_text"], String(v).slice(0, 200), m.name);
          break;
        }
        case "Sprinkler System Set for Season?":
          put(["sprinklers", "set_for_season"], { value: yesNo(v), as_of: c.asOf, source: "notion_pid" }, m.name);
          break;
        case "Rental Restriction Notes":
          put(["compliance", "rental_restrictions"], { text: String(v).slice(0, 1000), as_of: c.asOf, source: "notion_pid", reference_only: true }, m.name);
          break;
        case "Permit Review Status & Notes":
          put(["compliance", "permit_status"], { text: String(v).slice(0, 1000), as_of: c.asOf, source: "notion_pid", reference_only: true }, m.name);
          break;
        case "Number of Trash Carts": {
          const n = toInt(v);
          if (n != null && n > 0 && n < 20) put(["waste", "cart_count"], n, m.name);
          put(["waste", "cart_notes"], String(v).slice(0, 300), m.name);
          break;
        }
        case "Air Filter Sizes": {
          const sizes = [...new Set((String(v).match(/\d{1,2}\s*[x×]\s*\d{1,2}\s*[x×]\s*\d{1,2}/gi) ?? []).map((s) => s.replace(/\s+/g, "").replace(/×/g, "x").toLowerCase()))];
          if (sizes.length) put(["hvac", "filter_sizes"], sizes, m.name);
          put(["hvac", "filter_notes"], String(v).slice(0, 500), m.name);
          break;
        }
        case "GPS Coordinates": {
          // OwnerRez owns the pin. A PID pin is never written; a difference is listed.
          const mm = String(v).match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
          if (!mm) { invalid.push({ field: m.name, value: String(v), reason: "unparseable" }); break; }
          const lat = Number(mm[1]);
          const lng = Number(mm[2]);
          if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { invalid.push({ field: m.name, value: String(v), reason: "out of range" }); break; }
          if (prop["latitude"] != null && prop["longitude"] != null) {
            if (Math.abs(lat - Number(prop["latitude"])) > 0.001 || Math.abs(lng - Number(prop["longitude"])) > 0.001) gpsDiff = true;
            break;
          }
          columns["latitude"] = lat;
          columns["longitude"] = lng;
          provenance.push("latitude", "longitude");
          break;
        }
        case "OR Property Link":
        case "BW Property Link": {
          const path = targetPath(m.target)!;
          put(path, String(v).trim(), m.name);
          addLink(String(v).trim(), m.name, { kind: "system", canonical: true, label: m.name });
          break;
        }
        case "Security Camera Feed":
          for (const u of urlsIn(String(v))) addLink(u, m.name, { kind: "camera_portal", staff_only: true, label: "Camera portal", note: "Portal reference only — no credentials stored." });
          break;
        case "Pool & Hot Tub Technician Form":
          for (const u of urlsIn(String(v))) addLink(u, m.name, { kind: "fillout_form", needs_replacement: true, label: "Pool & hot tub technician form", note: "Temporary external form — to be replaced by a Resolve workflow." });
          break;
        case "Furniture Pick List Link":
          for (const u of urlsIn(String(v))) addLink(u, m.name, { kind: "legacy_onedrive", canonical: false, label: "Furniture pick list (legacy OneDrive)", note: "Legacy OneDrive link — not a Resolve document. Pending SharePoint migration." });
          break;
        case "Listing Photos":
          break; // excluded: OwnerRez photos remain authoritative
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
          if (typeof v === "string" && /https?:\/\//.test(v)) {
            const ctx = /HOA/i.test(m.name) ? "hoa" : /Warranty|Builder/i.test(m.name) ? "warranty" : "reference";
            for (const u of urlsIn(v)) addLink(u, m.name, { context: ctx });
          }
          break;
        }
      }
    }

    // ---- refresh classification
    const ownerRezKeys = new Set<string>(["link:OR Property Link"]);
    for (const m of mapping) if (m.authority === "OwnerRez") { const t = targetPath(m.target); if (t) ownerRezKeys.add(t.join(".")); }
    const imported = pidHomes.has(prop["id"]);
    const changes: Change[] = [];
    let unchanged = 0;
    const base0 = { orId: c.orId, home: prop["name"], propertyId: prop["id"], pageId: c.page.id };
    const seen = new Set<string>();
    for (const fieldKey of provenance) {
      if (seen.has(fieldKey)) continue;
      seen.add(fieldKey);
      const path = fieldKey.split(".");
      const notion = path.length === 1 ? columns[path[0]!] : getPath(groups[path[0]!], path.slice(1));
      const current = getPath(prop, path);
      const prov = provBy.get(`${prop["id"]}|${fieldKey}`);
      const base = { ...base0, field: fieldKey, path, current, notion, prov: prov ? { value_source: prov.value_source, updated_at: prov.updated_at ?? null } : null };
      if (sameValue(current, notion)) { unchanged += 1; continue; }
      const ownerRezOwned = OWNERREZ_COLUMNS.has(path[0]!) || ownerRezKeys.has(fieldKey) || String(prov?.value_source ?? "").startsWith("ownerrez");
      const since = prov?.updated_at ?? prov?.as_of ?? "1970-01-01";
      const changedSinceCopy = snap.changedSinceCopy?.has(`${prop["id"]}|${fieldKey}`) ?? false;
      const edited = changedSinceCopy || (editsBy.get(`${prop["id"]}|${fieldKey}`) ?? []).some((at) => !imported || at > since);
      if (ownerRezOwned) { changes.push({ ...base, kind: "conflict", conflictWith: "OwnerRez", reason: "OwnerRez-owned field; never written" }); continue; }
      // The home's status is Resolve workflow: the PID may only fill it, never change it.
      if (RESOLVE_WORKFLOW.has(path[0]!) && !isBlankValue(current)) { changes.push({ ...base, kind: "conflict", conflictWith: "Resolve", reason: "Resolve sets the home's status" }); continue; }
      if (isBlankValue(current)) {
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
    const keptLinks: LinkInsert[] = [];
    const seenLink = new Set<string>();
    for (const l of links) {
      const k = `${prop["id"]}|${l.kind}|${l.url}`;
      if (linkSet.has(k) || seenLink.has(k)) continue;
      seenLink.add(k);
      const lbase = { ...base0, field: `link:${l.source_field}`, path: [] as string[], current: null, notion: l.url };
      if (ownerRezKeys.has(`link:${l.source_field}`)) { changes.push({ ...lbase, kind: "conflict", conflictWith: "OwnerRez", reason: "OwnerRez-owned link; never written" }); continue; }
      keptLinks.push(l);
      changes.push({ ...lbase, kind: "fill", conflictWith: "", reason: `new ${l.kind} link` });
    }
    for (const x of ownConflicts) {
      changes.push({ ...base0, field: x.field, path: [x.field], current: x.current, notion: x.notion, kind: "conflict",
        conflictWith: x.field === "market" ? "Resolve" : "OwnerRez",
        reason: x.field === "market" ? "Resolve market differs" : "OwnerRez value differs; OwnerRez wins" });
    }
    for (const d of dupeConflicts.filter((d) => d.c.prop["id"] === prop["id"])) {
      changes.push({ ...base0, field: `notion:${d.field}`, path: [], current: null, notion: d.values.join(" | "), kind: "conflict", conflictWith: "Notion", reason: "two PID pages on this OwnerRez ID disagree; nothing proposed" });
    }
    if (gpsDiff) {
      changes.push({ ...base0, field: "latitude,longitude", path: [], current: `${prop["latitude"]}, ${prop["longitude"]}`, notion: c.values["GPS Coordinates"], kind: "conflict", conflictWith: "OwnerRez", reason: "PID pin more than 0.001 from the Resolve pin" });
    }

    // ---- code safety net: text that may hold a code is never copied, and never shown.
    const MASK = "[withheld: may contain a code]";
    const withheld: Withheld[] = [];
    const kept: Change[] = [];
    for (const ch of changes) {
      const isLink = ch.field.startsWith("link:");
      const n = suspect(ch.notion) || (opts.withholdRedacted && !isLink && redactedKeys.has(ch.field));
      const r = suspect(ch.current);
      if (!n && !r) { kept.push(ch); continue; }
      if (ch.kind === "fill" || ch.kind === "update") {
        withheld.push({ field: ch.field, kind: ch.kind, side: [n ? "Notion" : "", r ? "Resolve" : ""].filter(Boolean).join(" and "), notionRaw: n ? rawByKey.get(ch.field) ?? null : null });
        continue;
      }
      kept.push({ ...ch, notion: n ? MASK : ch.notion, current: r ? MASK : ch.current });
    }
    const safeLinks = keptLinks.filter((l) => !suspect(l.url));
    const finalChanges = kept.filter((ch) => !(ch.field.startsWith("link:") && ch.kind === "fill" && !safeLinks.some((l) => `link:${l.source_field}` === ch.field && l.url === ch.notion)));

    homes.push({
      ...base0, asOf: c.asOf, imported, changes: finalChanges, links: safeLinks, withheld, invalid, unchanged,
      raw: c.raw, otherRaw: c.otherRaw,
    });
  }

  return { homes, unmatched, dupes, unmappedNotionFields, trimMatched, blanksSkipped, secretsRedacted };
}

/** The writes a home's plan makes: fills and updates on a property field (links are separate). */
export function homeWrites(h: HomePlan) {
  return h.changes.filter((c) => (c.kind === "fill" || c.kind === "update") && c.path.length > 0);
}
