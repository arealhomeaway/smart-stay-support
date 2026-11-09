/**
 * Databases hub: reads the real records for each list, as the person signed
 * in (row security decides what comes back). Shapes them into the pure rows in
 * src/lib/databases.ts. Never writes; the one save for claims and refunds is
 * `saveClaimOrRefund` below, which calls the database save.
 */
import { supabase } from "@/integrations/supabase/client";
import { formatPropertyLabel } from "@/lib/property-label";
import { formerName } from "@/lib/user-removal";
import { ticketStatusLabel } from "@/lib/ticket-lifecycle";
import { notionBadge, showsAssignee } from "@/lib/notion-ticket-display";
import { claimStageLabel, isOpenClaim, amountAtRisk, CLAIM_TYPE_LABELS, type ClaimStage, type ClaimType } from "@/lib/claims";
import { RECOVERY_STAGE_LABELS, RECOVERY_ACTION_LABELS, type RecoveryAction, type RecoveryStage } from "@/lib/guest-recovery";
import { STATUS_LABELS as PLAYBOOK_STATUS_LABELS, type PlaybookStatus } from "@/lib/playbooks";
import { requestStatus } from "@/lib/direct-bookings";
import {
  CLAIM_TILE_LABELS,
  CLAIMS_TO_WORK_FILTER,
  HISTORICAL_FILTER,
  claimOrRefundType,
  claimTiles,
  historicalTag,
  money,
  type ClaimEdit,
  type DatabaseKey,
  type DbLink,
  type DbRow,
} from "@/lib/databases";

export type ListData = { rows: DbRow[]; tiles?: { label: string; value: string }[] };

export type LoadContext = {
  demo: boolean;
  canOpen: (path: string) => boolean;
};

const day = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })
    : "";
};
const words = (v: string | null | undefined) => (v ? v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "");
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

type Home = { id: string; label: string; ownerId: string | null };

async function loadHomes(): Promise<Map<string, Home>> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, address_line1, unit, city, state, postal_code, owner_record_id");
  if (error) throw error;
  return new Map(
    (data ?? []).map((p) => [p.id, { id: p.id, label: formatPropertyLabel(p).primary, ownerId: p.owner_record_id ?? null }]),
  );
}

async function loadPeople(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("profiles").select("id, full_name, removed_at");
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, formerName(p.full_name, p.removed_at)]));
}

/** Read every row, a thousand at a time. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

function homeLink(ctx: LoadContext, id: string | null | undefined, tab?: string): DbLink | undefined {
  if (!id) return undefined;
  if (ctx.canOpen(`/property/${id}`)) return { kind: "property", id, ...(tab ? { tab } : {}) };
  if (ctx.canOpen(`/onboarding/${id}`)) return { kind: "onboarding", id };
  return undefined;
}

function ticketLink(ctx: LoadContext, id: string | null | undefined): DbLink | undefined {
  return id && ctx.canOpen(`/tickets/${id}`) ? { kind: "ticket", id } : undefined;
}

function pageLink(ctx: LoadContext, to: Extract<DbLink, { kind: "page" }>["to"]): DbLink | undefined {
  return ctx.canOpen(to) ? { kind: "page", to } : undefined;
}

const homeName = (homes: Map<string, Home>, id: string | null | undefined) => (id ? (homes.get(id)?.label ?? "") : "");

/* ------------------------------------------------------------------------- */

async function houseItems(ctx: LoadContext): Promise<ListData> {
  const [homes, res] = await Promise.all([
    loadHomes(),
    supabase
      .from("property_assets")
      .select("id, property_id, name, kind, manufacturer, model, serial_number, location, warranty_notes")
      .is("archived_at", null)
      .eq("is_demo", ctx.demo),
  ]);
  if (res.error) throw res.error;
  return {
    rows: (res.data ?? []).map((a) => ({
      id: a.id,
      cells: [homeName(homes, a.property_id), a.name ?? "", [a.manufacturer, a.model].filter(Boolean).join(" "), a.warranty_notes ?? ""],
      fields: [
        { label: "Kind", value: words(a.kind) },
        { label: "Where", value: a.location ?? "" },
        { label: "Serial number", value: a.serial_number ?? "" },
      ],
      link: homeLink(ctx, a.property_id, "house-items"),
    })),
  };
}

