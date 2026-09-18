/**
 * Property Hub — one property, eight tabs, one contract (server-only).
 *
 * The Hub is deliberately a *reader*. Every write still happens in the
 * workspace that owns the record (Operations, Onboarding, Approvals, Files),
 * so nothing here can drift from the system of record.
 *
 * Two audiences read the same function:
 *   - staff      see the operational snapshot
 *   - homeowner  see only their own enrolled home, and only the parts of it
 *                Resolve has explicitly shared with them
 *
 * The shape below is the data contract the approved PID field map will slot
 * into: `details.sections` is section-based, so approved fields land in an
 * existing section without the interface being rebuilt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildPropertyDetailGroups } from "@/lib/property-details";
import { propertyAddress } from "@/lib/property-address";
import { isWorkingStatus } from "@/lib/ticket-lifecycle";
import { attachmentMatchesCurrentProperty } from "@/lib/attachments.server";
import { isExternalOwner, ownerPropertyAccess } from "@/lib/owner-property-access.server";

type Client = SupabaseClient<Database>;

export type Viewer = { userId: string; roles: string[] };

const STAFF_ROLES = ["admin", "manager", "onboarding", "tech"];

export function isStaff(v: Viewer) {
  return v.roles.some((r) => STAFF_ROLES.includes(r));
}
export function isSupervisor(v: Viewer) {
  return v.roles.some((r) => r === "admin" || r === "manager");
}

export const DENY = "This home is not one of yours.";

export type HubField = {
  label: string;
  /** Resolve key, so the approved field map maps 1:1 onto the interface. */
  key: string;
  value: string | null;
  /** Where the value came from, and when — shown as provenance. */
  source: string;
  asOf: string | null;
  ownerVisible: boolean;
  /** Not yet mapped/imported. Rendered as a labelled gap, never as blank. */
  pending?: boolean;
};

export type HubSection = { id: string; title: string; blurb?: string; fields: HubField[] };

export type PropertyActivityRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_label: string | null;
  actor_label: string | null;
  reason: string | null;
  created_at: string;
};

/**
 * Which `audit_log` (entity_type, entity_id) pairs belong to this property —
 * a real foreign-key relationship, not the `entity_label` name-substring
 * match this replaced. `audit_log` has no `property_id` column of its own,
 * so this joins through the property-scoped rows the Hub already loads:
 * the property record itself, plus its tickets, onboarding tasks,
 * approvals and handoff. Other `audit_log` entity types exist
 * (`financial_request`, `utility_account`, …) but aren't covered here —
 * covering them would mean fetching tables this Hub doesn't otherwise
 * need, which is a larger change than this fix.
 */
export function propertyActivityScopes(input: {
  propertyId: string;
  ticketIds: string[];
  taskIds: string[];
  approvalIds: string[];
  handoffIds: string[];
}): { entityType: string; entityIds: string[] }[] {
  const scopes: { entityType: string; entityIds: string[] }[] = [
    { entityType: "property", entityIds: [input.propertyId] },
  ];
  if (input.ticketIds.length) scopes.push({ entityType: "ticket", entityIds: input.ticketIds });
  if (input.taskIds.length)
    scopes.push({ entityType: "onboarding_task", entityIds: input.taskIds });
  if (input.approvalIds.length)
    scopes.push({ entityType: "approval", entityIds: input.approvalIds });
  if (input.handoffIds.length)
    scopes.push({ entityType: "property_handoff", entityIds: input.handoffIds });
  return scopes;
}

/** Newest first, across every scope's results, capped at `limit`. */
export function mergePropertyActivity(
  batches: PropertyActivityRow[][],
  limit = 25,
): PropertyActivityRow[] {
  return batches
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export async function loadViewer(supabase: Client, userId: string): Promise<Viewer> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Could not confirm your access level.");
  return { userId, roles: (data ?? []).map((r) => r.role as string) };
}

function fmtDate(v: string | null | undefined) {
  if (!v) return null;
  return new Date(v).toISOString().slice(0, 10);
}

