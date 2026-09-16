/**
 * The homeowner's own view of their participation program (server-only).
 *
 * One homeowner, one program, one 90-day clock, one combined hour
 * commitment — across every home attached to the program. Ticket visibility
 * is automatic: enrolling a property is what turns on the feed. Internal
 * staff chatter is never included.
 *
 * Time is only ever what the homeowner typed in. Nothing here prefills,
 * estimates, multiplies by property count or duplicates an entry.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadProgramAggregate } from "./owner-participation.server";
import { redeemOwnerInviteAtomically } from "./owner-invite-redemption.server";
import { syncBadges } from "./owner-badges.server";
import { loadOwnerTicketProjection } from "./owner-ticket-projection.server";
import { ownerNotificationText } from "./owner-notification";
import { automaticOpportunityView } from "./owner-automatic-opportunity";
import { ownerProgramProjection } from "./owner-program-projection";
import { loadOwnerResponseReceipts } from "./owner-response-history.server";
export type { OwnerTicket } from "./owner-ticket-projection.server";

type Client = SupabaseClient<Database>;

/** Everything the owner hub renders, in one round trip. */
export async function loadOwnerHome(supabase: Client, userId: string) {
  const program = await supabase
    .from("owner_programs")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (program.error) throw program.error;
  if (!program.data) return { linked: false as const };
  return loadOwnerHomeByProgram(supabase, program.data.id);
}

/**
 * Read-only preview of one homeowner hub for a Platform Owner.
 *
 * Staff deliberately pick a program on the Active Owner board and Resolve
 * renders that program's owner/property context — never the admin's own
 * account. With no explicit pick it falls back to the newest program.
 */
export async function loadOwnerHomePreview(
  supabase: Client,
  userId: string,
  programId?: string | null,
) {
  const { assertAdmin } = await import("./access.server");
  await assertAdmin(supabase, userId);
  let id = programId ?? null;
  if (!id) {
    const program = await supabase
      .from("owner_programs")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (program.error) throw program.error;
    if (!program.data) return { linked: false as const, preview: true as const };
    id = program.data.id;
  }
  return { ...(await loadOwnerHomeByProgram(supabase, id, true)), preview: true as const };
}

async function loadOwnerHomeByProgram(supabase: Client, programId: string, preview = false) {
  const agg = await loadProgramAggregate(supabase, programId);

  const propertyIds = agg.includedProperties.map((p) => p.propertyId);

  const [alerts, tickets] = await Promise.all([
    supabase
      .from("owner_notifications")
      .select(
        "id, kind, priority, title, body, ticket_id, review_id, read_at, email_status, sms_status, created_at",
      )
      .eq("program_id", agg.program.id)
      .order("created_at", { ascending: false })
      .limit(60),
    loadOwnerTicketProjection(supabase, propertyIds, preview, programId),
  ]);
  if (alerts.error) throw alerts.error;
  const receipts = await loadOwnerResponseReceipts(supabase, programId);

  // Keep achievements current whenever the owner opens the hub.
  // A preview never writes: it reads whatever badges already exist.
  if (!preview) await syncBadges(supabase, agg);
  const badges = await supabase
    .from("owner_badges")
    .select("code, awarded_at, trigger_rule, needs_review")
    .eq("program_id", agg.program.id)
    .order("awarded_at");

  return {
    linked: true as const,
    program: ownerProgramProjection(agg.program),
    properties: agg.properties,
    reviews: agg.reviews.map((review) =>
      automaticOpportunityView(
        review,
        tickets.find((ticket) => ticket.id === review.ticket_id),
      ),
    ),
    entries: agg.entries,
    responseReceipts: receipts,
    badges: badges.data ?? agg.badges,
    alerts: (alerts.data ?? []).map((row) => ({ ...row, ...ownerNotificationText(row) })),
    tickets,
    reportedMinutes: agg.reportedMinutes,
    approvedMinutes: agg.approvedMinutes,
    pendingReviewMinutes: agg.pendingReviewMinutes,
    returnedMinutes: agg.returnedMinutes,
    onboardingMinutes: agg.onboardingMinutes,
    operationalMinutes: agg.operationalMinutes,
    snapshot: agg.snapshot,
  };
}