async function owners(ctx: LoadContext): Promise<ListData> {
  const [homesMap, res, programs] = await Promise.all([
    loadHomes(),
    supabase.from("property_owners").select("id, name, email, phone, city, state, co_owner_name, co_owner_email, notes, active"),
    supabase.from("owner_programs").select("owner_record_id, status, is_demo").eq("status", "active").eq("is_demo", ctx.demo),
  ]);
  if (res.error) throw res.error;
  const activeOwners = new Set((programs.data ?? []).map((p) => p.owner_record_id).filter(Boolean));
  const homesOf = new Map<string, Home[]>();
  for (const h of homesMap.values()) if (h.ownerId) homesOf.set(h.ownerId, [...(homesOf.get(h.ownerId) ?? []), h]);
  return {
    rows: (res.data ?? []).map((o) => {
      const homes = homesOf.get(o.id) ?? [];
      return {
        id: o.id,
        cells: [o.name ?? "", homes.map((h) => h.label).join(", "), o.email ?? "", activeOwners.has(o.id) ? "Active Owner" : "Owner"],
        fields: [
          { label: "Phone", value: o.phone ?? "" },
          { label: "Co-owner", value: [o.co_owner_name, o.co_owner_email].filter(Boolean).join(", ") },
          { label: "Lives in", value: [o.city, o.state].filter(Boolean).join(", ") },
          { label: "Notes", value: o.notes ?? "" },
        ],
        link: homeLink(ctx, homes[0]?.id, "owner"),
      };
    }),
  };
}

async function utilities(ctx: LoadContext): Promise<ListData> {
  const [homes, res] = await Promise.all([
    loadHomes(),
    supabase
      .from("utility_accounts")
      .select("id, property_id, utility_type, provider, account_label, status, responsible, service_start_on, notes")
      .eq("is_demo", ctx.demo),
  ]);
  if (res.error) throw res.error;
  return {
    rows: (res.data ?? []).map((u) => ({
      id: u.id,
      cells: [homeName(homes, u.property_id), words(u.utility_type), u.provider ?? "", words(u.responsible)],
      fields: [
        { label: "Account", value: u.account_label ?? "" },
        { label: "Status", value: words(u.status) },
        { label: "Service starts", value: day(u.service_start_on) },
        { label: "Notes", value: u.notes ?? "" },
      ],
      link: homeLink(ctx, u.property_id, "utilities"),
    })),
  };
}

