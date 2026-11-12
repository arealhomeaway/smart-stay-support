/**
 * Nightly PID copy (approved by the Admin, Nov 12, 2026). Runs on the existing five-minute job
 * (src/routes/api/public/hooks/owner-notify.ts), only while the pid_nightly_sync switch is on, starting
 * in the 2 AM Central hour. Each run is one integration_events row (system notion_pid) read on
 * Integrations, with its review list in pid_sync_review_items. Each home is written in one database
 * transaction (pid_sync_apply_home); a pass that runs long stops between homes and the next pass
 * continues. This function never throws: a failure is recorded on the run and the job moves on.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { HOME_PROFILE_SECTIONS } from "@/lib/home-profile";
import { decryptSecret, encryptSecret } from "@/lib/credentials.server";
import { PID_MAPPING_V1 } from "./mapping-v1";
import { homeWrites, planPidRefresh, type HomePlan, type PidPage, type PidSnapshot } from "./plan";
import { plain, suspect, targetPath, type Json } from "./transforms";
import { CREDENTIAL_FIELD_RULES, intakeCategory, isPlaceholder, planCredential, type ExistingCredential } from "./credentials-plan";
import { extraText, extraValue, pidExtraFields, type ExtraValue } from "./extras";
import { PID_SYNC_PASS_BUDGET_MS, centralDate, pidSyncPassAction } from "./schedule";
import { fetchPidPages, fetchPidRelationSources, fetchTitles } from "./notion.server";

// New tables and functions are staged (docs/pending/pid-nightly-sync); typed loosely until applied.
type Db = SupabaseClient<any, any, any>;
export const PID_SYNC_SYSTEM = "notion_pid";
export const PID_SYNC_OPERATION = "nightly_sync";
export const PID_SYNC_FLAG = "pid_nightly_sync";

export type PidRunCounts = {
  homes_touched: number; fills: number; updates: number; skipped: number; conflicts: number; errors: number;
  links: number; extras: number; codes: number; codes_for_review: number;
};
export type PidRunPayload = {
  as_of: string; passes: number; done: string[]; counts: PidRunCounts;
  errors: { home: string; message: string }[];
  unmatched?: { label: string; ownerrez: string | null; reason: string }[];
  unmapped_fields?: string[]; extra_fields?: string[]; finished_at?: string;
};
const zero = (): PidRunCounts => ({ homes_touched: 0, fills: 0, updates: 0, skipped: 0, conflicts: 0, errors: 0, links: 0, extras: 0, codes: 0, codes_for_review: 0 });

/** One review-list row, as the database function stores it. */
export type ReviewRow = { home: string; ownerrez_id: string; field_key: string; kind: string; resolve_value: string | null; notion_value: string | null; reason: string };

const short = (v: unknown) => {
  if (v === undefined || v === null) return null;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 500 ? `${s.slice(0, 500)}…` : s;
};

/** Profile edit item → the field key it changes (the same map the database edit function uses). */
const ITEM_FIELD = new Map<string, string>();
for (const s of HOME_PROFILE_SECTIONS) for (const i of s.items) {
  const src: any = i.src;
  if (src.kind === "column") ITEM_FIELD.set(i.key, src.column);
  else if (src.kind === "json") ITEM_FIELD.set(i.key, `${src.column}.${src.path.join(".")}`);
  else if (src.kind === "link") ITEM_FIELD.set(i.key, `link:${src.sourceField}`);
}
/** Field key → the PID field name (for wording on the code list). */
const FIELD_NAME = new Map<string, string>();
for (const m of PID_MAPPING_V1) { const t = targetPath(m.target); if (t) FIELD_NAME.set(t.join("."), m.name); }