export async function markAlertsRead(supabase: Client, ids: string[]) {
  if (ids.length === 0) return { ok: true as const };
  const { error } = await supabase
    .from("owner_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);
  if (error) throw error;
  return { ok: true as const };
}

/** Owner-controlled alert channels. Only their own program is reachable. */
export async function saveAlertPreferences(
  supabase: Client,
  userId: string,
  input: { email: boolean; smsP1: boolean; push: boolean; phone: string },
) {
  const { error } = await supabase
    .from("owner_programs")
    .update({
      notify_email: input.email,
      notify_sms_p1: input.smsP1,
      notify_push: input.push,
      owner_phone: input.phone || null,
    })
    .eq("owner_user_id", userId);
  if (error) throw error;
  return { ok: true as const };
}

export type LogTimeInput = {
  ownerUpdateRevision?: number | null;
  programId: string;
  phase: "onboarding" | "ongoing";
  entryDate: string;
  minutes: number;
  activity: string;
  activityCategory: string;
  output: string;
  comments: string;
  attachmentPath: string | null;
  reviewId: string | null;
  ticketId: string | null;
  propertyIds: string[];
  confirmed: true;
};

/**
 * One activity, one entry, one canonical minutes value. A shared activity is
 * linked to several homes but its minutes are stored exactly once, so the
 * combined total can never double count.
 */
export async function logOwnerTime(supabase: Client, userId: string, input: LogTimeInput) {
  // Every new entry is anchored to a documented participation opportunity.
  // Legacy entries created before this rule keep their history untouched.
  if (!input.reviewId) {
    throw new Error("Choose the participation opportunity this time belongs to.");
  }
  const opportunity = await supabase
    .from("owner_reviews")
    .select("id, program_id, status, available_from, property_id, task_type")
    .eq("id", input.reviewId)
    .eq("program_id", input.programId)
    .maybeSingle();
  if (opportunity.error) throw opportunity.error;
  if (!opportunity.data) {
    throw new Error("That participation opportunity is not part of your program.");
  }
  if (opportunity.data.status === "closed") {
    throw new Error("That opportunity is no longer available.");
  }
  if (
    opportunity.data.available_from &&
    new Date(opportunity.data.available_from).getTime() > Date.now()
  ) {
    throw new Error("That opportunity is not open yet.");
  }
  if (
    input.propertyIds.length === 0 &&
    opportunity.data.property_id &&
    opportunity.data.task_type !== "multi_property"
  ) {
    input = { ...input, propertyIds: [opportunity.data.property_id] };
  }
  const opportunityPropertyId =
    opportunity.data.task_type === "multi_property" ? null : opportunity.data.property_id;
  if (
    opportunityPropertyId &&
    input.propertyIds.some((propertyId) => propertyId !== opportunityPropertyId)
  ) {
    throw new Error("This participation opportunity belongs to a different property.");
  }

  const program = await supabase
    .from("owner_programs")
    .select("owner_user_id,started_on,status")
    .eq("id", input.programId)
    .maybeSingle();
  if (program.error) throw program.error;
  if (!program.data || program.data.owner_user_id !== userId)
    throw new Error("That participation program is not available to you.");
  if (!["active", "target_reached"].includes(program.data.status) || !program.data.started_on)
    throw new Error(
      "Your ARHA contact must activate this program before new participation can be logged.",
    );
  if (
    input.entryDate < program.data.started_on ||
    input.entryDate > new Date().toISOString().slice(0, 10)
  )
    throw new Error("Choose a date from the program start through today.");

  const links = await supabase
    .from("owner_program_properties")
    .select("property_id, closing_date, inclusion_status")
    .eq("program_id", input.programId);
  if (links.error) throw links.error;

  // Only homes currently included in the program can carry participation.
  const allowed = new Map(
    (links.data ?? [])
      .filter((l) => l.inclusion_status === "included")
      .map((l) => [l.property_id, l]),
  );
  const chosen = [...new Set(input.propertyIds)].filter((id) => allowed.has(id));
  if (chosen.length !== new Set(input.propertyIds).size)
    throw new Error("Participation can only include properties enrolled in this program.");
  for (const id of chosen) {
    const link = allowed.get(id)!;

    // A home cannot carry participation from before it closed.
    if (!link.closing_date || input.entryDate < link.closing_date) {
      throw new Error(
        "That date is before this property's closing date. Please choose a date on or after closing.",
      );
    }
  }

  const { data: entryId, error } = await supabase.rpc("log_owner_time_entry", {
    _entry: { ...input },
    _property_ids: chosen,
  });
  if (error) throw error;
  if (!entryId) throw new Error("The participation entry could not be recorded.");

  // Activity timestamps and evidence are committed by the same transaction.
  // The next hub load refreshes badges; a later read failure must never invite
  // the owner to submit this already-recorded activity a second time.
  return { ok: true as const, entryId, awarded: [] as string[] };
}

/**
 * The homeowner corrects an entry a reviewer returned to them. The original is
 * never edited: it stays in the history as returned, and the corrected entry
 * points back at it, so only one of the pair is ever counted.
 */
export async function resubmitOwnerTime(
  supabase: Client,
  userId: string,
  input: { entryId: string; minutes: number; activity: string; note: string },
) {
  const original = await supabase
    .from("owner_time_entries")
    .select(
      "id, program_id, owner_user_id, phase, entry_date, activity, activity_category, output, comments, review_id, ticket_id, review_status",
    )
    .eq("id", input.entryId)
    .single();
  if (original.error) throw original.error;
  if (original.data.owner_user_id !== userId) {
    throw new Error("That entry belongs to another homeowner.");
  }
  if (original.data.review_status !== "returned") {
    throw new Error("Only an entry your ARHA contact returned to you can be corrected.");
  }

  const already = await supabase
    .from("owner_time_entries")
    .select("id")
    .eq("amends_entry_id", input.entryId)
    .limit(1);
  if (already.error) throw already.error;
  if ((already.data ?? []).length > 0) {
    throw new Error("This entry has already been corrected and resubmitted.");
  }

  const corrected = await supabase.rpc("resubmit_owner_time_entry", {
    _entry_id: input.entryId,
    _minutes: input.minutes,
    _activity: input.activity,
    _note: input.note,
  });
  if (corrected.error) throw corrected.error;
  if (!corrected.data) throw new Error("The corrected entry could not be recorded.");
  return { ok: true as const, entryId: corrected.data };
}

/** Owner answers a task that was waiting on them. */
export async function respondToReview(
  supabase: Client,
  userId: string,
  input: {
    reviewId: string;
    expectedUpdatedAt: string;
    decision: string;
    response: string;
    ownerUpdateRevision?: number | null;
  },
) {
  const review = await supabase
    .from("owner_reviews")
    .select("id, program_id, title, status, auto_ticket, available_from, updated_at")
    .eq("id", input.reviewId)
    .single();
  if (review.error) throw review.error;

  const program = await supabase
    .from("owner_programs")
    .select("owner_user_id, archived_at, status")
    .eq("id", review.data.program_id)
    .single();
  if (program.error) throw program.error;
  if (
    program.data.owner_user_id !== userId ||
    program.data.archived_at ||
    ["closed", "completed"].includes(program.data.status)
  )
    throw new Error("This participation program is not available for your response.");
  if (
    !["awaiting_owner", "returned"].includes(review.data.status) ||
    (review.data.available_from && new Date(review.data.available_from).getTime() > Date.now())
  )
    throw new Error("This opportunity is not currently awaiting your response.");
  if (review.data.auto_ticket && input.decision !== "acknowledged")
    throw new Error(
      "Use the canonical approval request to approve or decline work. This response records participation only.",
    );

  const { data: saved, error } = await supabase.rpc("respond_owner_review", {
    _review_id: input.reviewId,
    _expected_updated_at: input.expectedUpdatedAt,
    _decision: input.decision,
    _response: input.response,
    _owner_update_revision: input.ownerUpdateRevision ?? null,
  });
  if (error) throw error;
  if (!saved) throw new Error("The response could not be recorded.");
  // The next hub load refreshes badges; a badge failure must not report this committed response as failed.
  return { ok: true as const };
}

/** Links a signed-in account using the service-only, atomic redemption action. */
export async function redeemOwnerInvite(
  admin: Client,
  userId: string,
  _userEmail: string | null,
  code: string,
) {
  // Email claims and contact text never select an Owner or grant access. The
  // database verifies the existing account against this code's explicit recipient.
  return redeemOwnerInviteAtomically(admin, userId, code);
}

/* ------------------------------------------------------------------ *
 * Stage 3 — a homeowner opens a ticket at their own enrolled home.
 *
 * This reuses the Resolve ticket record. There is no separate owner ticket
 * system, and the row is only accepted by the database when the property is
 * one the signed-in owner is enrolled in.
 * ------------------------------------------------------------------ */

export type OwnerParticipationPath = "inform" | "consult" | "approve" | "emergency";

export async function createOwnerMatter(
  supabase: Client,
  _userId: string,
  input: {
    programId: string;
    propertyId: string;
    path: OwnerParticipationPath;
    title: string;
    description: string;
    category: string;
  },
) {
  // The signed-in database identity is the actor; no caller-supplied actor or
  // operational columns are accepted. Ticket + opportunity + event are atomic.
  const { data, error } = await supabase.rpc("create_owner_matter", {
    _program_id: input.programId,
    _property_id: input.propertyId,
    _path: input.path,
    _title: input.title,
    _description: input.description,
    _category: input.category,
  });
  if (error) throw error;
  const matter = data?.[0];
  if (!matter?.ticket_id || !Number.isFinite(matter.ref)) {
    throw new Error("The property matter was not confirmed. Refresh before trying again.");
  }
  return { ok: true as const, ticketId: matter.ticket_id, ref: matter.ref };
}
/* ------------------------------------------------------------------ */
/* Homeowner approval decisions                                        */
/* ------------------------------------------------------------------ */

export type OwnerApproval = {
  id: string;
  updated_at: string;
  kind: string;
  title: string;
  detail: string | null;
  amount: number | null;
  currency: string;
  status: string;
  decision_note: string | null;
  decided_at: string | null;
  due_on: string | null;
  evidence_url: string | null;
  property_id: string | null;
  property_name: string | null;
  /** Home is enrolled in the 90-Day Owner Participation Program. */
  active_owner: boolean;
  created_at: string;
};

/**
 * Non-demo owner-role requests addressed to this homeowner. These filters are
 * required even when the account also has staff permissions. Property labels
 * are not an authorization check; current canonical relationship checks remain
 * a separate requirement from the recipient and role boundary.
 */
export async function loadOwnerApprovals(
  supabase: Client,
  userId: string,
): Promise<OwnerApproval[]> {
  const { data, error } = await supabase
    .from("approvals")
    .select(
      "id, updated_at, kind, title, detail, amount, currency, status, decision_note, decided_at, due_on, evidence_url, property_id, approver_id, created_at",
    )
    .eq("approver_id", userId)
    .eq("approver_role", "owner")
    .eq("is_demo", false)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.property_id).filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const props = await supabase.from("properties").select("id, name").in("id", ids);
    if (props.error) throw props.error;
    for (const p of props.data ?? []) names.set(p.id, p.name);
  }
  const { activeOwnerLinks } = await import("./active-owner.server");
  const participation = ids.length ? await activeOwnerLinks(supabase, ids) : new Map();
  return rows.map((r) => ({
    id: r.id,
    updated_at: r.updated_at,
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    decision_note: r.decision_note,
    decided_at: r.decided_at,
    due_on: r.due_on,
    evidence_url: r.evidence_url,
    property_id: r.property_id,
    property_name: r.property_id ? (names.get(r.property_id) ?? null) : null,
    active_owner: Boolean(r.property_id && participation.has(r.property_id)),
    created_at: r.created_at,
  }));
}