/** The whole Hub in one round trip. Access is decided here, not in the UI. */
export async function loadPropertyHub(viewer: Viewer, propertyId: string, client?: Client) {
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const staff = isStaff(viewer);
  type Property = Database["public"]["Tables"]["properties"]["Row"];
  type ProgramSummary = {
    id: string;
    owner_name: string | null;
    status: string;
    started_on: string | null;
    ends_on: string | null;
  };
  let p: Property;
  let ownerProgram: ProgramSummary | null = null;
  if (staff) {
    const property = await supabaseAdmin
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .maybeSingle();
    if (property.error || !property.data) throw new Error("That property could not be found.");
    p = property.data;
  } else {
    if (!isExternalOwner(viewer)) throw new Error(DENY);
    const result = await supabaseAdmin.rpc("read_owner_properties", {
      _property_ids: [propertyId],
      _actor_id: viewer.userId,
    });
    const scoped = result.data?.find((row) => row.id === propertyId);
    if (
      result.error ||
      !scoped ||
      !scoped.property ||
      typeof scoped.property !== "object" ||
      Array.isArray(scoped.property) ||
      scoped.property["id"] !== propertyId
    )
      throw new Error(DENY);
    // The database returns only its explicit owner-safe Property projection.
    p = scoped.property as unknown as Property;
    const programs = await supabaseAdmin.rpc("read_owner_programs", {
      _program_id: scoped.program_id,
      _actor_id: viewer.userId,
    });
    const program = programs.data?.find((row) => row.id === scoped.program_id)?.program;
    if (programs.error || !program || typeof program !== "object" || Array.isArray(program))
      throw new Error(DENY);
    ownerProgram = program as unknown as ProgramSummary;
  }
  const owns = !staff;

  const [tasks, tickets, docs, approvals, handoff, programLink, outbound, links, conflicts] =
    await Promise.all([
      supabaseAdmin
        .from("onboarding_tasks")
        .select(
          "id, title, stage, status, due_on, blocks_handoff, blocker, requires_owner_approval, owner_approval_status, assigned_to, parent_task_id, sort_order, archived_at",
        )
        .eq("property_id", propertyId)
        .eq("is_demo", p.is_demo)
        .is("archived_at", null)
        .order("sort_order"),
      supabaseAdmin
        .from("tickets")
        .select("id, ref, title, status, priority, created_at, assigned_to, work_type_id")
        .eq("property_id", propertyId)
        .eq("is_demo", p.is_demo)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("documents")
        .select(
          "id, title, kind, visibility, upload_status, uploaded_at, uploaded_by, entity_type, entity_id, property_id, mime_type, size_bytes, category, original_filename, note, requested_from, is_demo, archived_at",
        )

        .eq("property_id", propertyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("approvals")
        .select("id, title, kind, status, due_on, decided_at, decision_note, created_at")
        .eq("property_id", propertyId)
        .eq("is_demo", p.is_demo)
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("property_handoffs")
        .select(
          "id, status, gate_step, requested_at, kati_decision, kati_at, micah_decision, micah_at, accepted_at, live_confirmed_at",
        )
        .eq("property_id", propertyId)
        .eq("is_demo", p.is_demo)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1),
      staff
        ? supabaseAdmin
            .from("owner_program_properties")
            .select(
              "program_id, inclusion_status, onboarding_status, owner_programs(id, owner_name, status, started_on, ends_on, target_hours)",
            )
            .eq("property_id", propertyId)
            .is("archived_at", null)
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
      staff
        ? supabaseAdmin
            .from("breezeway_outbound_tasks")
            .select("id, title, status, source_type, created_at, breezeway_task_id, last_synced_at")
            .eq("property_id", propertyId)
            .order("created_at", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [], error: null }),
      staff
        ? supabaseAdmin
            .from("property_external_links")
            .select(
              "id, kind, label, url, context, staff_only, canonical, needs_replacement, source, note, as_of",
            )
            .eq("property_id", propertyId)
        : Promise.resolve({ data: [], error: null }),
      staff
        ? supabaseAdmin
            .from("field_conflicts")
            .select("id, field_label, field_key, resolve_value, external_value, system, status")
            .eq("entity_type", "property")
            .eq("entity_id", propertyId)
            .eq("status", "open")
        : Promise.resolve({ data: [], error: null }),
    ]);

  // Quarterly reviews ship behind a launch-state flag. While the flag is OFF
  // the records and scheduler stay untouched, but the Hub must not surface a
  // review field, warning or dead-end action anywhere in the interface.
  const quarterlyFlag = await supabaseAdmin
    .from("feature_flags")
    .select("enabled")
    .eq("key", "quarterly_reviews")
    .maybeSingle();
  const quarterlyLive = quarterlyFlag.data?.enabled === true;

  const taskRows = tasks.data ?? [];
  const top = taskRows.filter((t) => !t.parent_task_id);
  const complete = top.filter((t) => t.status === "complete").length;
  const blocked = top.filter((t) => Boolean(t.blocker) || t.status === "blocked");
  const ownerActions = top.filter(
    (t) => t.requires_owner_approval && (t.owner_approval_status ?? "pending") === "pending",
  );
  const gates = top.filter((t) => t.blocks_handoff && t.status !== "complete");
  const subs = taskRows.filter((t) => t.parent_task_id);
  const subsComplete = subs.filter((t) => t.status === "complete").length;
  const unassigned = top.filter((t) => !t.assigned_to).length;

  // Resolved and closed both mean the frontline work is finished, so neither
  // belongs in an "open tickets" count. Only working statuses are open.
  const openTickets = (tickets.data ?? []).filter((t) => isWorkingStatus(String(t.status)));
  const program = staff
    ? ((programLink.data ?? [])[0]?.owner_programs as unknown as ProgramSummary | null)
    : ownerProgram;
  const documentCandidates = (docs.data ?? []).filter(
    (d) => staff || d.visibility === "owner_shared" || d.requested_from === "owner",
  );
  const documentAccess = staff
    ? []
    : await Promise.all(
        documentCandidates.map((row) =>
          attachmentMatchesCurrentProperty(supabaseAdmin, viewer, row, propertyId),
        ),
      );
  const documentRows = documentCandidates.filter((_, index) => staff || documentAccess[index]);
  const currentHandoff = (handoff.data ?? [])[0] ?? null;

  // Activity: one query per property-linked entity type, run after those
  // entities are known (tickets/tasks/approvals/handoff above), instead of
  // filtering the 200 most recent *system-wide* audit rows by name. That
  // old approach could both miss this property's real history (buried past
  // row 200 by unrelated activity elsewhere) and wrongly include another
  // record whose label happened to contain this property's name.
  const activityScopes = staff
    ? propertyActivityScopes({
        propertyId,
        ticketIds: (tickets.data ?? []).map((t: { id: string }) => t.id),
        taskIds: taskRows.map((t: { id: string }) => t.id),
        approvalIds: (approvals.data ?? []).map((a: { id: string }) => a.id),
        handoffIds: (handoff.data ?? []).map((h: { id: string }) => h.id),
      })
    : [];
  const activityBatches = await Promise.all(
    activityScopes.map((scope) =>
      supabaseAdmin
        .from("audit_log")
        .select("id, action, entity_type, entity_label, actor_label, reason, created_at")
        .eq("entity_type", scope.entityType)
        .in("entity_id", scope.entityIds)
        .order("created_at", { ascending: false })
        .limit(25),
    ),
  );
  if (activityBatches.some((batch) => batch.error))
    throw new Error(
      "Property activity could not be loaded. Try again before relying on this history.",
    );
  const activityRows = mergePropertyActivity(
    activityBatches.map(
      (b: { data: PropertyActivityRow[] | null }) => (b.data ?? []) as PropertyActivityRow[],
    ),
  );

  const sections: HubSection[] = [
    {
      id: "identity",
      title: "Property identity",
      fields: [
        f("Property name", "name", p.name, "Resolve", p.updated_at, true),
        f("Nickname", "nickname", p.nickname, "Resolve", p.updated_at, true),
        f("Market", "market", p.market, "Resolve", p.updated_at, true),
        f("Lifecycle", "lifecycle_status", p.lifecycle_status, "Resolve", p.updated_at, true),
      ],
    },
    {
      id: "location",
      title: "Address & location",
      fields: [
        f(
          "Street",
          "address_line1",
          p.address_line1,
          "OwnerRez / Resolve",
          p.ownerrez_synced_at ?? p.updated_at,
          true,
        ),
        f("Unit", "unit", p.unit, "Resolve", p.updated_at, true),
        f("City", "city", p.city, "OwnerRez / Resolve", p.ownerrez_synced_at ?? p.updated_at, true),
        f(
          "State",
          "state",
          p.state,
          "OwnerRez / Resolve",
          p.ownerrez_synced_at ?? p.updated_at,
          true,
        ),
        f(
          "Postal code",
          "postal_code",
          p.postal_code,
          "OwnerRez / Resolve",
          p.ownerrez_synced_at ?? p.updated_at,
          true,
        ),
        f(
          "Geocoded address",
          "formatted_address",
          p.formatted_address,
          "Google Maps",
          p.geocoded_at,
          false,
        ),
      ],
    },
    {
      id: "facts",
      title: "Property facts",
      blurb:
        "Bedrooms, occupancy and stay posture come from OwnerRez. Building systems and utilities are in Property details.",
      fields: [
        f(
          "Bedrooms",
          "bedrooms",
          p.bedrooms == null ? null : String(p.bedrooms),
          "OwnerRez",
          p.ownerrez_synced_at,
          true,
        ),
        f(
          "Bathrooms",
          "bathrooms",
          p.bathrooms == null ? null : String(p.bathrooms),
          "OwnerRez",
          p.ownerrez_synced_at,
          true,
        ),
        f(
          "Sleeps",
          "max_guests",
          p.max_guests == null ? null : String(p.max_guests),
          "OwnerRez",
          p.ownerrez_synced_at,
          true,
        ),
        f(
          "Living area",
          "living_area_sqft",
          p.living_area_sqft == null ? null : `${p.living_area_sqft} sq ft`,
          "OwnerRez",
          p.ownerrez_synced_at,
          true,
        ),
        f(
          "Property type",
          "property_type",
          p.property_type,
          "OwnerRez",
          p.ownerrez_synced_at,
          true,
        ),
        f(
          "Check-in / check-out",
          "check_times",
          p.check_in_time || p.check_out_time
            ? `${p.check_in_time ?? "—"} / ${p.check_out_time ?? "—"}`
            : null,
          "OwnerRez",
          p.ownerrez_synced_at,
          true,
        ),
        f("Time zone", "time_zone", p.time_zone, "OwnerRez", p.ownerrez_synced_at, false),
        f(
          "Public listing",
          "listing_public_url",
          p.listing_public_url,
          "OwnerRez",
          p.ownerrez_synced_at,
          true,
        ),
      ],
    },
    {
      id: "access",
      title: "Access",
      blurb:
        "Resolve records where access is held and who to ask. It never stores a live code or password.",
      fields: [f("Access notes", "access_notes", p.access_notes, "Resolve", p.updated_at, false)],
    },
    {
      id: "safety",
      title: "Safety & amenities",
      fields: [f("Wi-Fi notes", "wifi_notes", p.wifi_notes, "Resolve", p.updated_at, false)],
    },
    {
      id: "operations",
      title: "Operations",
      fields: [
        ...(quarterlyLive
          ? [
              f(
                "Quarterly review due",
                "quarterly_review_due_on",
                fmtDate(p.quarterly_review_due_on),
                "Resolve",
                p.last_quarterly_review_at,
                false,
              ),
              f(
                "Last quarterly review",
                "last_quarterly_review_at",
                fmtDate(p.last_quarterly_review_at),
                "Resolve",
                p.last_quarterly_review_at,
                false,
              ),
            ]
          : []),

        f("Active", "active", p.active ? "Yes" : "No", "Resolve", p.updated_at, false),
      ],
    },
    {
      id: "onboarding",
      title: "Onboarding status",
      fields: [
        f("Stage", "onboarding_stage", p.onboarding_stage, "Resolve", p.updated_at, true),
        f(
          "Planned closing",
          "planned_closing_on",
          fmtDate(p.planned_closing_on),
          "Resolve",
          p.updated_at,
          true,
        ),
        f(
          "Actual closing",
          "actual_closing_on",
          fmtDate(p.actual_closing_on),
          "Resolve",
          p.updated_at,
          true,
        ),
        f(
          "Access date",
          "actual_access_on",
          fmtDate(p.actual_access_on),
          "Resolve",
          p.updated_at,
          true,
        ),
        f(
          "Handoff accepted",
          "handoff_accepted_at",
          fmtDate(p.handoff_accepted_at),
          "Resolve",
          p.handoff_accepted_at,
          true,
        ),
      ],
    },
    {
      id: "external",
      title: "External system identifiers",
      fields: [
        f(
          "OwnerRez id",
          "ownerrez_property_id",
          p.ownerrez_property_id,
          "OwnerRez",
          p.ownerrez_synced_at,
          false,
        ),
        f(
          "Breezeway home id",
          "breezeway_property_id",
          p.breezeway_property_id,
          "Breezeway",
          p.breezeway_synced_at,
          false,
        ),
      ],
    },
  ];

  const ownerVisibleSections = ["identity", "location", "facts", "onboarding"];

  // Structured owner record (deduplicated, one per real owner). Staff only.
  let ownerRecord: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    source: string;
    syncedAt: string;
    propertyCount: number;
  } | null = null;
  if (staff && p.owner_record_id) {
    const [{ data: rec }, { count }] = await Promise.all([
      supabaseAdmin
        .from("property_owners")
        .select("id, name, email, phone, city, state, source, synced_at")
        .eq("id", p.owner_record_id)
        .maybeSingle(),
      supabaseAdmin
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("owner_record_id", p.owner_record_id)
        .is("archived_at", null),
    ]);
    if (rec) {
      ownerRecord = {
        id: rec.id,
        name: rec.name,
        email: rec.email,
        phone: rec.phone,
        city: rec.city,
        state: rec.state,
        source: rec.source,
        syncedAt: rec.synced_at,
        propertyCount: count ?? 1,
      };
    }
  }

  // Who uploaded each file — shown in the document library.
  const uploaderIds = Array.from(
    new Set((docs.data ?? []).map((d) => d.uploaded_by).filter((x): x is string => Boolean(x))),
  );
  const uploaderNames = new Map<string, string>();
  if (staff && uploaderIds.length > 0) {
    const { data: people } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds);
    for (const person of people ?? [])
      uploaderNames.set(person.id, person.full_name ?? "ARHA staff");
  }

  // Real PID operating information, grouped the way staff ask for it.
  const detailGroups = staff
    ? buildPropertyDetailGroups(p as unknown as Record<string, unknown>)
    : [];

  const linkRows = staff ? (links.data ?? []) : [];
  const externalLinks = linkRows.map((l) => ({
    id: l.id,
    kind: l.kind,
    label: l.label ?? defaultLinkLabel(l.kind),
    url: l.url,
    context: l.context,
    staffOnly: l.staff_only,
    canonical: l.canonical,
    needsReplacement: l.needs_replacement,
    legacy: l.kind === "legacy_onedrive",
    source: l.source,
    note: l.note,
    asOf: l.as_of,
  }));

  // Things a person should see before they start work on this home.
  const alerts: { id: string; tone: "danger" | "warn" | "info"; text: string }[] = [];
  if (staff) {
    const p1 = openTickets.filter((t) => t.priority === "p1").length;
    if (p1 > 0)
      alerts.push({
        id: "p1",
        tone: "danger",
        text: `${p1} open P1 ticket${p1 === 1 ? "" : "s"} on this home.`,
      });
    if (blocked.length > 0)
      alerts.push({
        id: "blocked",
        tone: "danger",
        text: `${blocked.length} onboarding task${blocked.length === 1 ? " is" : "s are"} blocked.`,
      });
    if (gates.length > 0)
      alerts.push({
        id: "gates",
        tone: "warn",
        text: `${gates.length} handoff gate${gates.length === 1 ? "" : "s"} still open.`,
      });
    const openConflicts = (conflicts.data ?? []).length;
    if (openConflicts > 0)
      alerts.push({
        id: "conflicts",
        tone: "warn",
        text: `${openConflicts} imported field${openConflicts === 1 ? "" : "s"} disagree with the system of record and need review.`,
      });
    const quarterly = quarterlyLive ? fmtDate(p.quarterly_review_due_on) : null;
    if (quarterly && quarterly < new Date().toISOString().slice(0, 10))
      alerts.push({
        id: "quarterly",
        tone: "warn",
        text: `Quarterly review was due ${quarterly}.`,
      });
    if (p.lifecycle_status && p.lifecycle_status !== "active_operations")
      alerts.push({
        id: "lifecycle",
        tone: "info",
        text: `Lifecycle: ${String(p.lifecycle_status).replace(/_/g, " ")}.`,
      });
    if (!p.primary_photo_url)
      alerts.push({
        id: "photo",
        tone: "info",
        text: "No listing photo has synced from OwnerRez yet.",
      });
    const replacements = externalLinks.filter((l) => l.needsReplacement).length;
    if (replacements > 0)
      alerts.push({
        id: "temp-links",
        tone: "info",
        text: `${replacements} temporary external link${replacements === 1 ? "" : "s"} still in use pending a native workflow.`,
      });
  }

  if (!staff && !(await ownerPropertyAccess(supabaseAdmin, viewer.userId, propertyId)))
    throw new Error(DENY);

  return {
    viewer: { staff, supervisor: isSupervisor(viewer), owner: owns },
    property: {
      id: p.id,
      name: p.name,

      nickname: p.nickname,
      address: propertyAddress(p),
      market: p.market,
      lifecycleStatus: p.lifecycle_status,
      onboardingStage: p.onboarding_stage,
      isDemo: p.is_demo,
      active: p.active,
      photoUrl: p.primary_photo_url,
      photoThumbUrl: p.primary_photo_thumb_url ?? p.primary_photo_url,
      photoSource: p.primary_photo_source,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      maxGuests: p.max_guests,
      neighborhood: p.neighborhood,
      tier: staff ? p.tier : null,
      minStayMonths: p.min_stay_months,
      propertyType: p.property_type,
      operatingNotes: staff ? p.operating_notes : null,
      internalNotes: staff ? p.notes : null,
      listingUrl: p.listing_public_url,
      checkInTime: p.check_in_time,
      checkOutTime: p.check_out_time,
    },
    ownerRecord,
    alerts,
    externalLinks,
    overview: {
      openTickets: openTickets.length,
      p1Tickets: openTickets.filter((t) => t.priority === "p1").length,
      onboardingComplete: complete,
      onboardingTotal: top.length,
      blockers: blocked.length,
      ownerActions: ownerActions.length,
      handoffGatesOpen: gates.length,
      unassignedTasks: staff ? unassigned : null,
      quarterlyDue: staff && quarterlyLive ? fmtDate(p.quarterly_review_due_on) : null,
      documents: documentRows.length,
      program: program
        ? {
            id: program.id,
            ownerName: program.owner_name,
            status: program.status,
            startedOn: program.started_on,
            endsOn: program.ends_on,
          }
        : null,
    },
    details: {
      sections: staff
        ? sections
        : sections.filter((s) => ownerVisibleSections.includes(s.id)).map(ownerFilter),
      groups: detailGroups,
    },

    // Owner contact comes from the canonical, deduplicated property_owners
    // record the home is bound to (properties.owner_record_id). The old
    // per-property contact table was transitional and is no longer read.
    contacts:
      staff && ownerRecord
        ? [
            {
              id: ownerRecord.id,
              name: ownerRecord.name,
              email: ownerRecord.email,
              phone: ownerRecord.phone,
              source: ownerRecord.source,
              matchStatus: "linked",
              syncedAt: ownerRecord.syncedAt,
            },
          ]
        : [],

    onboarding: {
      stage: p.onboarding_stage,
      total: top.length,
      complete,
      subtaskTotal: subs.length,
      subtaskComplete: subsComplete,
      percent: top.length ? Math.round((complete / top.length) * 100) : 0,
      blockers: blocked.slice(0, 10).map((t) => ({
        id: t.id,
        title: staff ? t.title : "Onboarding work",
        blocker: staff ? t.blocker : null,
        stage: t.stage,
      })),
      ownerActions: ownerActions.slice(0, 10).map((t) => ({
        id: t.id,
        title: staff ? t.title : "Owner onboarding review",
        stage: t.stage,
        dueOn: t.due_on,
      })),
      current: top
        .filter((t) => t.status !== "complete")
        .slice(0, staff ? 15 : 5)
        .map((t) => ({
          id: t.id,
          title: staff ? t.title : "Onboarding work",
          stage: t.stage,
          status: t.status,
          dueOn: t.due_on,
          assigned: Boolean(t.assigned_to),
        })),
      handoff:
        staff || !currentHandoff
          ? currentHandoff
          : {
              id: currentHandoff.id,
              status: currentHandoff.status,
              gate_step: currentHandoff.gate_step,
              requested_at: currentHandoff.requested_at,
              kati_decision: currentHandoff.kati_decision,
              kati_at: currentHandoff.kati_at,
              micah_decision: currentHandoff.micah_decision,
              micah_at: currentHandoff.micah_at,
              accepted_at: currentHandoff.accepted_at,
              live_confirmed_at: currentHandoff.live_confirmed_at,
            },
    },
    operations: staff
      ? {
          tickets: (tickets.data ?? []).map((t) => ({
            id: t.id,
            ref: t.ref,
            title: t.title,
            status: t.status,
            priority: t.priority,
            createdAt: t.created_at,
            assigned: Boolean(t.assigned_to),
          })),
          workOrders: (outbound.data ?? []).map((o) => ({
            id: o.id,
            title: o.title,
            status: o.status,
            source: o.source_type,
            createdAt: o.created_at,
            externalId: o.breezeway_task_id,
          })),
        }
      : { tickets: [], workOrders: [] },
    documents: documentRows.map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      visibility: d.visibility,
      status: d.upload_status,
      uploadedAt: d.uploaded_at,
      uploadedByName: d.uploaded_by
        ? staff
          ? (uploaderNames.get(d.uploaded_by) ?? "ARHA staff")
          : d.uploaded_by === viewer.userId
            ? "You"
            : "ARHA"
        : null,
      entityType: d.entity_type,
      entityId: d.entity_id,
      category: d.category,
      filename: d.original_filename,
      note: staff || d.requested_from === "owner" ? d.note : null,
    })),

    approvals: {
      ownerActions: ownerActions.map((t) => ({
        id: t.id,
        title: staff ? t.title : "Owner onboarding review",
        stage: t.stage,
        status: t.owner_approval_status ?? "pending",
      })),
      decided: top
        .filter(
          (t) => t.requires_owner_approval && (t.owner_approval_status ?? "pending") !== "pending",
        )
        .map((t) => ({
          id: t.id,
          title: staff ? t.title : "Owner onboarding review",
          stage: t.stage,
          status: t.owner_approval_status ?? "pending",
        })),
      records: staff
        ? (approvals.data ?? []).map((a) => ({
            id: a.id,
            title: a.title,
            kind: a.kind,
            status: a.status,
            decidedAt: a.decided_at,
            note: a.decision_note,
          }))
        : [],
    },
    activity: activityRows.map((a) => ({
      id: a.id,
      action: a.action,
      label: a.entity_label,
      actor: staff ? a.actor_label : "ARHA",
      reason: staff ? a.reason : null,
      at: a.created_at,
    })),
  };
}

function f(
  label: string,
  key: string,
  value: string | null | undefined,
  source: string,
  asOf: string | null | undefined,
  ownerVisible: boolean,
): HubField {
  return { label, key, value: value ?? null, source, asOf: asOf ?? null, ownerVisible };
}

function defaultLinkLabel(kind: string): string {
  const map: Record<string, string> = {
    system: "System link",
    camera_portal: "Camera portal",
    legacy_onedrive: "Legacy OneDrive file",
    hoa: "HOA link",
    fillout_form: "Fillout form",
    builder: "Builder / warranty link",
    reference: "Reference link",
  };
  return map[kind] ?? kind.replace(/_/g, " ");
}

function ownerFilter(section: HubSection): HubSection {
  return { ...section, fields: section.fields.filter((x) => x.ownerVisible && !x.pending) };
}
