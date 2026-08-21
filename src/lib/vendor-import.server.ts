/**
 * Legacy vendor migration staging (server-only).
 *
 * Nothing from Breezeway (or any other legacy list) becomes a live vendor on
 * its own. Rows land here with a PROPOSED action and the evidence behind it,
 * and a supervisor decides. Never guess: a personal email address is never
 * treated as proof that a person belongs to a company.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseCsvRecords } from "./csv";
import { assertSupervisor } from "./vendors.server";

type Client = SupabaseClient<Database>;

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "msn.com",
  "live.com",
  "comcast.net",
]);

/** What the Notion vendor database knows about a company, carried through review. */
export type LegacyProfile = {
  contactPerson: string | null;
  specialties: string[];
  markets: string[];
  serviceArea: string | null;
  pricing: string | null;
  paymentType: string | null;
  coverageHours: string | null;
  emergencyAvailability: string | null;
  website: string | null;
  restrictions: string | null;
  comments: string | null;
  preference: string | null;
  legacyStatus: string | null;
  claims: string[];
  insuranceExpiresOn: string | null;
  licenseExpiresOn: string | null;
  notionVendorId: string | null;
};

export type ParsedRow = {
  sourceRole: "service_provider" | "representative";
  displayName: string;
  email: string | null;
  phone: string | null;
  departments: string[];
  groups: string[];
  profile?: LegacyProfile | null;
};


