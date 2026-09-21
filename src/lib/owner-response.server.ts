/**
 * A homeowner's emailed answer, filed against the decision it answers.
 *
 * A standard homeowner never needs Resolve access: they reply to the email
 * Resolve sent them. Someone in the shared inbox marks that reply with the
 * "Resolve: Owner Approval Response" category, and Resolve files it against the
 * open decision — the same canonical approval an Active Owner would answer in
 * the portal. There is no second approval model.
 *
 * Resolve never reads intent out of the words. Filing a reply changes nothing
 * about the decision itself: a person still reads what the homeowner said and
 * records Approved, Declined or Changes requested. A reply that cannot be
 * placed with certainty is held for staff to place by hand.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { matchOwnerResponse, type ApprovalCandidate } from "./approval-reference";
import { writeAudit } from "./audit.server";

type Db = SupabaseClient<Database>;

export type CapturedResponse = {
  responseId: string | null;
  approvalId: string | null;
  status: "matched" | "needs_review" | "duplicate";
  reason: string | null;
};

/** Every decision still waiting on a homeowner, as match candidates. */
export async function openOwnerApprovals(db: Db): Promise<ApprovalCandidate[]> {
  const { data, error } = await db
    .from("approvals")
    .select("id, ref, title, property_id, owner_email_to, owner_email_conversation_id")
    .eq("status", "pending")
    .eq("approver_role", "owner")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    ref: row.ref ?? null,
    title: row.title,
    propertyId: row.property_id ?? null,
    ownerEmail: row.owner_email_to ?? null,
    conversationId: row.owner_email_conversation_id ?? null,
  }));
}

/**
 * Files one homeowner reply.
 *
 * Idempotent: the reply's internet message id is unique, so a redelivered
 * notification or a second sweep re-files nothing and decides nothing.
 */
export async function captureOwnerResponse(
  db: Db,
  msg: {
    id: string;
    internetMessageId?: string | null;
    conversationId?: string | null;
    subject?: string | null;
    receivedDateTime?: string | null;
    webLink?: string | null;
    hasAttachments?: boolean;
    from?: { emailAddress?: { name?: string | null; address?: string | null } | null } | null;
  },
  bodyText: string,
  attachments: { name: string; contentType: string | null; size: number | null }[] = [],
): Promise<CapturedResponse> {
  const internetMessageId = msg.internetMessageId || msg.id;

  const existing = await db
    .from("approval_email_responses")
    .select("id, approval_id, status")
    .eq("internet_message_id", internetMessageId)
    .maybeSingle();
  if (existing.data) {
    return {
      responseId: existing.data.id,
      approvalId: existing.data.approval_id,
      status: "duplicate",
      reason: "This reply is already on file.",
    };
  }

  const candidates = await openOwnerApprovals(db);
  const match = matchOwnerResponse({
    subject: msg.subject ?? "",
    body: bodyText,
    conversationId: msg.conversationId ?? null,
    fromAddress: msg.from?.emailAddress?.address ?? null,
    candidates,
  });

  let isDemo = false;
  if (match.approvalId) {
    const parent = await db
      .from("approvals")
      .select("is_demo")
      .eq("id", match.approvalId)
      .maybeSingle();
    isDemo = Boolean(parent.data?.is_demo);
  }

  const { data, error } = await db
    .from("approval_email_responses")
    .insert({
      approval_id: match.approvalId,
      status: match.approvalId ? "matched" : "needs_review",
      match_method: match.method,
      message_id: msg.id,
      internet_message_id: internetMessageId,
      conversation_id: msg.conversationId ?? null,
      subject: (msg.subject ?? "").slice(0, 500) || null,
      from_name: msg.from?.emailAddress?.name ?? null,
      from_address: msg.from?.emailAddress?.address ?? null,
      received_at: msg.receivedDateTime ?? new Date().toISOString(),
      body_text: bodyText.slice(0, 20000),
      web_link: msg.webLink ?? null,
      has_attachments: Boolean(msg.hasAttachments),
      attachments,
      candidates: match.candidates.map((c) => ({ id: c.id, ref: c.ref, title: c.title })),
      is_demo: isDemo,
    })
    .select("id")
    .maybeSingle();

  // A racing pass may have filed it a moment earlier — that is a duplicate,
  // not a failure.
  if (error) {
    const again = await db
      .from("approval_email_responses")
      .select("id, approval_id")
      .eq("internet_message_id", internetMessageId)
      .maybeSingle();
    if (again.data) {
      return {
        responseId: again.data.id,
        approvalId: again.data.approval_id,
        status: "duplicate",
        reason: "This reply is already on file.",
      };
    }
    throw error;
  }

  return {
    responseId: data?.id ?? null,
    approvalId: match.approvalId,
    status: match.approvalId ? "matched" : "needs_review",
    reason: match.reason,
  };
}

/** Places a held reply against the decision a person says it answers. */
export async function linkOwnerResponse(
  db: Db,
  userId: string,
  responseId: string,
  approvalId: string,
) {
  const row = await db
    .from("approval_email_responses")
    .select("id, approval_id, subject")
    .eq("id", responseId)
    .maybeSingle();
  if (row.error) throw row.error;
  if (!row.data) throw new Error("That homeowner reply is not available.");
  if (row.data.approval_id) throw new Error("This reply is already filed against a decision.");

  const approval = await db
    .from("approvals")
    .select("id, is_demo, title")
    .eq("id", approvalId)
    .maybeSingle();
  if (approval.error) throw approval.error;
  if (!approval.data) throw new Error("That decision is not available.");

  const { error } = await db
    .from("approval_email_responses")
    .update({
      approval_id: approvalId,
      status: "matched",
      match_method: "staff",
      is_demo: Boolean(approval.data.is_demo),
      linked_by: userId,
      linked_at: new Date().toISOString(),
    })
    .eq("id", responseId);
  if (error) throw error;

  await writeAudit({
    actorId: userId,
    action: "owner_response_linked",
    entityType: "approval",
    entityId: approvalId,
    entityLabel: approval.data.title,
    after: { responseId, subject: row.data.subject },
  });
  return { ok: true as const };
}

export type OwnerDecision = "approved" | "declined" | "changes_requested";

/**
 * Records the homeowner's answer on the canonical approval.
 *
 * The same row an Active Owner would have decided in the portal — so who
 * decided, when, in what words and through which channel all live in one place
 * regardless of how the answer arrived.
 */
export async function recordOwnerEmailDecision(
  db: Db,
  _userId: string,
  input: {
    approvalId: string;
    expectedUpdatedAt: string;
    decision: OwnerDecision;
    note: string;
    responseId?: string | null;
  },
) {
  const note = input.note.trim();
  if (note.length < 3 || note.length > 2000)
    throw new Error(
      "Record what the homeowner said and where its evidence is retained (3–2000 characters).",
    );
  if (!input.expectedUpdatedAt) throw new Error("Refresh the approval before recording its reply.");
  const { data, error } = await db.rpc("record_owner_email_decision", {
    _approval_id: input.approvalId,
    _expected_updated_at: input.expectedUpdatedAt,
    _decision: input.decision,
    _note: note,
    _response_id: (input.responseId ?? null) as unknown as string,
  });
  if (error) throw error;
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data["ok"] !== true ||
    data["approvalId"] !== input.approvalId
  ) {
    throw new Error("The owner reply was not confirmed. Refresh before trying again.");
  }
  return { ok: true as const };
}
