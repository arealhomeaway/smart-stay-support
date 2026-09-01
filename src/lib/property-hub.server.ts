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

async function ownerOwnsProperty(userId: string, propertyId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("owner_program_properties")
    .select("property_id, inclusion_status, archived_at, owner_programs!inner(owner_user_id)")
    .eq("property_id", propertyId)
    .eq("owner_programs.owner_user_id", userId);
  return (data ?? []).some((r) => r.inclusion_status === "included" && r.archived_at == null);
}

export async function loadViewer(supabase: Client, userId: string): Promise<Viewer> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return { userId, roles: (data ?? []).map((r) => r.role as string) };
}

function fmtDate(v: string | null | undefined) {
  if (!v) return null;
  return new Date(v).toISOString().slice(0, 10);
}

/** The whole Hub in one round trip. Access is decided here, not in the UI. */
export async function loadPropertyHub(viewer: Viewer, propertyId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const staff = isStaff(viewer);
  const owns = staff ? false : await ownerOwnsProperty(viewer.userId, propertyId);
  if (!staff && !owns) throw new Error(DENY);

  const property = await supabaseAdmin.from("properties").select("*").eq("id", propertyId).maybeSingle();
  if (property.error || !property.data) throw new Error("That property could not be found.");
  const p = property.data;

  const [tasks, tickets, contacts, docs, approvals, handoff, programLink, activity, outbound, links, conflicts] =
    await Promise.all([

    supabaseAdmin
      .from("onboarding_tasks")
      .select(
        "id, title, stage, status, due_on, blocks_handoff, blocker, requires_owner_approval, owner_approval_status, assigned_to, parent_task_id, sort_order, archived_at",
      )
      .eq("property_id", propertyId)
      .is("archived_at", null)
      .order("sort_order"),
    supabaseAdmin
      .from("tickets")
      .select("id, ref, title, status, priority, created_at, assigned_to, work_type_id")
      .eq("property_id", propertyId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(25),
    supabaseAdmin
      .from("property_owner_contacts")
      .select("id, owner_name, owner_email, owner_phone, source, match_status, synced_at")
      .eq("property_id", propertyId),
    supabaseAdmin
      .from("documents")
      .select(
        "id, title, kind, visibility, upload_status, uploaded_at, uploaded_by, entity_type, entity_id, mime_type, size_bytes, category, original_filename, note",
      )

      .eq("property_id", propertyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("approvals")
      .select("id, title, kind, status, due_on, decided_at, decision_note, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabaseAdmin
      .from("property_handoffs")
      .select(
        "id, status, gate_step, requested_at, kati_decision, kati_at, micah_decision, micah_at, accepted_at, live_confirmed_at",
      )
      .eq("property_id", propertyId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("owner_program_properties")
      .select("program_id, inclusion_status, onboarding_status, owner_programs(id, owner_name, status, started_on, ends_on, target_hours)")
      .eq("property_id", propertyId)
      .is("archived_at", null)
      .limit(1),
    supabaseAdmin
      .from("audit_log")
      .select("id, action, entity_type, entity_label, actor_label, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("breezeway_outbound_tasks")
      .select("id, title, status, source_type, created_at, breezeway_task_id, last_synced_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabaseAdmin
      .from("property_external_links")
      .select("id, kind, label, url, context, staff_only, canonical, needs_replacement, source, note, as_of")
      .eq("property_id", propertyId),
    supabaseAdmin
      .from("field_conflicts")
      .select("id, field_label, field_key, resolve_value, external_value, system, status")
      .eq("entity_type", "property")
      .eq("entity_id", propertyId)
      .eq("status", "open"),
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

  const openTickets = (tickets.data ?? []).filter((t) => t.status !== "closed");
  const program = (programLink.data ?? [])[0]?.owner_programs as unknown as
    | { id: string; owner_name: string | null; status: string; started_on: string | null; ends_on: string | null; target_hours: number | null }
    | null;

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
        f("Street", "address_line1", p.address_line1, "OwnerRez / Resolve", p.ownerrez_synced_at ?? p.updated_at, true),
        f("Unit", "unit", p.unit, "Resolve", p.updated_at, true),
        f("City", "city", p.city, "OwnerRez / Resolve", p.ownerrez_synced_at ?? p.updated_at, true),
        f("State", "state", p.state, "OwnerRez / Resolve", p.ownerrez_synced_at ?? p.updated_at, true),
        f("Postal code", "postal_code", p.postal_code, "OwnerRez / Resolve", p.ownerrez_synced_at ?? p.updated_at, true),
        f("Geocoded address", "formatted_address", p.formatted_address, "Google Maps", p.geocoded_at, false),
      ],
    },
    {
      id: "facts",
      title: "Property facts",
      blurb: "Bedrooms, occupancy and stay posture come from OwnerRez. Building systems arrive with the PID field map.",
      fields: [
        f("Bedrooms", "bedrooms", p.bedrooms == null ? null : String(p.bedrooms), "OwnerRez", p.ownerrez_synced_at, true),
        f("Bathrooms", "bathrooms", p.bathrooms == null ? null : String(p.bathrooms), "OwnerRez", p.ownerrez_synced_at, true),
        f("Sleeps", "max_guests", p.max_guests == null ? null : String(p.max_guests), "OwnerRez", p.ownerrez_synced_at, true),
        f("Living area", "living_area_sqft", p.living_area_sqft == null ? null : `${p.living_area_sqft} sq ft`, "OwnerRez", p.ownerrez_synced_at, true),
        f("Property type", "property_type", p.property_type, "OwnerRez", p.ownerrez_synced_at, true),
        f("Check-in / check-out", "check_times", p.check_in_time || p.check_out_time ? `${p.check_in_time ?? "—"} / ${p.check_out_time ?? "—"}` : null, "OwnerRez", p.ownerrez_synced_at, true),
        f("Time zone", "time_zone", p.time_zone, "OwnerRez", p.ownerrez_synced_at, false),
        f("Public listing", "listing_public_url", p.listing_public_url, "OwnerRez", p.ownerrez_synced_at, true),
        pending("Stay type (STR / MTR)", "stay_type", "ARHA"),
        pending("HVAC, water heater, appliances", "building_systems", "ARHA PID"),
      ],
    },
    {
      id: "access",
      title: "Access",
      blurb: "Resolve records where access is held and who to ask. It never stores a live code or password.",
      fields: [
        f("Access notes", "access_notes", p.access_notes, "Resolve", p.updated_at, false),
        pending("Access method & credential holder", "access_credential_ref", "ARHA PID"),
        pending("Parking & garage", "parking", "ARHA PID"),
      ],
    },
    {
      id: "utilities",
      title: "Utilities",
      fields: [pending("Utility providers & billing responsibility", "utilities", "ARHA PID")],
    },
    {
      id: "safety",
      title: "Safety & amenities",
      fields: [
        f("Wi-Fi notes", "wifi_notes", p.wifi_notes, "Resolve", p.updated_at, false),
        pending("Shutoffs, breaker panel, storm shelter", "safety_locations", "ARHA PID"),
        pending("Pool / spa, community amenities", "amenities", "ARHA PID"),
      ],
    },
    {
      id: "operations",
      title: "Operations",
      fields: [
        ...(quarterlyLive
          ? [
              f("Quarterly review due", "quarterly_review_due_on", fmtDate(p.quarterly_review_due_on), "Resolve", p.last_quarterly_review_at, false),
              f("Last quarterly review", "last_quarterly_review_at", fmtDate(p.last_quarterly_review_at), "Resolve", p.last_quarterly_review_at, false),
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
        f("Planned closing", "planned_closing_on", fmtDate(p.planned_closing_on), "Resolve", p.updated_at, true),
        f("Actual closing", "actual_closing_on", fmtDate(p.actual_closing_on), "Resolve", p.updated_at, true),
        f("Access date", "actual_access_on", fmtDate(p.actual_access_on), "Resolve", p.updated_at, true),
        f("Handoff accepted", "handoff_accepted_at", fmtDate(p.handoff_accepted_at), "Resolve", p.handoff_accepted_at, true),
      ],
    },
    {
      id: "external",
      title: "External system identifiers",
      fields: [
        f("OwnerRez id", "ownerrez_property_id", p.ownerrez_property_id, "OwnerRez", p.ownerrez_synced_at, false),
        f("Breezeway home id", "breezeway_property_id", p.breezeway_property_id, "Breezeway", p.breezeway_synced_at, false),
      ],
    },
    {
      id: "compliance",
      title: "Compliance & reference",
      fields: [pending("Permit, licence, insurance and registration status", "compliance_ref", "ARHA compliance record")],
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
  if (uploaderIds.length > 0) {
    const { data: people } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", uploaderIds);
    for (const person of people ?? []) uploaderNames.set(person.id, person.full_name ?? "ARHA staff");
  }

  // Real PID operating information, grouped the way staff ask for it.
  const detailGroups = staff ? buildPropertyDetailGroups(p as unknown as Record<string, unknown>) : [];

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
    if (p1 > 0) alerts.push({ id: "p1", tone: "danger", text: `${p1} open P1 ticket${p1 === 1 ? "" : "s"} on this home.` });
    if (blocked.length > 0)
      alerts.push({ id: "blocked", tone: "danger", text: `${blocked.length} onboarding task${blocked.length === 1 ? " is" : "s are"} blocked.` });
    if (gates.length > 0)
      alerts.push({ id: "gates", tone: "warn", text: `${gates.length} handoff gate${gates.length === 1 ? "" : "s"} still open.` });
    const openConflicts = (conflicts.data ?? []).length;
    if (openConflicts > 0)
      alerts.push({
        id: "conflicts",
        tone: "warn",
        text: `${openConflicts} imported field${openConflicts === 1 ? "" : "s"} disagree with the system of record and need review.`,
      });
    const quarterly = fmtDate(p.quarterly_review_due_on);
    if (quarterly && quarterly < new Date().toISOString().slice(0, 10))
      alerts.push({ id: "quarterly", tone: "warn", text: `Quarterly review was due ${quarterly}.` });
    if (p.lifecycle_status && p.lifecycle_status !== "active_operations")
      alerts.push({ id: "lifecycle", tone: "info", text: `Lifecycle: ${String(p.lifecycle_status).replace(/_/g, " ")}.` });
    if (!p.primary_photo_url) alerts.push({ id: "photo", tone: "info", text: "No listing photo has synced from OwnerRez yet." });
    const replacements = externalLinks.filter((l) => l.needsReplacement).length;
    if (replacements > 0)
      alerts.push({
        id: "temp-links",
        tone: "info",
        text: `${replacements} temporary external link${replacements === 1 ? "" : "s"} still in use pending a native workflow.`,
      });
  }

  return {
    viewer: { staff, supervisor: isSupervisor(viewer), owner: owns },
    property: {
      id: p.id,
      name: p.name,

      nickname: p.nickname,
      address: [p.address_line1, p.unit, p.city, p.state, p.postal_code].filter(Boolean).join(", "),
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
      quarterlyDue: fmtDate(p.quarterly_review_due_on),
      documents: (docs.data ?? []).filter((d) => staff || d.visibility === "owner_shared").length,
      program: program
        ? { id: program.id, ownerName: program.owner_name, status: program.status, startedOn: program.started_on, endsOn: program.ends_on }
        : null,
    },
    details: {
      sections: staff ? sections : sections.filter((s) => ownerVisibleSections.includes(s.id)).map(ownerFilter),
      groups: detailGroups,
    },

    contacts: staff
      ? (contacts.data ?? []).map((c) => ({
          id: c.id,
          name: c.owner_name,
          email: c.owner_email,
          phone: c.owner_phone,
          source: c.source,
          matchStatus: c.match_status,
          syncedAt: c.synced_at,
        }))
      : [],
    onboarding: {
      stage: p.onboarding_stage,
      total: top.length,
      complete,
      subtaskTotal: subs.length,
      subtaskComplete: subsComplete,
      percent: top.length ? Math.round((complete / top.length) * 100) : 0,
      blockers: blocked.slice(0, 10).map((t) => ({ id: t.id, title: t.title, blocker: t.blocker, stage: t.stage })),
      ownerActions: ownerActions.slice(0, 10).map((t) => ({ id: t.id, title: t.title, stage: t.stage, dueOn: t.due_on })),
      current: top
        .filter((t) => t.status !== "complete")
        .slice(0, staff ? 15 : 5)
        .map((t) => ({ id: t.id, title: t.title, stage: t.stage, status: t.status, dueOn: t.due_on, assigned: Boolean(t.assigned_to) })),
      handoff: (handoff.data ?? [])[0] ?? null,
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
    documents: (docs.data ?? [])
      .filter((d) => staff || d.visibility === "owner_shared")
      .map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        visibility: d.visibility,
        status: d.upload_status,
        uploadedAt: d.uploaded_at,
        uploadedByName: d.uploaded_by ? (uploaderNames.get(d.uploaded_by) ?? "ARHA staff") : null,
        entityType: d.entity_type,
        entityId: d.entity_id,
        category: d.category,
        filename: d.original_filename,
        note: d.note,
      })),

    approvals: {
      ownerActions: ownerActions.map((t) => ({
        id: t.id,
        title: t.title,
        stage: t.stage,
        status: t.owner_approval_status ?? "pending",
      })),
      decided: top
        .filter((t) => t.requires_owner_approval && (t.owner_approval_status ?? "pending") !== "pending")
        .map((t) => ({ id: t.id, title: t.title, stage: t.stage, status: t.owner_approval_status ?? "pending" })),
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
    activity: (activity.data ?? [])
      .filter((a) => (a.entity_label ?? "").includes(p.name) || (a.entity_type === "property" && a.entity_label === p.name))
      .slice(0, 25)
      .map((a) => ({
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

function pending(label: string, key: string, source: string): HubField {
  return { label, key, value: null, source, asOf: null, ownerVisible: false, pending: true };
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