async function assessments(ctx: LoadContext): Promise<ListData> {
  const [homes, res] = await Promise.all([
    loadHomes(),
    supabase
      .from("assessment_findings")
      .select("id, property_id, context, category, title, severity, status, created_at")
      .eq("is_demo", ctx.demo)
      .order("created_at", { ascending: false }),
  ]);
  if (res.error) throw res.error;
  // One row per home and assessment, with its findings inside.
  const groups = new Map<string, NonNullable<typeof res.data>>();
  for (const f of res.data ?? []) {
    const key = `${f.property_id}|${f.context ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return {
    rows: [...groups.entries()].map(([key, list]) => {
      const first = list[0]!;
      return {
        id: key,
        cells: [homeName(homes, first.property_id), words(first.context) || "Assessment", day(first.created_at), `${list.length} ${list.length === 1 ? "finding" : "findings"}`],
        fields: list.map((f) => ({ label: [words(f.category), words(f.severity)].filter(Boolean).join(", ") || "Finding", value: [f.title, words(f.status)].filter(Boolean).join(". ") })),
        link: homeLink(ctx, first.property_id, "onboarding"),
      };
    }),
  };
}

async function handoffs(ctx: LoadContext): Promise<ListData> {
  const [homes, people, res] = await Promise.all([
    loadHomes(),
    loadPeople(),
    supabase
      .from("property_handoffs")
      .select("id, property_id, status, requested_by, requested_at, accepted_at, open_task_ids, notes")
      .is("archived_at", null)
      .eq("is_demo", ctx.demo)
      .order("requested_at", { ascending: false }),
  ]);
  if (res.error) throw res.error;
  return {
    rows: (res.data ?? []).map((h) => {
      const carried = Array.isArray(h.open_task_ids) ? h.open_task_ids.length : 0;
      return {
        id: h.id,
        cells: [
          homeName(homes, h.property_id),
          day(h.accepted_at ?? h.requested_at),
          h.requested_by ? (people.get(h.requested_by) ?? "") : "",
          words(h.status),
          String(carried),
        ],
        fields: [{ label: "Notes", value: h.notes ?? "" }],
        link: homeLink(ctx, h.property_id, "onboarding"),
      };
    }),
  };
}

async function budgets(ctx: LoadContext): Promise<ListData> {
  const [homes, res, lines] = await Promise.all([
    loadHomes(),
    supabase.from("onboarding_budgets").select("id, property_id, approved_amount, approved_basis, notes").eq("is_demo", ctx.demo),
    supabase.from("onboarding_budget_lines").select("budget_id, category, label, estimated_amount, actual_amount, status").eq("is_demo", ctx.demo),
  ]);
  if (res.error) throw res.error;
  if (lines.error) throw lines.error;
  return {
    rows: (res.data ?? []).map((b) => {
      const mine = (lines.data ?? []).filter((l) => l.budget_id === b.id);
      const repairs = mine.filter((l) => /repair/i.test(`${l.category ?? ""} ${l.label ?? ""}`));
      const repair = repairs.reduce((s, l) => s + (num(l.estimated_amount) ?? 0), 0);
      const statuses = [...new Set(mine.map((l) => words(l.status)).filter(Boolean))];
      return {
        id: b.id,
        cells: [homeName(homes, b.property_id), money(num(b.approved_amount)), repairs.length ? money(repair) : "", statuses.join(", ")],
        fields: [
          { label: "Budget basis", value: words(b.approved_basis) },
          { label: "Notes", value: b.notes ?? "" },
          ...mine.map((l) => ({ label: l.label ?? words(l.category), value: [money(num(l.actual_amount) ?? num(l.estimated_amount)), words(l.status)].filter(Boolean).join(", ") })),
        ],
        link: homeLink(ctx, b.property_id, "onboarding"),
      };
    }),
  };
}

type ClaimRow = {
  id: string;
  ticket_id: string | null;
  property_id: string | null;
  title: string;
  claim_type: string;
  stage: string;
  estimated_amount: number | null;
  actual_cost: number | null;
  submitted_amount: number | null;
  recovered_amount: number | null;
  follow_up_on: string | null;
  incident_description: string | null;
  updated_at: string;
};
type RefundRow = {
  id: string;
  ticket_id: string | null;
  property_id: string | null;
  title: string;
  stage: string;
  recovery_action: string | null;
  proposed_amount: number | null;
  approved_amount: number | null;
  delivered_amount: number | null;
  follow_up_on: string | null;
  updated_at: string;
};

async function loadClaimsAndRefunds(demo: boolean) {
  const [claims, refunds] = await Promise.all([
    supabase
      .from("claims")
      .select("id, ticket_id, property_id, title, claim_type, stage, estimated_amount, actual_cost, submitted_amount, recovered_amount, follow_up_on, incident_description, updated_at")
      .eq("is_demo", demo)
      .order("created_at", { ascending: false }),
    supabase
      .from("guest_recovery")
      .select("id, ticket_id, property_id, title, stage, recovery_action, proposed_amount, approved_amount, delivered_amount, follow_up_on, updated_at")
      .eq("is_demo", demo)
      .order("created_at", { ascending: false }),
  ]);
  if (claims.error) throw claims.error;
  if (refunds.error) throw refunds.error;
  return { claims: (claims.data ?? []) as ClaimRow[], refunds: (refunds.data ?? []) as RefundRow[] };
}

async function claimsList(ctx: LoadContext): Promise<ListData> {
  const [homes, { claims, refunds }] = await Promise.all([loadHomes(), loadClaimsAndRefunds(ctx.demo)]);
  const rows: DbRow[] = [];
  for (const c of claims) {
    const stage = c.stage as ClaimStage;
    rows.push({
      id: `claim:${c.id}`,
      cells: [c.title, homeName(homes, c.property_id), "Claim", money(amountAtRisk({ ...c, claim_type: c.claim_type as ClaimType, stage })), claimStageLabel({ stage, incident_description: c.incident_description })],
      fields: [
        { label: "Claim type", value: CLAIM_TYPE_LABELS[c.claim_type as ClaimType] ?? words(c.claim_type) },
        { label: "Estimated cost", value: money(num(c.estimated_amount)) },
        { label: "Amount sent", value: money(num(c.submitted_amount)) },
        { label: "Amount paid back", value: money(num(c.recovered_amount)) },
        { label: "Follow up on", value: day(c.follow_up_on) },
      ],
      link: ticketLink(ctx, c.ticket_id),
      edit: {
        kind: "claim",
        id: c.id,
        updatedAt: c.updated_at,
        values: {
          title: c.title ?? "",
          stage: c.stage,
          estimated_amount: c.estimated_amount === null ? "" : String(c.estimated_amount),
          submitted_amount: c.submitted_amount === null ? "" : String(c.submitted_amount),
          recovered_amount: c.recovered_amount === null ? "" : String(c.recovered_amount),
          follow_up_on: c.follow_up_on ?? "",
        },
      },
    });
  }
  for (const r of refunds) {
    const amount = num(r.delivered_amount) ?? num(r.approved_amount) ?? num(r.proposed_amount);
    rows.push({
      id: `refund:${r.id}`,
      cells: [r.title, homeName(homes, r.property_id), claimOrRefundType("refund", r.recovery_action), money(amount), RECOVERY_STAGE_LABELS[r.stage as RecoveryStage] ?? words(r.stage)],
      fields: [
        { label: "Remedy", value: r.recovery_action ? (RECOVERY_ACTION_LABELS[r.recovery_action as RecoveryAction] ?? words(r.recovery_action)) : "" },
        { label: "Amount asked for", value: money(num(r.proposed_amount)) },
        { label: "Amount approved", value: money(num(r.approved_amount)) },
        { label: "Amount given", value: money(num(r.delivered_amount)) },
        { label: "Follow up on", value: day(r.follow_up_on) },
      ],
      link: ticketLink(ctx, r.ticket_id),
      edit: {
        kind: "refund",
        id: r.id,
        updatedAt: r.updated_at,
        values: {
          title: r.title ?? "",
          proposed_amount: r.proposed_amount === null ? "" : String(r.proposed_amount),
          follow_up_on: r.follow_up_on ?? "",
        },
      },
    });
  }
  const tiles = claimTiles(claims.map((c) => ({ ...c, claim_type: c.claim_type as ClaimType, stage: c.stage as ClaimStage })));
  return {
    rows,
    tiles: [
      { label: CLAIM_TILE_LABELS.atRisk, value: money(tiles.atRisk) || "$0" },
      { label: CLAIM_TILE_LABELS.payback, value: money(tiles.payback) || "$0" },
    ],
  };
}

async function tickets(ctx: LoadContext): Promise<ListData> {
  const [homes, people, types, { claims, refunds }, rows] = await Promise.all([
    loadHomes(),
    loadPeople(),
    supabase.from("work_types").select("id, name"),
    loadClaimsAndRefunds(ctx.demo),
    readAll((from, to) =>
      supabase
        .from("tickets")
        .select("id, ref, title, property_id, work_type_id, status, assigned_to, external_source, external_status, reported_at, import_hold, created_at")
        .eq("is_demo", ctx.demo)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
  ]);
  if (types.error) throw types.error;
  const typeName = new Map((types.data ?? []).map((t) => [t.id, t.name]));
  const toWork = new Set<string>();
  for (const c of claims) if (c.ticket_id && isOpenClaim(c.stage as ClaimStage)) toWork.add(c.ticket_id);
  for (const r of refunds) if (r.ticket_id && r.stage !== "closed") toWork.add(r.ticket_id);
  return {
    rows: rows.map((t) => {
      const badge = notionBadge(t);
      const owner = showsAssignee(t) && t.assigned_to ? (people.get(t.assigned_to) ?? "") : "";
      return {
        id: t.id,
        cells: [
          t.ref === null || t.ref === undefined ? "" : String(t.ref),
          t.title ?? "",
          homeName(homes, t.property_id),
          t.work_type_id ? (typeName.get(t.work_type_id) ?? "") : "",
          ticketStatusLabel(t.status),
          owner,
        ],
        fields: [
          ...(badge ? [{ label: "Record", value: badge }] : []),
          { label: "Reported", value: day(t.reported_at ?? t.created_at) },
        ],
        tags: { [HISTORICAL_FILTER]: historicalTag(t), ...(toWork.has(t.id) ? { [CLAIMS_TO_WORK_FILTER]: CLAIMS_TO_WORK_FILTER } : {}) },
        link: ticketLink(ctx, t.id),
      };
    }),
  };
}

async function departureReviews(ctx: LoadContext): Promise<ListData> {
  const [homes, res] = await Promise.all([
    loadHomes(),
    supabase
      .from("departure_reviews")
      .select("id, property_id, stay_departure, guest_name, clean_reviewed_at, clean_completed_at, damage_screen, damage_description, outreach_status, status")
      .eq("is_demo", ctx.demo)
      .order("stay_departure", { ascending: false }),
  ]);
  if (res.error) throw res.error;
  const damage: Record<string, string> = { yes: "Yes", no: "No" };
  return {
    rows: (res.data ?? []).map((d) => ({
      id: d.id,
      cells: [
        homeName(homes, d.property_id),
        day(d.stay_departure),
        d.clean_reviewed_at ? day(d.clean_reviewed_at) : "Not yet",
        d.damage_screen ? (damage[d.damage_screen] ?? words(d.damage_screen)) : "",
        words(d.outreach_status),
      ],
      fields: [
        { label: "Guest", value: d.guest_name ?? "" },
        { label: "Clean finished", value: day(d.clean_completed_at) },
        { label: "Damage notes", value: d.damage_description ?? "" },
        { label: "Review", value: words(d.status) },
      ],
      link: homeLink(ctx, d.property_id, "operations"),
    })),
  };
}

async function reviews(ctx: LoadContext): Promise<ListData> {
  const [homes, rows] = await Promise.all([
    loadHomes(),
    readAll((from, to) =>
      supabase
        .from("guest_feedback")
        .select("id, property_id, source, booking_platform, rating, submitted_at, follow_up_status, follow_up_required, summary, reviewer_display_name, ticket_id, feedback_type")
        .eq("is_demo", ctx.demo)
        .order("submitted_at", { ascending: false })
        .range(from, to),
    ),
  ]);
  const source = (f: { source: string | null; booking_platform: string | null }) =>
    f.source === "resolve_survey" ? "Guest survey" : f.booking_platform || words(f.source);
  const follow: Record<string, string> = { open: "Open", completed: "Done", none: "None" };
  return {
    rows: rows.map((f) => ({
      id: f.id,
      cells: [
        homeName(homes, f.property_id),
        source(f),
        f.rating === null || f.rating === undefined ? "" : String(f.rating),
        day(f.submitted_at),
        f.follow_up_status ? (follow[f.follow_up_status] ?? words(f.follow_up_status)) : "",
      ],
      fields: [
        { label: "Reviewer", value: f.reviewer_display_name ?? "" },
        { label: "What they said", value: f.summary ?? "" },
      ],
      link: ticketLink(ctx, f.ticket_id) ?? homeLink(ctx, f.property_id, f.source === "resolve_survey" ? "surveys" : "reviews"),
    })),
  };
}

async function vendorInvoices(ctx: LoadContext): Promise<ListData> {
  const [homes, res, links] = await Promise.all([
    loadHomes(),
    supabase
      .from("expenses")
      .select("id, property_id, payee, amount, vendor_invoice_ref, reason, finance_review, invoice_date, expense_date, is_estimate")
      .is("archived_at", null)
      .eq("is_demo", ctx.demo)
      .order("created_at", { ascending: false }),
    supabase.from("expense_links").select("expense_id, link_type, target_id"),
  ]);
  if (res.error) throw res.error;
  const ticketOf = new Map<string, string>();
  for (const l of links.data ?? []) if (l.link_type === "ticket" && !ticketOf.has(l.expense_id)) ticketOf.set(l.expense_id, l.target_id);
  return {
    rows: (res.data ?? []).map((e) => ({
      id: e.id,
      cells: [e.vendor_invoice_ref || e.reason || "Invoice", e.payee ?? "", homeName(homes, e.property_id), money(num(e.amount)), e.is_estimate ? "Estimate" : words(e.finance_review)],
      fields: [
        { label: "Invoice date", value: day(e.invoice_date ?? e.expense_date) },
        { label: "Reason", value: e.reason ?? "" },
      ],
      link: ticketLink(ctx, ticketOf.get(e.id)) ?? pageLink(ctx, "/finance"),
    })),
  };
}

async function directBookings(ctx: LoadContext): Promise<ListData> {
  const [res, sources] = await Promise.all([
    supabase
      .from("leads")
      .select("id, subject, contact_name, company, partner_name, inquiry_source_id, desired_move_in, desired_check_out, created_at, owned_by, reply_sent_at, outcome, partner_approved_at, quote_amount, notes")
      .eq("is_demo", ctx.demo)
      .eq("kind", "direct_booking")
      .order("created_at", { ascending: false }),
    supabase.from("inquiry_sources").select("id, name"),
  ]);
  if (res.error) throw res.error;
  const sourceName = new Map((sources.data ?? []).map((s) => [s.id, s.name]));
  const label: Record<string, string> = {
    new: "Open",
    working: "Open",
    waiting_approval: "Open",
    sent: "Waiting on the partner",
    partner_approved: "Approved",
    booked: "Booked",
    not_booked: "Not booked",
  };
  return {
    rows: (res.data ?? []).map((l) => ({
      id: l.id,
      cells: [
        l.subject || l.contact_name || l.company || "Request",
        (l.inquiry_source_id ? sourceName.get(l.inquiry_source_id) : null) ?? l.partner_name ?? "",
        [day(l.desired_move_in), day(l.desired_check_out)].filter(Boolean).join(" to "),
        label[requestStatus({ ...l, pending_approval: false })] ?? "",
        money(num(l.quote_amount)),
      ],
      fields: [
        { label: "Contact", value: [l.contact_name, l.company].filter(Boolean).join(", ") },
        { label: "Arrived", value: day(l.created_at) },
        { label: "Notes", value: l.notes ?? "" },
      ],
      link: ctx.canOpen(`/direct-bookings/${l.id}`) ? { kind: "booking", id: l.id } : undefined,
    })),
  };
}

async function referralSources(ctx: LoadContext): Promise<ListData> {
  const { data, error } = await supabase
    .from("inquiry_sources")
    .select("id, name, source_type, cleaning_fee, security_deposit, referral_rule, discount_percent, pet_fee_notes, active")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return {
    rows: (data ?? []).map((s) => ({
      id: s.id,
      cells: [s.name ?? "", s.source_type ?? "", money(num(s.cleaning_fee)), money(num(s.security_deposit))],
      fields: [
        { label: "Referral rule", value: s.referral_rule ?? "" },
        { label: "Discount", value: s.discount_percent === null || s.discount_percent === undefined ? "" : `${s.discount_percent}%` },
        { label: "Pets", value: s.pet_fee_notes ?? "" },
      ],
      link: pageLink(ctx, "/inquiry-sources"),
    })),
  };
}

async function playbooks(ctx: LoadContext): Promise<ListData> {
  const [people, res] = await Promise.all([
    loadPeople(),
    supabase.from("playbooks").select("id, title, category, status, approved_by, submitted_by, updated_at, summary, version").order("title"),
  ]);
  if (res.error) throw res.error;
  return {
    rows: (res.data ?? []).map((p) => {
      const status = (p.status === "active" ? "approved" : p.status) as PlaybookStatus;
      const owner = p.approved_by ?? p.submitted_by;
      return {
        id: p.id,
        cells: [p.title ?? "", PLAYBOOK_STATUS_LABELS[status] ?? words(p.status), owner ? (people.get(owner) ?? "") : "", day(p.updated_at)],
        fields: [
          { label: "Kind of work", value: words(p.category) },
          { label: "Version", value: p.version === null || p.version === undefined ? "" : String(p.version) },
          { label: "About", value: p.summary ?? "" },
        ],
        link: pageLink(ctx, "/playbooks"),
      };
    }),
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const TEAM_LABELS: Record<string, string> = {
  guest_experience: "Guest Experience",
  property_operations: "Property Operations",
  operations: "Operations",
  leadership: "Leadership",
  onboarding: "Onboarding",
};

async function team(ctx: LoadContext): Promise<ListData> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const [people, roles, shifts, oncall] = await Promise.all([
    loadPeople(),
    supabase.from("functional_roles").select("code, name, team, current_seat_holder, active, sort_order").eq("active", true).order("sort_order"),
    supabase.from("coverage_shifts").select("role_code, weekday, start_minute, end_minute, active").eq("active", true),
    supabase.rpc("oncall_user_for_night", { _night: today }),
  ]);
  if (roles.error) throw roles.error;
  if (shifts.error) throw shifts.error;
  const tonight = typeof oncall.data === "string" ? oncall.data : null;
  const rows: DbRow[] = [];
  for (const r of roles.data ?? []) {
    const mine = (shifts.data ?? []).filter((s) => s.role_code === r.code).sort((a, b) => a.weekday - b.weekday);
    if (!mine.length && r.current_seat_holder !== tonight) continue;
    const byTime = new Map<string, number[]>();
    for (const s of mine) {
      const k = `${clock(s.start_minute)} to ${clock(s.end_minute)}`;
      byTime.set(k, [...(byTime.get(k) ?? []), s.weekday]);
    }
    const shift = [...byTime.entries()].map(([time, ds]) => `${ds.map((d) => WEEKDAYS[d] ?? "").join(", ")} ${time}`).join("; ");
    const person = r.current_seat_holder ? (people.get(r.current_seat_holder) ?? "") : "";
    rows.push({
      id: r.code,
      cells: [person || "Open", TEAM_LABELS[r.team ?? ""] ?? words(r.team), shift, r.current_seat_holder && r.current_seat_holder === tonight ? "Tonight" : ""],
      fields: [{ label: "Role", value: r.name ?? "" }],
      link: pageLink(ctx, "/team"),
    });
  }
  return { rows };
}

const LOADERS: Partial<Record<DatabaseKey, (ctx: LoadContext) => Promise<ListData>>> = {
  "house-items": houseItems,
  owners,
  utilities,
  assessments,
  handoffs,
  budgets,
  tickets,
  "departure-reviews": departureReviews,
  reviews,
  claims: claimsList,
  "vendor-invoices": vendorInvoices,
  "direct-bookings": directBookings,
  "referral-sources": referralSources,
  playbooks,
  team,
};

/** Inventory and Inspections have no stored records yet: they show Nothing here yet. */
export function hasStore(key: DatabaseKey): boolean {
  return Boolean(LOADERS[key]);
}

export async function loadDatabase(key: DatabaseKey, ctx: LoadContext): Promise<ListData> {
  const load = LOADERS[key];
  return load ? load(ctx) : { rows: [] };
}

export const databaseQueryKey = (key: DatabaseKey, demo: boolean) => ["databases", key, demo] as const;

/**
 * Properties and Vendors open their own pages, but the hub search still finds
 * a home or a vendor by name: one row each, opening that page.
 */
export type PageHit = { key: "properties" | "vendors"; id: string; label: string; sub: string };

export async function loadPageHits(ctx: LoadContext, keys: ("properties" | "vendors")[]): Promise<PageHit[]> {
  const out: PageHit[] = [];
  if (keys.includes("properties")) {
    const { data, error } = await supabase
      .from("properties")
      .select("id, name, nickname, address_line1, unit, city, state, postal_code, market")
      .is("archived_at", null)
      .eq("is_demo", ctx.demo);
    if (error) throw error;
    for (const p of data ?? []) {
      const label = formatPropertyLabel(p);
      out.push({ key: "properties", id: p.id, label: label.primary, sub: [label.secondary, p.name, p.nickname, p.market].filter(Boolean).join(" · ") });
    }
  }
  if (keys.includes("vendors")) {
    const { data, error } = await supabase.from("vendor_orgs").select("id, display_name, status, markets").eq("is_demo", ctx.demo);
    if (error) throw error;
    for (const v of data ?? []) {
      const markets = Array.isArray(v.markets) ? v.markets.join(", ") : "";
      out.push({ key: "vendors", id: v.id, label: v.display_name ?? "Vendor", sub: [words(v.status), markets].filter(Boolean).join(" · ") });
    }
  }
  return out;
}

/** Save a claim or refund changed in the list (docs/pending/databases/01_databases.sql). */
export async function saveClaimOrRefund(edit: ClaimEdit, changes: Record<string, string | number | null>) {
  const { data, error } = await supabase.rpc("databases_save_claim_or_refund", {
    _kind: edit.kind,
    _id: edit.id,
    _changes: changes,
    _expected_updated_at: edit.updatedAt,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { savedAt: new Date(row?.saved_at ?? Date.now()) };
}
