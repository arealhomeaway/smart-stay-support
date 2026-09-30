/**
 * One-time Notion → Resolve vendor migration staging (server-only).
 * Never a live sync. Rows are staged with review states and duplicate
 * signals; a human imports or skips each one. Nothing auto-merges.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  duplicateMatches,
  isTransitionalEligible,
  mapNotionCategory,
  mapNotionPreference,
  parseLegacyPreference,
  reviewStatesFor,
  stageNotionCsv,
} from "./vendor-gold";

type BzPerson = { breezeway_person_id: number; first_name: string | null; last_name: string | null; email: string | null };
const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Deterministic Breezeway reconciliation: exact email, then exact normalized
 * person name (contact or company). Never fuzzy; ambiguity is flagged for review.
 * The Notion "in Breezeway" tick is only a hint.
 */
export type BzMatchState = "email" | "unique_name" | "ambiguous" | "not_found";
/** Deterministic only: exact email, else unique exact name (candidate — needs confirmation), else ambiguous/not found. */
export function matchBreezeway(
  row: { email: string | null; contact_person: string | null; company: string | null; breezeway_hint: boolean | null },
  people: BzPerson[],
): { state: BzMatchState; personId: number | null; note: string } {
  const email = (row.email ?? "").trim().toLowerCase();
  if (email) {
    const hits = people.filter((p) => (p.email ?? "").trim().toLowerCase() === email);
    if (hits.length === 1) return { state: "email", personId: hits[0]!.breezeway_person_id, note: "Exact email match." };
    if (hits.length > 1) return { state: "ambiguous", personId: null, note: `${hits.length} Breezeway people share this email.` };
  }
  const names = [...new Set([row.contact_person, row.company].map((n) => norm((n ?? "").split(",")[0])).filter((n) => n.length >= 5))];
  const found = new Map<number, BzPerson>();
  let multi = false;
  for (const n of names) {
    const hits = people.filter((p) => norm(`${p.first_name ?? ""}${p.last_name ?? ""}`) === n);
    if (hits.length > 1) multi = true;
    hits.forEach((h) => found.set(h.breezeway_person_id, h));
  }
  if (multi || found.size > 1) return { state: "ambiguous", personId: null, note: "More than one Breezeway person has this name — confirm manually." };
  if (found.size === 1) {
    const only = [...found.values()][0]!;
    return { state: "unique_name", personId: only.breezeway_person_id, note: "Unique exact-name match — confirm before linking." };
  }
  return { state: "not_found", personId: null, note: row.breezeway_hint ? "Notion says Breezeway, but no exact match was found." : "No Breezeway match." };
}

type Client = SupabaseClient<Database>;

async function assertSupervisor(db: Client, userId: string) {
  const { data } = await db.rpc("is_supervisor", { _user_id: userId });
  if (!data) throw new Error("Only managers and supervisors can stage vendor migrations.");
}

export async function stageNotion(db: Client, userId: string, input: { label: string; csv: string }) {
  await assertSupervisor(db, userId);
  const staged = stageNotionCsv(input.csv);
  if (!staged.length) throw new Error("No vendor rows found. Export the Notion database as CSV with a header row.");
  if (staged.length > 2000) throw new Error("That file has more than 2,000 rows. Split it and stage each part.");

  const { data: existing } = await db
    .from("vendor_orgs")
    .select("id, display_name, primary_contact_email, primary_contact_phone, website");
  const pool = (existing ?? []).map((v) => ({
    id: v.id,
    name: v.display_name,
    email: v.primary_contact_email,
    phone: v.primary_contact_phone,
    website: v.website,
  }));

  const { data: bz } = await db.from("breezeway_people").select("breezeway_person_id, first_name, last_name, email");
  const people = (bz ?? []) as BzPerson[];

  const { data: batch, error: batchErr } = await db
    .from("vendor_import_batches")
    .insert({ source_system: "notion", label: input.label, status: "staged", created_by: userId })
    .select("id")
    .single();
  if (batchErr) throw new Error(batchErr.message);

  // Duplicates inside the file are flagged too (against earlier staged rows).
  const seen: { id: string; name: string; email: string | null; phone: string | null; website: string | null }[] = [];
  const rows = staged.map((s, i) => {
    const tempId = `row-${i}`;
    const probe = { id: tempId, name: s.company ?? "", email: s.email, phone: s.phone, website: s.website };
    const dupes = duplicateMatches(probe, pool);
    const inFile = duplicateMatches(probe, seen).length > 0;
    seen.push(probe);
    const review_states = reviewStatesFor({
      company: s.company,
      phone: s.phone,
      email: s.email,
      markets: s.markets,
      specialties: s.specialties,
      breezewayPersonId: null,
      legacyStatus: s.legacy_status,
      preference: s.preference,
      duplicates: inFile ? [...dupes, "in-file"] : dupes,
    });
    const bzMatch = matchBreezeway(s, people);
    return {
      transitional_eligible: isTransitionalEligible(s.legacy_status, s.preference),
      breezeway_match_state: bzMatch.state,
      breezeway_match_person_id: bzMatch.personId,
      breezeway_match_note: bzMatch.note,
      batch_id: batch.id,
      source_system: "notion",
      source_role: "vendor",
      raw: s.raw as unknown as Json,
      display_name: s.company ?? "(no company name)",
      company: s.company,
      contact_person: s.contact_person,
      email: s.email,
      phone: s.phone,
      markets: s.markets,
      specialties: s.specialties,
      preference: s.preference,
      website: s.website,
      pricing: s.pricing,
      comments: s.comments,
      payment_type: s.payment_type,
      breezeway_hint: s.breezeway_hint,
      legacy_status: s.legacy_status,
      tags: s.tags,
      legacy_notion_id: s.legacy_notion_id,
      legacy_fields: s.legacy_fields as unknown as Json,
      review_states,
      duplicate_candidates: dupes,
      proposed_action: review_states.includes("ready") ? "create" : "review",
      decision: "pending",
    };
  });
  const { error } = await db.from("vendor_import_rows").insert(rows as never);
  if (error) throw new Error(error.message);
  return { batchId: batch.id, staged: rows.length };
}