function splitList(value: string) {
  return value
    .split(/[,;/]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Accepts pasted rows in the shape the legacy list exports:
 * `Name | Role | Email | Phone | Departments | Groups` (tab or comma separated).
 */
export function parseLegacyRows(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = (line.includes("\t") ? line.split("\t") : line.split(",")).map((c) => c.trim());
    const [name, role, email, phone, departments, groups] = cells;
    if (!name) continue;
    if (/^name$/i.test(name)) continue; // header row
    const roleText = (role ?? "").toLowerCase();
    rows.push({
      sourceRole: roleText.includes("service") || roleText.includes("provider") ? "service_provider" : "representative",
      displayName: name,
      email: email && email.includes("@") ? email.toLowerCase() : null,
      phone: phone || null,
      departments: departments ? splitList(departments) : [],
      groups: groups ? splitList(groups) : [],
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Notion vendor database export                                       */
/* ------------------------------------------------------------------ */

/** True when the pasted text is the ARHA Notion "Vendor Database" CSV export. */
export function looksLikeVendorDatabaseCsv(text: string) {
  const header = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  return /(^|,)"?Company"?,/i.test(header) && /Vendor Status|Specialty|Vendor ID/i.test(header);
}

function firstValue(record: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]?.trim();
    if (value) return value;
  }
  return null;
}

/** "August 12, 2026" or "2026-08-12" → an ISO date, or null when it isn't a date. */
function toIsoDate(value: string | null) {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (iso) return iso[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/** Yes/No columns become a sentence we can show, never a verification. */
function claim(record: Record<string, string>, column: string, label: string, claims: string[]) {
  const value = record[column]?.trim();
  if (!value) return;
  claims.push(`${label}: ${value}`);
}

/**
 * Reads the Notion vendor database export.
 *
 * Everything here is what Notion *recorded*, not what ARHA has verified. Yes/No
 * compliance columns come across as claims on the record so a supervisor can
 * check them — they never tick a screening gate on their own.
 */
export function parseVendorDatabaseCsv(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const record of parseCsvRecords(text)) {
    const company = firstValue(record, "Company", "Name");
    if (!company) continue;

    const claims: string[] = [];
    claim(record, "Insurance Current", "Insurance current", claims);
    claim(record, "License Current", "License current", claims);
    claim(record, "License Required", "License required", claims);
    claim(record, "License Number", "License number", claims);
    claim(record, "W-9 Received", "W-9 received", claims);
    claim(record, "Vendor Agreement Signed", "Agreement signed", claims);
    claim(record, "Rate Sheet Received", "Rate sheet received", claims);
    claim(record, "References Verified", "References verified", claims);
    claim(record, "Pilot Completed", "Pilot completed", claims);
    claim(record, "Critical Failure", "Critical failure", claims);
    claim(record, "Open Corrective Action", "Open corrective action", claims);
    claim(record, "Compliance Status", "Compliance status", claims);
    claim(record, "Qualification Gate Status", "Qualification gate", claims);
    claim(record, "Gold Standard Status", "Gold standard", claims);

    const email = firstValue(record, "Email Address", "Email");
    const specialties = splitList(
      [record["Specialty"] ?? "", record["Specialty (Backend)"] ?? ""].filter(Boolean).join(","),
    );

    rows.push({
      sourceRole: "service_provider",
      displayName: company,
      email: email && email.includes("@") ? email.toLowerCase() : null,
      phone: firstValue(record, "Phone Number", "Phone"),
      departments: [...new Set(specialties)],
      groups: splitList(record["Market"] ?? ""),
      profile: {
        contactPerson: firstValue(record, "Contact Person"),
        specialties: [...new Set(specialties)],
        markets: splitList(record["Market"] ?? ""),
        serviceArea: firstValue(record, "Service Area"),
        pricing: firstValue(record, "Pricing"),
        paymentType: firstValue(record, "Payment Type"),
        coverageHours: firstValue(record, "Coverage Hours"),
        emergencyAvailability: firstValue(record, "Emergency Availability"),
        website: firstValue(record, "Website"),
        restrictions: firstValue(record, "Restrictions"),
        comments: firstValue(record, "Comments", "Compliance Notes"),
        preference: firstValue(record, "Preference"),
        legacyStatus: firstValue(record, "Vendor Status"),
        claims,
        insuranceExpiresOn: toIsoDate(firstValue(record, "Insurance Expiration")),
        licenseExpiresOn: toIsoDate(firstValue(record, "License Expiration")),
        notionVendorId: firstValue(record, "Vendor ID"),
      },
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Breezeway service provider / representative directory export        */
/* ------------------------------------------------------------------ */

/**
 * True when the text is the Breezeway people directory export
 * (`Name, Email, Role, Employee ID, Mobile Phone Number, Departments, Groups, ...`).
 */
export function looksLikeBreezewayCsv(text: string) {
  const header = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  return /(^|,)"?Name"?,/i.test(header) && /Role/i.test(header) && /Departments/i.test(header);
}

/**
 * Reads the Breezeway directory by column name rather than position.
 *
 * Breezeway quotes multi-value cells ("McCordsville, IN | Indianapolis, IN"),
 * so this goes through the real CSV reader. Departments and groups are
 * pipe-separated. Role decides whether the row is a company (Service Provider)
 * or a person attached to one (Representative) — the person is never assumed to
 * belong to a company on the strength of a personal email address.
 */
export function parseBreezewayCsv(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const record of parseCsvRecords(text)) {
    const name = firstValue(record, "Name", "Full Name");
    if (!name) continue;

    const roleText = (firstValue(record, "Role") ?? "").toLowerCase();
    const email = firstValue(record, "Email", "Email Address");
    const notes = firstValue(record, "Extraction Notes", "Notes");
    const twoFactor = firstValue(record, "Two-Factor Authentication");
    const employeeId = firstValue(record, "Employee ID");
    const departments = splitList((record["Departments"] ?? "").replace(/\|/g, ","));
    const groups = splitList((record["Groups"] ?? "").replace(/\|/g, ","));

    const claims: string[] = [];
    if (twoFactor && twoFactor.toUpperCase() !== "N/A") claims.push(`Two-factor in Breezeway: ${twoFactor}`);
    if (employeeId) claims.push(`Breezeway employee ID: ${employeeId}`);
    if (notes) claims.push(`Export note: ${notes}`);

    rows.push({
      sourceRole: roleText.includes("service") || roleText.includes("provider") ? "service_provider" : "representative",
      displayName: name,
      email: email && email.includes("@") ? email.toLowerCase() : null,
      phone: firstValue(record, "Mobile Phone Number", "Phone Number", "Phone"),
      departments,
      groups,
      profile: {
        contactPerson: null,
        specialties: departments,
        markets: groups.filter((g) => !/^all groups$/i.test(g)),
        serviceArea: groups.filter((g) => !/^all groups$/i.test(g)).join(", ") || null,
        pricing: null,
        paymentType: null,
        coverageHours: null,
        emergencyAvailability: null,
        website: null,
        restrictions: null,
        comments: notes,
        preference: null,
        legacyStatus: firstValue(record, "Role"),
        claims,
        insuranceExpiresOn: null,
        licenseExpiresOn: null,
        notionVendorId: null,
      },
    });
  }
  return rows;
}


  if (!email) return null;
  const domain = email.split("@")[1]?.toLowerCase() ?? null;
  if (!domain || PERSONAL_DOMAINS.has(domain)) return null;
  return domain;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(llc|inc|co|company|services?|service|the|of|and)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

type Existing = { id: string; display_name: string; website: string | null; primary_contact_email: string | null };

/** Proposes what to do with one legacy row. Confidence never auto-approves. */
export function proposeAction(row: ParsedRow, existing: Existing[]) {
  const reasons: string[] = [];
  let match: Existing | null = null;
  let confidence = 0;

  const rowDomain = domainOf(row.email);
  const rowKey = normalizeName(row.displayName);

  for (const org of existing) {
    let score = 0;
    const why: string[] = [];
    if (normalizeName(org.display_name) === rowKey && rowKey.length > 2) {
      score += 0.6;
      why.push("company name matches");
    }
    const orgDomain = domainOf(org.primary_contact_email) ?? (org.website ? org.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]! : null);
    if (rowDomain && orgDomain && rowDomain === orgDomain) {
      score += 0.35;
      why.push(`email domain ${rowDomain} matches`);
    }
    if (score > confidence) {
      confidence = score;
      match = org;
      reasons.length = 0;
      reasons.push(...why);
    }
  }

  if (row.sourceRole === "service_provider") {
    if (match && confidence >= 0.6) {
      return { action: "merge" as const, match, confidence, reasons };
    }
    return {
      action: "create" as const,
      match: null,
      confidence: 0,
      reasons: ["New company from the legacy list. Imports as Potential, never Approved."],
    };
  }

  // A representative is a person. Only defensible evidence links them.
  if (match && confidence >= 0.6) {
    return { action: "match" as const, match, confidence, reasons };
  }
  if (rowDomain) {
    return {
      action: "needs_review" as const,
      match: null,
      confidence: 0.3,
      reasons: [`Work email domain ${rowDomain} suggests a company, but no company matches it yet.`],
    };
  }
  return {
    action: "needs_review" as const,
    match: null,
    confidence: 0,
    reasons: ["Personal or missing email — no defensible link to a company. Unmatched legacy representative."],
  };
}

export async function createImportBatch(
  db: Client,
  userId: string,
  input: { sourceSystem: string; label: string; text: string },
) {
  await assertSupervisor(db, userId);
  const notionExport = looksLikeVendorDatabaseCsv(input.text);
  const parsed = notionExport ? parseVendorDatabaseCsv(input.text) : parseLegacyRows(input.text);
  if (parsed.length === 0) throw new Error("No rows found. Paste one vendor per line.");


  const { data: existing, error: existingError } = await db
    .from("vendor_orgs")
    .select("id, display_name, website, primary_contact_email");
  if (existingError) throw new Error(existingError.message);

  const { data: batch, error: batchError } = await db
    .from("vendor_import_batches")
    .insert({
      source_system: notionExport ? "notion" : input.sourceSystem,
      label: input.label,
      created_by: userId,
    })

    .select("id")
    .single();
  if (batchError) throw new Error(batchError.message);

  const rows = parsed.map((row) => {
    const proposal = proposeAction(row, existing ?? []);
    return {
      batch_id: batch.id,
      source_role: row.sourceRole,
      raw: JSON.parse(JSON.stringify(row)) as Database["public"]["Tables"]["vendor_import_rows"]["Row"]["raw"],
      display_name: row.displayName,
      email: row.email,
      phone: row.phone,
      departments: row.departments,
      groups: row.groups,
      proposed_action: proposal.action,
      match_org_id: proposal.match?.id ?? null,
      match_confidence: proposal.confidence,
      match_reasons: proposal.reasons,
    };
  });

  const { error: rowsError } = await db.from("vendor_import_rows").insert(rows);
  if (rowsError) throw new Error(rowsError.message);

  return { batchId: batch.id, rowCount: rows.length };
}

export async function loadImportQueue(db: Client) {
  const [batchesRes, rowsRes] = await Promise.all([
    db.from("vendor_import_batches").select("*").order("created_at", { ascending: false }).limit(20),
    db
      .from("vendor_import_rows")
      .select("*, vendor_orgs:match_org_id(display_name)")
      .eq("decision", "pending")
      .order("created_at")
      .limit(300),
  ]);
  if (batchesRes.error) throw new Error(batchesRes.error.message);
  if (rowsRes.error) throw new Error(rowsRes.error.message);
  return {
    batches: batchesRes.data ?? [],
    rows: (rowsRes.data ?? []).map((r) => ({
      id: r.id,
      batchId: r.batch_id,
      sourceRole: r.source_role,
      displayName: r.display_name,
      email: r.email,
      phone: r.phone,
      departments: r.departments ?? [],
      groups: r.groups ?? [],
      proposedAction: r.proposed_action,
      matchOrgId: r.match_org_id,
      matchOrgName: (r.vendor_orgs as { display_name?: string } | null)?.display_name ?? null,
      matchConfidence: r.match_confidence,
      matchReasons: r.match_reasons ?? [],
      profile: ((r.raw as { profile?: LegacyProfile | null } | null)?.profile ?? null) as LegacyProfile | null,
    })),

  };
}

/** A human decides. This is the only path from staging into the live directory. */
export async function decideImportRow(
  db: Client,
  userId: string,
  input: { rowId: string; action: "create" | "match" | "skip"; orgId?: string | null | undefined; note?: string | null | undefined },
) {
  await assertSupervisor(db, userId);
  const { data: row, error } = await db.from("vendor_import_rows").select("*").eq("id", input.rowId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("That import row no longer exists.");
  if (row.decision !== "pending") throw new Error("That row was already decided.");

  let createdOrgId: string | null = null;
  let createdContactId: string | null = null;

  const groupsAreMeaningful = (row.groups ?? []).filter((g) => !/all groups/i.test(g));
  const allGroups = (row.groups ?? []).some((g) => /all groups/i.test(g));
  const profile = (row.raw as { profile?: LegacyProfile | null } | null)?.profile ?? null;

  if (input.action === "create") {
    // Everything the old record claimed is written down as a claim, never as a
    // verified gate. A supervisor still has to check insurance, licence and W-9.
    const notes = [
      profile?.comments,
      profile?.restrictions ? `Restrictions: ${profile.restrictions}` : null,
      profile?.preference ? `Historic preference: ${profile.preference}` : null,
      profile?.coverageHours ? `Coverage hours: ${profile.coverageHours}` : null,
      profile?.serviceArea ? `Service area on record: ${profile.serviceArea}` : null,
      profile?.claims.length ? `Recorded in Notion (unverified) — ${profile.claims.join("; ")}.` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { data, error: insertError } = await db
      .from("vendor_orgs")
      .insert({
        display_name: row.display_name,
        legal_name: row.display_name,
        status: "legacy",
        service_categories: profile?.specialties?.length ? profile.specialties : (row.departments ?? []),
        markets: profile?.markets ?? [],
        legacy_market_hints: groupsAreMeaningful,
        legacy_all_groups: allGroups,
        primary_contact_name: profile?.contactPerson ?? null,
        primary_contact_email: row.email,
        primary_contact_phone: row.phone,
        website: profile?.website ?? null,
        pricing_note: profile?.pricing ?? null,
        payment_terms: profile?.paymentType ?? null,
        emergency_available: Boolean(profile?.emergencyAvailability && /yes|24|always/i.test(profile.emergencyAvailability)),
        insurance_expires_on: profile?.insuranceExpiresOn ?? null,
        license_expires_on: profile?.licenseExpiresOn ?? null,
        notes: notes || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    createdOrgId = data.id;


    await db.from("vendor_status_events").insert({
      org_id: data.id,
      to_status: "legacy",
      reason: `Imported from ${row.source_role === "service_provider" ? "legacy service provider list" : "legacy list"}. Not verified.`,
      actor_id: userId,
    });
    await db.from("external_links").insert({
      entity_type: "vendor_org",
      entity_id: data.id,
      system: profile?.notionVendorId ? "notion" : "breezeway",
      external_id: profile?.notionVendorId ?? row.display_name,
      last_sync_status: "imported",
    });

  }

  if (input.action === "match" || (input.action === "create" && row.source_role === "representative")) {
    const orgId = input.orgId ?? row.match_org_id ?? createdOrgId;
    const { data, error: contactError } = await db
      .from("vendor_contacts")
      .insert({
        org_id: orgId,
        full_name: row.display_name,
        email: row.email,
        phone: row.phone,
        legacy_departments: row.departments ?? [],
        legacy_groups: row.groups ?? [],
        source_system: "breezeway",
        match_status: orgId ? "matched" : "unmatched",
      })
      .select("id")
      .single();
    if (contactError) throw new Error(contactError.message);
    createdContactId = data.id;
  }

  const { error: updateError } = await db
    .from("vendor_import_rows")
    .update({
      decision: input.action === "skip" ? "skipped" : input.action,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      decision_note: input.note || null,
      created_org_id: createdOrgId,
      created_contact_id: createdContactId,
    })
    .eq("id", input.rowId);
  if (updateError) throw new Error(updateError.message);

  return { ok: true, orgId: createdOrgId, contactId: createdContactId };
}