/**
 * Record one homeowner decision. Authorisation is enforced server-side and
 * again by RLS. The `status = pending` filter makes the write single-shot:
 * a second submission (or a race) changes zero rows and is reported back
 * instead of silently overwriting the first decision.
 *
 * Nothing here awards participation hours or sends live notifications.
 */
export async function recordOwnerApproval(
  supabase: Client,
  userId: string,
  input: {
    approvalId: string;
    expectedUpdatedAt: string;
    decision: "approved" | "declined";
    comment: string;
  },
) {
  const current = await supabase
    .from("approvals")
    .select("id, status, property_id, entity_type, entity_id, approver_id, approver_role, is_demo")
    .eq("id", input.approvalId)
    .maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) throw new Error("That approval request is not available to you.");
  if (current.data.approver_role !== "owner" || current.data.is_demo !== false) {
    throw new Error("That request is not available for a homeowner decision.");
  }
  if (current.data.approver_id !== userId) {
    throw new Error("That approval request is addressed to someone else.");
  }
  if (current.data.status !== "pending") {
    throw new Error("A decision was already recorded for this request.");
  }
  if (input.decision === "declined" && !input.comment.trim()) {
    throw new Error("Please add a short note explaining what you would like changed.");
  }

  let now = new Date().toISOString();
  if (
    ["work_order", "onboarding_task", "financial_request"].includes(current.data.entity_type ?? "")
  ) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const response = await supabaseAdmin.rpc("record_versioned_owner_response", {
      _approval_id: input.approvalId,
      _expected_updated_at: input.expectedUpdatedAt,
      _owner_id: userId,
      _approved: input.decision === "approved",
      _note: input.comment.trim(),
    });
    if (response.error) throw response.error;
    if (!response.data) throw new Error("The owner response could not be recorded.");
    now = response.data;
    // Work Order history and global audit commit inside its response transaction.
    if (current.data.entity_type === "work_order")
      return { ok: true as const, status: input.decision, decidedAt: now };
  } else {
    const { data, error } = await supabase
      .from("approvals")
      .update({
        status: input.decision,
        decision_note: input.comment.trim() || null,
        decided_at: now,
      })
      .eq("id", input.approvalId)
      .eq("status", "pending")
      .eq("updated_at", input.expectedUpdatedAt)
      .eq("approver_id", userId)
      .eq("approver_role", "owner")
      .eq("is_demo", false)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("A decision was already recorded or the recipient changed.");
  }

  const { writeAudit } = await import("./audit.server");
  await writeAudit({
    actorId: userId,
    action: `owner_approval_${input.decision}`,
    entityType: "approval",
    entityId: input.approvalId,
    reason: input.comment.trim() || null,
    after: { decidedAt: now },
  });

  return { ok: true as const, status: input.decision, decidedAt: now };
}