export async function loadNotionStaging(db: Client, userId: string) {
  await assertSupervisor(db, userId);
  const { data, error } = await db
    .from("vendor_import_rows")
    .select(
      "id, batch_id, transitional_eligible, breezeway_match_state, breezeway_match_person_id, breezeway_match_note, company, contact_person, email, phone, markets, specialties, preference, website, legacy_status, breezeway_hint, review_states, duplicate_candidates, legacy_fields, decision, created_org_id, created_at",
    )
    .eq("source_system", "notion")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function decideNotionRow(
  db: Client,
  userId: string,
  input: { rowId: string; action: "import" | "skip"; note?: string | null | undefined },
) {
  await assertSupervisor(db, userId);
  const { data: row, error } = await db.from("vendor_import_rows").select("*").eq("id", input.rowId).single();
  if (error || !row) throw new Error("That staged row no longer exists.");
  if (row.decision !== "pending") throw new Error("This row has already been decided.");

  if (input.action === "skip") {
    await db
      .from("vendor_import_rows")
      .update({ decision: "skip", decided_by: userId, decided_at: new Date().toISOString(), decision_note: input.note ?? null })
      .eq("id", row.id);
    return { ok: true };
  }
  if (!row.company?.trim()) throw new Error("A company name is needed before import.");

  const [{ data: markets }, { data: cats }] = await Promise.all([
    db.from("vendor_markets").select("code"),
    db.from("vendor_service_categories").select("label"),
  ]);
  const marketSet = new Set((markets ?? []).map((m) => m.code.toLowerCase()));
  const catSet = new Map((cats ?? []).map((c) => [c.label.toLowerCase(), c.label]));
  const knownMarkets = row.markets.filter((m) => marketSet.has(m.toLowerCase()));
  const mapped = row.specialties.map((s) => mapNotionCategory(s, catSet));
  const knownCats = [...new Set(mapped.filter(Boolean) as string[])];
  const unmappedSpecialties = row.specialties.filter((_, i) => !mapped[i]);
  const legacy = {
    ...((row.legacy_fields as Record<string, unknown>) ?? {}),
    ...(row.breezeway_hint != null ? { "Notion: in Breezeway (unverified)": row.breezeway_hint } : {}),
    ...(row.legacy_status ? { "Notion: vendor status": row.legacy_status } : {}),
    ...(row.markets.length !== knownMarkets.length ? { "Notion: market (unmapped)": row.markets.join(", ") } : {}),
    ...(row.specialties.length ? { "Notion: specialty": row.specialties.join(", ") } : {}),
    ...(unmappedSpecialties.length ? { "Notion: specialty (unmapped)": unmappedSpecialties.join(", ") } : {}),
    ...(row.preference ? { "Notion: preference": row.preference } : {}),
    ...(() => {
      const lp = parseLegacyPreference(row.preference);
      return {
        ...(lp.rank != null ? { "Legacy preference rank": String(lp.rank) } : {}),
        ...(lp.emergencyOnly ? { "Restriction: Emergency only": "yes" } : {}),
        ...(lp.homeOwnersVendor ? { "Restriction: Home Owner's Vendor": "yes" } : {}),
        ...(lp.headCleaner ? { "Designation: Head Cleaner": "yes" } : {}),
      };
    })(),
  };

  const { data: org, error: orgErr } = await db
    .from("vendor_orgs")
    .insert({
      display_name: row.company.trim(),
      legal_name: row.company.trim(),
      vendor_class: "company",
      status: "candidate",
      // Temporary migration flag only — never a lifecycle status. The database re-checks eligibility.
      transitional_review: row.transitional_eligible && isTransitionalEligible(row.legacy_status, row.preference),
      // Only an exact-email match links automatically; unique-name matches need a person to confirm.
      breezeway_person_id: row.breezeway_match_state === "email" && row.breezeway_match_person_id ? String(row.breezeway_match_person_id) : null,
      dispatch_method: row.breezeway_match_state === "email" && row.breezeway_match_person_id ? "breezeway" : "setup_incomplete",
      primary_contact_name: row.contact_person,
      primary_contact_email: row.email,
      primary_contact_phone: row.phone,
      website: row.website,
      pricing_note: row.pricing,
      payment_terms: row.payment_type,
      notes: row.comments,
      tags: row.tags,
      markets: knownMarkets,
      service_categories: knownCats,
      source_system: "notion",
      emergency_only: parseLegacyPreference(row.preference).emergencyOnly,
      legacy_notion_id: row.legacy_notion_id,
      migration_status: "imported_needs_review",
      legacy_fields: legacy as Json,
      created_by: userId,
    } as never)
    .select("id")
    .single();
  if (orgErr) throw new Error(orgErr.message);

  const pref = mapNotionPreference(row.preference);
  const coverage = knownMarkets.flatMap((m) =>
    knownCats.map((c) => ({ org_id: org.id, market: [...(markets ?? [])].find((x) => x.code.toLowerCase() === m.toLowerCase())!.code, service_category: c, preference: pref })),
  );
  if (coverage.length) await db.from("vendor_market_coverage").insert(coverage);

  await db
    .from("vendor_import_rows")
    .update({ decision: "create", created_org_id: org.id, decided_by: userId, decided_at: new Date().toISOString(), decision_note: input.note ?? null })
    .eq("id", row.id);
  return { ok: true, orgId: org.id };
}
