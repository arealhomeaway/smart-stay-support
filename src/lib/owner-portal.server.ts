/**
 * The homeowner's own view of their participation program (server-only).
 *
 * One homeowner, one program, one program window (closing date → December 31), one combined hour
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
import { findOwnerProgram } from "./owner-program-reader.server";
import { redeemOwnerInviteAtomically } from "./owner-invite-redemption.server";
import { readOwnerParticipation } from "./owner-participation-reader.server";
import { loadOwnerTicketProjection } from "./owner-ticket-projection.server";
import { ownerNotificationText } from "./owner-notification";
import { automaticOpportunityView } from "./owner-automatic-opportunity";
import { ownerProgramProjection } from "./owner-program-projection";
import { syncProgramBadges } from "./owner-badges.server";
import { loadOwnerResponseReceipts } from "./owner-response-history.server";
export type { OwnerTicket } from "./owner-ticket-projection.server";

type Client = SupabaseClient<Database>;

/** Everything the owner hub renders, in one round trip. */
export async function loadOwnerHome(supabase: Client, userId: string, admin: Client) {
  const program = await findOwnerProgram(supabase, userId);
  if (!program) return { linked: false as const };
  let badgeRefreshPending = false;
  let badgeVersion: string | null = null;
  try {
    const refreshed = await syncProgramBadges(admin, userId, program.id);
    badgeVersion = typeof refreshed.reportVersion === "string" ? refreshed.reportVersion : null;
  } catch {
    // A refresh is recoverable and does not change participation time. The
    // scoped reads below independently recheck access before returning data.
    badgeRefreshPending = true;
  }
  const home = await loadOwnerHomeByProgram(supabase, program.id);
  if (!badgeRefreshPending) {
    const latest = await admin
      .rpc("owner_badge_refresh_version", {
        _program_id: program.id,
        _actor_id: userId,
      })
      .then(
        (result) => (result.error ? null : result.data),
        () => null,
      );
    badgeRefreshPending = !badgeVersion || latest !== badgeVersion;
  }
  return { ...home, badgeRefreshPending };
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
  demoOnly = false,
) {
  const { assertAdmin } = await import("./access.server");
  await assertAdmin(supabase, userId);
  let id = programId ?? null;
  if (!id) {
    let query = supabase.from("owner_programs").select("id");
    // Demo mode walks the demo homeowner home, never a real owner's program.
    if (demoOnly) query = query.eq("is_demo", true);
    const program = await query
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
  const agg = await loadProgramAggregate(supabase, programId, { ownerView: true, preview });

  const propertyIds = agg.includedProperties.map((p) => p.propertyId);

  const [alerts, tickets] = await Promise.all([
    readOwnerParticipation(supabase, "alerts", programId, preview),
    loadOwnerTicketProjection(supabase, propertyIds, preview, programId),
  ]);
  if (alerts.error) throw alerts.error;
  const receipts = await loadOwnerResponseReceipts(supabase, programId, {
    ownerView: true,
    preview,
  });

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
    badges: agg.badges,
    badgeRefreshPending: false,
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
  const { error } = await supabase.rpc("mark_owner_alerts_read", { _ids: ids });
  if (error) throw error;
  return { ok: true as const };
}

/** Owner-controlled alert channels. Only their own program is reachable. */
export async function saveAlertPreferences(
  supabase: Client,
  _userId: string,
  input: { email: boolean; smsP1: boolean; push: boolean; phone: string },
) {
  const { data, error } = await supabase.rpc("save_owner_alert_preferences", {
    _email: input.email,
    _sms_p1: input.smsP1,
    _push: input.push,
    _phone: input.phone,
  });
  if (error) throw error;
  if (!data) throw new Error("Your notification preferences could not be saved.");
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
  /** Every file attached to this entry, in upload order; the first is also attachmentPath. */
  attachmentPaths?: string[];
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
export async function logOwnerTime(supabase: Client, _userId: string, input: LogTimeInput) {
  // An entry either answers a documented participation opportunity or is one
  // the homeowner recorded themselves; a self-recorded entry carries no Ticket.
  if (!input.reviewId && input.ticketId) {
    throw new Error("A self-recorded activity cannot carry a Ticket link.");
  }
  // Eligibility, current enrollment and evidence are checked under database locks.
  const chosen = [...new Set(input.propertyIds)];
  const { data: entryId, error } = await supabase.rpc("log_owner_time_entry", {
    _entry: { ...input },
    _property_ids: chosen,
  });
  if (error) throw error;
  if (!entryId) throw new Error("The participation entry could not be recorded.");

  // Activity timestamps and evidence are committed by the same transaction.
  // A later read failure must never invite
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
  _userId: string,
  input: { entryId: string; minutes: number; activity: string; note: string },
) {
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
  _userId: string,
  input: {
    reviewId: string;
    expectedUpdatedAt: string;
    decision: string;
    response: string;
    ownerUpdateRevision?: number | null;
  },
) {
  // The versioned transaction checks ownership, availability, intent and narrative revision.
  const { data: saved, error } = await supabase.rpc("respond_owner_review", {
    _review_id: input.reviewId,
    _expected_updated_at: input.expectedUpdatedAt,
    _decision: input.decision,
    _response: input.response,
    _owner_update_revision: (input.ownerUpdateRevision ?? null) as unknown as number,
  });
  if (error) throw error;
  if (!saved) throw new Error("The response could not be recorded.");
  // A later read failure must not report this committed response as failed.
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
export {
  loadOwnerApprovals,
  recordOwnerApproval,
  type OwnerApproval,
} from "./owner-approval.server";
