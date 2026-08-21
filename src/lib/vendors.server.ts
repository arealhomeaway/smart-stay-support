/**
 * Vendor company management (server-only).
 *
 * The rules that matter here, in plain terms:
 *   - Nothing becomes an approved vendor by accident. Status only moves with a
 *     written reason, and the move is recorded.
 *   - Legacy records land in staging. A person decides create / match / skip.
 *   - "Not verified" is never a pass, and an expired item is not verified.
 *   - Restricted identity documents never leave the supervisor surface.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  gatekeeperReadiness,
  maskedCodeFor,
  type GatekeeperLine,
  type GatekeeperResult,
  type RequirementLevel,
  type VendorOrgRow,
  type VendorStatus,
} from "./vendors";

type Client = SupabaseClient<Database>;

export async function assertSupervisor(db: Client, userId: string) {
  const { data, error } = await db.rpc("is_supervisor", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only supervisors and platform owners can change vendor records.");
}

async function actorLabel(db: Client, userId: string) {
  const { data } = await db.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  return data?.full_name ?? data?.email ?? "Unknown";
}

/* ------------------------------------------------------------------ */
/* Directory                                                           */
/* ------------------------------------------------------------------ */

export async function loadVendorDirectory(db: Client): Promise<{
  orgs: VendorOrgRow[];
  unmatchedContacts: number;
  openImportRows: number;
}> {
  const [orgsRes, membersRes, coverageRes, reqRes, resultsRes, contactsRes, importRes] =
    await Promise.all([
      db.from("vendor_orgs").select("*").order("display_name"),
      db.from("vendor_org_members").select("org_id").eq("active", true),
      db.from("property_vendor_coverage").select("org_id"),
      db.from("gatekeeper_requirements").select("id, requirement_level").eq("active", true),
      db.from("vendor_gatekeeper_results").select("org_id, requirement_id, result, expires_on"),
      db.from("vendor_contacts").select("id", { count: "exact", head: true }).eq("match_status", "unmatched"),
      db.from("vendor_import_rows").select("id", { count: "exact", head: true }).eq("decision", "pending"),
    ]);

  for (const res of [orgsRes, membersRes, coverageRes, reqRes, resultsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const memberCounts = new Map<string, number>();
  for (const m of membersRes.data ?? []) memberCounts.set(m.org_id, (memberCounts.get(m.org_id) ?? 0) + 1);
  const coverageCounts = new Map<string, number>();
  for (const c of coverageRes.data ?? []) coverageCounts.set(c.org_id, (coverageCounts.get(c.org_id) ?? 0) + 1);

  const requirements = reqRes.data ?? [];
  const byOrg = new Map<string, Map<string, { result: string; expires_on: string | null }>>();
  for (const r of resultsRes.data ?? []) {
    const map = byOrg.get(r.org_id) ?? new Map();
    map.set(r.requirement_id, { result: r.result, expires_on: r.expires_on });
    byOrg.set(r.org_id, map);
  }

  const orgs: VendorOrgRow[] = (orgsRes.data ?? []).map((o) => {
    const results = byOrg.get(o.id) ?? new Map();
    const lines: GatekeeperLine[] = requirements.map((req) => ({
      requirementId: req.id,
      code: "",
      label: "",
      detail: null,
      level: req.requirement_level as RequirementLevel,
      result: (results.get(req.id)?.result ?? "not_verified") as GatekeeperResult,
      note: null,
      verifiedAt: null,
      expiresOn: results.get(req.id)?.expires_on ?? null,
    }));
    const readiness = gatekeeperReadiness(lines);
    return {
      id: o.id,
      displayName: o.display_name,
      legalName: o.legal_name,
      vendorClass: o.vendor_class as VendorOrgRow["vendorClass"],
      status: o.status as VendorStatus,
      serviceCategories: o.service_categories ?? [],
      markets: o.markets ?? [],
      legacyAllGroups: o.legacy_all_groups,
      primaryContactName: o.primary_contact_name,
      primaryContactEmail: o.primary_contact_email,
      primaryContactPhone: o.primary_contact_phone,
      emergencyAvailable: o.emergency_available,
      googleRating: o.google_rating,
      googleReviewCount: o.google_review_count,
      memberCount: memberCounts.get(o.id) ?? 0,
      coverageCount: coverageCounts.get(o.id) ?? 0,
      gatekeeperPassed: readiness.passed,
      gatekeeperTotal: readiness.total,
      gatekeeperClear: readiness.clear,
      lastVerifiedAt: o.last_verified_at,
    };
  });

  return {
    orgs,
    unmatchedContacts: contactsRes.count ?? 0,
    openImportRows: importRes.count ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* One company                                                         */
/* ------------------------------------------------------------------ */

export async function loadVendorOrg(db: Client, orgId: string, viewerIsSupervisor: boolean) {
  const [orgRes, membersRes, contactsRes, coverageRes, reqRes, resultsRes, docsRes, eventsRes] =
    await Promise.all([
      db.from("vendor_orgs").select("*").eq("id", orgId).maybeSingle(),
      db.from("vendor_org_members").select("*").eq("org_id", orgId).order("masked_code"),
      db.from("vendor_contacts").select("*").eq("org_id", orgId).order("full_name"),
      db
        .from("property_vendor_coverage")
        .select("*, properties(name, nickname, city, state)")
        .eq("org_id", orgId)
        .order("service_category"),
      db.from("gatekeeper_requirements").select("*").eq("active", true).order("sort_order"),
      db.from("vendor_gatekeeper_results").select("*").eq("org_id", orgId),
      db.from("vendor_documents").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      db.from("vendor_status_events").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(25),
    ]);

  if (orgRes.error) throw new Error(orgRes.error.message);
  if (!orgRes.data) throw new Error("That vendor company no longer exists.");

  const resultMap = new Map((resultsRes.data ?? []).map((r) => [r.requirement_id, r]));
  const gatekeeper: GatekeeperLine[] = (reqRes.data ?? []).map((req) => {
    const hit = resultMap.get(req.id);
    return {
      requirementId: req.id,
      code: req.code,
      label: req.label,
      detail: req.detail,
      level: req.requirement_level as RequirementLevel,
      result: (hit?.result ?? "not_verified") as GatekeeperResult,
      note: hit?.note ?? null,
      verifiedAt: hit?.verified_at ?? null,
      expiresOn: hit?.expires_on ?? null,
    };
  });

  const documents = (docsRes.data ?? []).map((d) => ({
    id: d.id,
    docType: d.doc_type,
    // A restricted document is acknowledged, never described, outside supervisors.
    title: d.restricted && !viewerIsSupervisor ? "Restricted document on file" : d.title,
    restricted: d.restricted,
    verificationStatus: d.verification_status,
    verifiedAt: d.verified_at,
    expiresOn: d.expires_on,
    note: d.restricted && !viewerIsSupervisor ? null : d.note,
  }));

  return {
    org: orgRes.data,
    members: (membersRes.data ?? []).map((m) => ({
      id: m.id,
      maskedCode: m.masked_code,
      vendorRole: m.vendor_role,
      active: m.active,
      attestedAt: m.attested_at,
    })),
    contacts: contactsRes.data ?? [],
    coverage: (coverageRes.data ?? []).map((c) => ({
      id: c.id,
      propertyId: c.property_id,
      propertyName:
        (c.properties as { name?: string; nickname?: string | null } | null)?.nickname ||
        (c.properties as { name?: string } | null)?.name ||
        "Unknown home",
      serviceCategory: c.service_category,
      coveragePriority: c.coverage_priority,
      approvalLimit: c.approval_limit,
      accessRequirements: c.access_requirements,
      effectiveFrom: c.effective_from,
      effectiveTo: c.effective_to,
      lastVerifiedAt: c.last_verified_at,
    })),
    gatekeeper,
    readiness: gatekeeperReadiness(gatekeeper),
    documents,
    statusHistory: eventsRes.data ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export async function createVendorOrg(
  db: Client,
  userId: string,
  input: {
    displayName: string;
    legalName?: string | null;
    vendorClass: string;
    serviceCategories: string[];
    markets: string[];
    primaryContactName?: string | null;
    primaryContactEmail?: string | null;
    primaryContactPhone?: string | null;
    website?: string | null;
    emergencyAvailable: boolean;
    notes?: string | null;
  },
) {
  await assertSupervisor(db, userId);

  const { data: dupes, error: dupeError } = await db
    .from("vendor_orgs")
    .select("id, display_name, primary_contact_email, primary_contact_phone")
    .or(
      [
        `display_name.ilike.${input.displayName}`,
        input.primaryContactEmail ? `primary_contact_email.ilike.${input.primaryContactEmail}` : null,
        input.primaryContactPhone ? `primary_contact_phone.eq.${input.primaryContactPhone}` : null,
      ]
        .filter(Boolean)
        .join(","),
    );
  if (dupeError) throw new Error(dupeError.message);
  if ((dupes ?? []).length > 0) {
    throw new Error(
      `A vendor that looks like this already exists: ${dupes![0]!.display_name}. Open that record instead of creating a second one.`,
    );
  }

  const { data, error } = await db
    .from("vendor_orgs")
    .insert({
      display_name: input.displayName,
      legal_name: input.legalName || input.displayName,
      vendor_class: input.vendorClass,
      status: "potential",
      service_categories: input.serviceCategories,
      markets: input.markets,
      primary_contact_name: input.primaryContactName || null,
      primary_contact_email: input.primaryContactEmail || null,
      primary_contact_phone: input.primaryContactPhone || null,
      website: input.website || null,
      emergency_available: input.emergencyAvailable,
      notes: input.notes || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await db.from("vendor_status_events").insert({
    org_id: data.id,
    from_status: null,
    to_status: "potential",
    reason: "Vendor record created.",
    actor_id: userId,
    actor_label: await actorLabel(db, userId),
  });

  return { orgId: data.id };
}

export async function setVendorStatus(
  db: Client,
  userId: string,
  input: { orgId: string; status: VendorStatus; reason: string },
) {
  await assertSupervisor(db, userId);
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Write a short reason for the status change — it goes on the record.");

  const { data: org, error: orgError } = await db
    .from("vendor_orgs")
    .select("id, status")
    .eq("id", input.orgId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!org) throw new Error("That vendor company no longer exists.");

  // Approval is gated on the blocking screening items, not on judgement.
  if (input.status === "approved") {
    const [{ data: reqs }, { data: results }] = await Promise.all([
      db.from("gatekeeper_requirements").select("id, label, requirement_level").eq("active", true),
      db.from("vendor_gatekeeper_results").select("requirement_id, result, expires_on").eq("org_id", input.orgId),
    ]);
    const map = new Map((results ?? []).map((r) => [r.requirement_id, r]));
    const lines: GatekeeperLine[] = (reqs ?? []).map((r) => ({
      requirementId: r.id,
      code: "",
      label: r.label,
      detail: null,
      level: r.requirement_level as RequirementLevel,
      result: (map.get(r.id)?.result ?? "not_verified") as GatekeeperResult,
      note: null,
      verifiedAt: null,
      expiresOn: map.get(r.id)?.expires_on ?? null,
    }));
    const readiness = gatekeeperReadiness(lines);
    if (!readiness.clear) {
      throw new Error(
        `Not approvable yet — still open: ${readiness.blockersFailing.map((l) => l.label).join(", ")}.`,
      );
    }
  }

  const { error } = await db
    .from("vendor_orgs")
    .update({ status: input.status, last_verified_at: new Date().toISOString() })
    .eq("id", input.orgId);
  if (error) throw new Error(error.message);

  await db.from("vendor_status_events").insert({
    org_id: input.orgId,
    from_status: org.status,
    to_status: input.status,
    reason,
    actor_id: userId,
    actor_label: await actorLabel(db, userId),
  });

  await db.from("audit_log").insert({
    actor_id: userId,
    action: "vendor_status_changed",
    entity_type: "vendor_org",
    entity_id: input.orgId,
    reason,
    before_value: { status: org.status },
    after_value: { status: input.status },
  });

  return { ok: true };
}

export async function setGatekeeperResult(
  db: Client,
  userId: string,
  input: {
    orgId: string;
    requirementId: string;
    result: GatekeeperResult;
    note?: string | null;
    expiresOn?: string | null;
  },
) {
  await assertSupervisor(db, userId);
  const verified = input.result !== "not_verified";
  const { error } = await db.from("vendor_gatekeeper_results").upsert(
    {
      org_id: input.orgId,
      requirement_id: input.requirementId,
      result: input.result,
      note: input.note || null,
      expires_on: input.expiresOn || null,
      verified_by: verified ? userId : null,
      verified_at: verified ? new Date().toISOString() : null,
    },
    { onConflict: "org_id,requirement_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function addCoverage(
  db: Client,
  userId: string,
  input: {
    orgId: string;
    propertyId: string;
    serviceCategory: string;
    coveragePriority: string;
    approvalLimit?: number | null;
    accessRequirements?: string | null;
  },
) {
  await assertSupervisor(db, userId);
  const { data: org } = await db.from("vendor_orgs").select("status").eq("id", input.orgId).maybeSingle();
  if (org && ["removed", "potential", "screening"].includes(org.status)) {
    throw new Error("Only a trial, approved, restricted or paused vendor can be put on a coverage map.");
  }
  const { error } = await db.from("property_vendor_coverage").insert({
    org_id: input.orgId,
    property_id: input.propertyId,
    service_category: input.serviceCategory,
    coverage_priority: input.coveragePriority,
    approval_limit: input.approvalLimit ?? null,
    access_requirements: input.accessRequirements || null,
    last_verified_at: new Date().toISOString(),
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function removeCoverage(db: Client, userId: string, coverageId: string) {
  await assertSupervisor(db, userId);
  const { error } = await db.from("property_vendor_coverage").delete().eq("id", coverageId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Attach an existing vendor login to a company, with a masked code. */
export async function addVendorMember(
  db: Client,
  userId: string,
  input: { orgId: string; memberUserId: string; vendorRole: string },
) {
  await assertSupervisor(db, userId);
  const [{ data: org }, { count }] = await Promise.all([
    db.from("vendor_orgs").select("display_name").eq("id", input.orgId).maybeSingle(),
    db.from("vendor_org_members").select("id", { count: "exact", head: true }).eq("org_id", input.orgId),
  ]);
  if (!org) throw new Error("That vendor company no longer exists.");

  const { error } = await db.from("vendor_org_members").insert({
    org_id: input.orgId,
    user_id: input.memberUserId,
    vendor_role: input.vendorRole,
    masked_code: maskedCodeFor(org.display_name, (count ?? 0) + 1),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