/** The review list for one home: everything the plan did not copy. Values that may hold a code never appear. */
export function reviewRows(h: HomePlan): ReviewRow[] {
  const base = { home: h.home, ownerrez_id: h.orId };
  const rows: ReviewRow[] = [];
  for (const c of h.changes) {
    if (c.kind !== "conflict") continue;
    rows.push({ ...base, field_key: c.field, kind: c.conflictWith === "OwnerRez" ? "ownerrez" : c.conflictWith === "Notion" ? "pid_pages_disagree" : "resolve_changed", resolve_value: short(c.current), notion_value: short(c.notion), reason: c.reason });
  }
  for (const w of h.withheld) {
    rows.push({ ...base, field_key: w.field, kind: "withheld", resolve_value: null, notion_value: null,
      reason: w.side.includes("Notion") ? "May contain a code. Sent to the code list for review; not copied." : "The text in Resolve may contain a code; not copied." });
  }
  for (const i of h.invalid) {
    rows.push({ ...base, field_key: i.field, kind: "invalid", resolve_value: null, notion_value: suspect(i.value) ? null : short(i.value), reason: i.reason });
  }
  return rows;
}

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function fingerprint(text: string): Promise<string> {
  const raw = process.env["CREDENTIAL_ENCRYPTION_KEY"];
  if (!raw) throw new Error("Credential storage is not configured.");
  const k = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pid-fingerprint:${raw}`));
  const key = await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const credText = (v: any): string | null => { const p = plain(v); return p == null ? null : String(p).trim() || null; };

export async function runNightlyPidSync(admin: SupabaseClient<any>, now = new Date(), budgetMs = PID_SYNC_PASS_BUDGET_MS) {
  const db = admin as Db;
  let runId: string | null = null;
  const fail = async (message: string) => {
    if (runId) await db.from("integration_events").update({ status: "failed", error_message: message.slice(0, 1000) }).eq("id", runId);
    return { skipped: false, failed: message };
  };
  try {
    const { data: flag } = await db.from("feature_flags").select("enabled").eq("key", PID_SYNC_FLAG).maybeSingle();
    const { data: lastRows } = await db.from("integration_events").select("id, status, created_at, request_payload")
      .eq("system", PID_SYNC_SYSTEM).eq("operation", PID_SYNC_OPERATION).order("created_at", { ascending: false }).limit(1);
    const last = (lastRows ?? [])[0] as { id: string; status: string; created_at: string; request_payload: PidRunPayload } | undefined;
    if (flag?.enabled !== true) {
      if (last?.status === "processing") await db.from("integration_events").update({ status: "failed", error_message: "Stopped: the nightly copy was switched off." }).eq("id", last.id);
      return { skipped: "off" };
    }
    let action = pidSyncPassAction(now, last ?? null);
    if (action === "close_stale") {
      await db.from("integration_events").update({ status: "failed", error_message: "The run did not finish." }).eq("id", last!.id);
      action = pidSyncPassAction(now, { status: "failed", created_at: last!.created_at });
    }
    if (action === "wait" || action === "close_stale") return { skipped: true };

    let payload: PidRunPayload;
    if (action === "continue") {
      runId = last!.id;
      payload = { ...last!.request_payload, passes: (last!.request_payload?.passes ?? 0) + 1 };
    } else {
      payload = { as_of: centralDate(now), passes: 1, done: [], counts: zero(), errors: [] };
      const { data: run, error } = await db.from("integration_events")
        .insert({ system: PID_SYNC_SYSTEM, direction: "inbound", operation: PID_SYNC_OPERATION, status: "processing", request_payload: payload })
        .select("id").single();
      if (error || !run) return { skipped: false, failed: `Could not record the run: ${error?.message ?? "unknown"}` };
      runId = run.id as string;
    }
    const save = () => db.from("integration_events").update({ request_payload: payload }).eq("id", runId!);

    // Notion first: if it cannot be reached, nothing is written.
    let pages: PidPage[];
    let relationSources: Record<string, string>;
    try {
      [pages, relationSources] = await Promise.all([fetchPidPages(), fetchPidRelationSources()]);
    } catch (e) {
      return await fail(`Notion could not be reached; nothing was copied. ${e instanceof Error ? e.message : String(e)}`);
    }
    const fieldTypes: Record<string, string> = {};
    for (const p of pages) for (const [k, v] of Object.entries<any>(p.properties ?? {})) fieldTypes[k] = v?.type ?? fieldTypes[k] ?? "unknown";
    const extraFields = pidExtraFields(fieldTypes);
    let titles: Map<string, string>;
    try {
      titles = await fetchTitles(extraFields.map((f) => relationSources[f]).filter((x): x is string => !!x));
    } catch (e) {
      return await fail(`Notion could not be reached; nothing was copied. ${e instanceof Error ? e.message : String(e)}`);
    }

    // Resolve as it is now.
    const snapshotAt = new Date().toISOString();
    const [props, prov, edits, facts, links, changed, extras, creds, credLinks] = await Promise.all([
      all<Json>((a, b) => db.from("properties").select("*").eq("is_demo", false).not("ownerrez_property_id", "is", null).order("id").range(a, b)),
      all<any>((a, b) => db.from("property_field_provenance").select("property_id, field_key, value_source, as_of, updated_at").order("id").range(a, b)),
      all<any>((a, b) => db.from("property_profile_edits").select("property_id, item_key, edited_at").order("id").range(a, b)),
      all<any>((a, b) => db.from("property_fact_proposals").select("property_id, field_key, reviewed_at").eq("status", "accepted").order("id").range(a, b)),
      all<any>((a, b) => db.from("property_external_links").select("property_id, kind, url").order("id").range(a, b)),
      all<any>((a, b) => db.rpc("pid_sync_changed_since_copy").range(a, b)),
      all<any>((a, b) => db.from("property_pid_extra_fields").select("property_id, field_name, value").order("property_id").order("field_name").range(a, b)),
      all<any>((a, b) => db.from("property_credentials").select("id, property_id, label, source, active, updated_at, secret_ciphertext, secret_nonce").order("id").range(a, b)),
      all<any>((a, b) => db.rpc("pid_sync_credential_links_read").range(a, b)),
    ]);
    const snap: PidSnapshot = {
      properties: props,
      provenance: prov,
      edits: [
        ...edits.map((e) => ({ property_id: e.property_id, field_key: ITEM_FIELD.get(e.item_key) ?? e.item_key, at: e.edited_at })),
        ...facts.filter((f) => f.reviewed_at).map((f) => ({ property_id: f.property_id, field_key: f.field_key, at: f.reviewed_at })),
      ],
      links,
      changedSinceCopy: new Set(changed.map((c) => `${c.property_id}|${c.field_key}`)),
    };
    const plan = planPidRefresh(pages, snap, { withholdRedacted: true });
    payload.unmatched = plan.unmatched.map((u) => ({ label: u.label, ownerrez: u.ownerrez, reason: u.reason }));
    payload.unmapped_fields = plan.unmappedNotionFields;
    payload.extra_fields = extraFields;

    const extraBy = new Map(extras.map((x) => [`${x.property_id}|${x.field_name}`, stable(x.value)]));
    const credBy = new Map<string, any[]>();
    for (const c of creds) credBy.set(c.property_id, [...(credBy.get(c.property_id) ?? []), c]);
    const linkBy = new Map(credLinks.map((l) => [`${l.property_id}|${l.pid_field}`, l.credential_id as string]));
    const done = new Set(payload.done);
    const started = Date.now();

    for (const h of plan.homes) {
      if (done.has(h.propertyId)) continue;
      if (Date.now() - started > budgetMs) { await save(); return { skipped: false, continuing: true, done: payload.done.length }; }
      const review = reviewRows(h);
      const writes = homeWrites(h).map((w) => ({ path: w.path, expected: w.current ?? null, value: w.notion, prov: w.prov ?? null, kind: w.kind }));

      // From the PID: blank never clears; text that may hold a code is never stored here.
      const intake: { source_field: string; category: string; label: string; text: string }[] = [];
      const extraRows: { field_name: string; field_type: string; value: ExtraValue; as_of: string }[] = [];
      for (const f of extraFields) {
        const v = extraValue(h.raw[f], titles) ?? h.otherRaw.map((r) => extraValue(r[f], titles)).find(Boolean) ?? null;
        if (!v) continue;
        if (suspect(extraText(v))) {
          review.push({ home: h.home, ownerrez_id: h.orId, field_key: `pid:${f}`, kind: "withheld", resolve_value: null, notion_value: null, reason: "May contain a code. Sent to the code list for review; not copied." });
          intake.push({ source_field: `PID: ${f}`, category: intakeCategory(f), label: `Possible code in ${f}`, text: extraText(v) });
          continue;
        }
        if (extraBy.get(`${h.propertyId}|${f}`) === stable(v)) continue;
        extraRows.push({ field_name: f.trim(), field_type: fieldTypes[f] ?? "unknown", value: v, as_of: h.asOf });
      }
      for (const w of h.withheld) {
        if (!w.notionRaw) continue;
        const name = FIELD_NAME.get(w.field) ?? w.field;
        intake.push({ source_field: `PID: ${name}`, category: intakeCategory(name), label: `Possible code in ${name}`, text: w.notionRaw });
      }

      // Codes: only into the encrypted vault (Sep 1 rules).
      const credentials: Json[] = [];
      const homeCreds = credBy.get(h.propertyId) ?? [];
      for (const rule of CREDENTIAL_FIELD_RULES) {
        const raw = credText(h.raw[rule.field]) ?? h.otherRaw.map((r) => credText(r[rule.field])).find(Boolean) ?? null;
        const linkedId = linkBy.get(`${h.propertyId}|${rule.field}`);
        const rows = homeCreds.filter((c) => c.id === linkedId || c.label === rule.label);
        const existing: ExistingCredential[] = [];
        for (const r of rows) {
          let secret: string | null = null;
          try { secret = r.secret_ciphertext && r.secret_nonce ? await decryptSecret(r.secret_ciphertext, r.secret_nonce) : null; } catch { secret = null; }
          existing.push({ id: r.id, source: r.source ?? "staff_entry", active: r.active !== false, updated_at: r.updated_at, secret });
        }
        const d = planCredential(raw, rule, existing);
        const username = rule.usernameField ? credText(h.raw[rule.usernameField]) : null;
        const instructions = rule.instructionsField ? credText(h.raw[rule.instructionsField]) : null;
        const common = { pid_field: rule.field, category: rule.category, label: rule.label,
          username: username && !isPlaceholder(username) ? username : null,
          instructions: instructions && !isPlaceholder(instructions) ? instructions : null,
          last_verified_on: h.asOf.slice(0, 10) };
        if (d.op === "insert" || d.op === "update") {
          const { ciphertext, nonce } = await encryptSecret(raw!);
          credentials.push({ ...common, op: d.op, ciphertext, nonce, ...(d.op === "update" ? { id: d.id, expected_updated_at: d.expectedUpdatedAt } : {}) });
        } else if ((d.op === "same" || d.op === "kept") && !linkedId && rows.length === 1) {
          credentials.push({ op: "link", pid_field: rule.field, id: rows[0].id });
        }
        if (d.op === "kept") review.push({ home: h.home, ownerrez_id: h.orId, field_key: `code:${rule.label}`, kind: "code_kept", resolve_value: null, notion_value: null, reason: d.reason });
      }
      const intakeRows: Json[] = [];
      for (const i of intake) {
        const { ciphertext, nonce } = await encryptSecret(i.text);
        intakeRows.push({ source_field: i.source_field, category: i.category, label: i.label, ciphertext, nonce, fingerprint: await fingerprint(`${h.propertyId}|${i.source_field}|${i.text}`) });
      }

      const nothing = !writes.length && !h.links.length && !extraRows.length && !credentials.length && !intakeRows.length && !review.length;
      if (!nothing) {
        const { data, error } = await db.rpc("pid_sync_apply_home", {
          _run_id: runId, _property_id: h.propertyId, _page_id: h.pageId, _as_of: payload.as_of, _snapshot_at: snapshotAt,
          _writes: writes, _links: h.links, _extras: extraRows, _credentials: credentials, _intake: intakeRows, _review: review,
        });
        if (error) {
          const message = error.message.replace(/^PID copy: /, "");
          payload.errors.push({ home: h.home, message });
          payload.counts.errors += 1;
          await db.from("pid_sync_review_items").insert({ run_id: runId, property_id: h.propertyId, home: h.home, ownerrez_id: h.orId, field_key: "(home)", kind: "error", reason: `Nothing was copied for this home: ${message}` });
        } else {
          const r = (data ?? {}) as Record<string, number>;
          const c = payload.counts;
          c.fills += writes.filter((w) => w.kind === "fill").length + (r["links"] ?? 0);
          c.updates += writes.filter((w) => w.kind === "update").length;
          c.links += r["links"] ?? 0;
          c.extras += r["extras"] ?? 0;
          c.codes += r["codes"] ?? 0;
          c.codes_for_review += r["intake"] ?? 0;
          c.skipped += review.filter((x) => x.kind === "withheld" || x.kind === "invalid").length;
          c.conflicts += review.filter((x) => x.kind !== "withheld" && x.kind !== "invalid").length;
          if ((r["written"] ?? 0) + (r["links"] ?? 0) + (r["extras"] ?? 0) + (r["codes"] ?? 0) > 0) c.homes_touched += 1;
        }
      }
      payload.done.push(h.propertyId);
      done.add(h.propertyId);
      if (payload.done.length % 10 === 0) await save();
    }

    payload.finished_at = new Date().toISOString();
    const errs = payload.counts.errors;
    await db.from("integration_events").update({
      status: "completed",
      request_payload: payload,
      error_message: errs ? `${errs} home${errs === 1 ? "" : "s"} could not be copied; see the review list.` : null,
    }).eq("id", runId);
    return { skipped: false, completed: true, counts: payload.counts };
  } catch (e) {
    return await fail(`The nightly copy stopped: ${e instanceof Error ? e.message : String(e)}`);
  }
}
