/**
 * Server-side enforcement of the one ticket lifecycle.
 *
 * Everything that changes a ticket's status — Current Work buttons, the More
 * sheet, the supervisor status menu, admin tooling — calls through here. The
 * facts are gathered from the database rather than trusted from the browser,
 * so a hand-rolled request cannot skip a rule either.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type LifecycleException,
  type LifecycleFacts,
  isLifecycleException,
  LIFECYCLE_EXCEPTIONS,
  ticketStatusLabel,
  validateTicketTransition,
} from "@/lib/ticket-lifecycle";

import { requiresPhotoOrFile } from "@/lib/evidence-requirements";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = SupabaseClient<any, any, any>;

const FIELD_WORK_CATEGORIES = new Set([
  "maintenance",
  "repair",
  "appliance",
  "plumbing",
  "electrical",
  "hvac",
  "safety",
  "housekeeping",
  "cleaning",
  "landscaping",
  "pest",
  "pool",
]);

/** Read everything the validator needs for one ticket. */
export async function gatherLifecycleFacts(
  db: Db,
  ticketId: string,
): Promise<{ facts: LifecycleFacts; ticket: Record<string, any> }> {
  const { data: ticket, error } = await db.from("tickets").select("*").eq("id", ticketId).single();
  if (error || !ticket) throw new Error(error?.message ?? "That ticket could not be found.");

  const [workType, steps, orders, files, comms] = await Promise.all([
    ticket.work_type_id
      ? db
          .from("work_types")
          .select("name, required_closure_evidence")
          .eq("id", ticket.work_type_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("ticket_steps").select("required, completed").eq("ticket_id", ticketId),
    db
      .from("work_orders")
      .select(
        "id, scope, vendor_org_id, vendor_name, approval_status, quote_amount, approved_amount",
      )
      .eq("ticket_id", ticketId),
    db
      .from("documents")
      .select("id, mime_type, upload_status, size_bytes, deleted_at")
      .eq("entity_type", "ticket")
      .eq("entity_id", ticketId),
    db
      .from("ticket_activity")
      .select("id, kind, internal")
      .eq("ticket_id", ticketId)
      .in("kind", ["guest_message", "communication", "guest_update"]),
  ]);

  const wt = (workType as any)?.data as {
    name?: string;
    required_closure_evidence?: string;
  } | null;
  const stepRows = (steps.data ?? []) as { required: boolean | null; completed: boolean | null }[];
  const orderRows = (orders.data ?? []) as {
    scope: string | null;
    vendor_org_id: string | null;
    vendor_name: string | null;
    approval_status: string | null;
  }[];
  const fileRows = (
    (files.data ?? []) as {
      upload_status: string | null;
      size_bytes: number | null;
      deleted_at: string | null;
      mime_type: string | null;
    }[]
  ).filter((d) => !d.deleted_at && (d.upload_status === "stored" || d.upload_status === "uploaded") && Number(d.size_bytes ?? 0) > 0);

  const evidenceLabel = wt?.required_closure_evidence ?? null;
  const dispatchable = orderRows.filter((o) => o.vendor_org_id || o.vendor_name);
  const breezeway = Boolean(ticket.breezeway_task_id);

  const facts: LifecycleFacts = {
    status: String(ticket.status),
    requiresFieldWork:
      FIELD_WORK_CATEGORIES.has(String(ticket.category ?? "")) ||
      orderRows.length > 0 ||
      breezeway ||
      Boolean(ticket.vendor_user_id),
    hasDispatchObject: orderRows.length > 0 || breezeway || Boolean(ticket.vendor_user_id),
    hasDispatchDestination:
      dispatchable.length > 0 || breezeway || Boolean(ticket.vendor_user_id || ticket.vendor_name),
    hasDispatchScope:
      orderRows.some((o) => String(o.scope ?? "").trim().length > 0) ||
      String(ticket.vendor_brief ?? "").trim().length > 0 ||
      breezeway,
    dispatchApprovalPending: orderRows.some(
      (o) => o.approval_status === "pending" || o.approval_status === "requested",
    ),

    waiting_on: ticket.waiting_on,
    waiting_reason: ticket.waiting_reason,
    next_review_at: ticket.next_review_at,

    hasGuestContext: Boolean(
      ticket.guest_name ||
      ticket.guest_contact ||
      ticket.ownerrez_booking_id ||
      ticket.guest_in_residence,
    ),
    guestCommunicationRecorded:
      (comms.data ?? []).length > 0 || Boolean(ticket.final_communication_sent),

    closureEvidenceText: ticket.closure_evidence,
    requiresClosureEvidence: Boolean(evidenceLabel && String(evidenceLabel).trim()),
    requiresClosureFile: requiresPhotoOrFile(evidenceLabel),
    hasQualifyingFile: fileRows.length > 0,
    hasClosureSummary: String(ticket.resolution_notes ?? "").trim().length > 0,
    requiredStepsComplete: stepRows.every((s) => !s.required || s.completed),

    closureQaResult: ticket.closure_qa_result,
  };

  return { facts, ticket };
}

export type StatusChangeInput = {
  ticketId: string;
  status: string;
  /** Fields the calling surface wants written alongside the status. */
  patch?: Record<string, unknown>;
  /** A named exception, used only when the transition would otherwise fail. */
  exception?: string | null;
  exceptionReason?: string | null;
};

/**
 * Apply a status change, or refuse it with the reason.
 *
 * `privileged` roles (supervisor / director / admin) may name an exception and
 * give a reason; that writes an audit row and an activity entry so nothing is
 * ever silently bypassed.
 */
export async function applyStatusChange(
  db: Db,
  userId: string,
  privileged: boolean,
  input: StatusChangeInput,
) {
  const { facts, ticket } = await gatherLifecycleFacts(db, input.ticketId);

  // Fields being written in the same breath (a waiting date, a closure
  // summary) count as facts — otherwise a legitimate save would fail on the
  // state that this very save is establishing.
  const merged: LifecycleFacts = { ...facts };
  const p = input.patch ?? {};
  if ("waiting_on" in p) merged.waiting_on = (p["waiting_on"] as string) ?? null;
  if ("waiting_reason" in p) merged.waiting_reason = (p["waiting_reason"] as string) ?? null;
  if ("next_review_at" in p) merged.next_review_at = (p["next_review_at"] as string) ?? null;
  if ("resolution_notes" in p)
    merged.hasClosureSummary = String(p["resolution_notes"] ?? "").trim().length > 0;
  if ("closure_evidence" in p)
    merged.closureEvidenceText = (p["closure_evidence"] as string) ?? null;
  if ("closure_qa_result" in p) merged.closureQaResult = (p["closure_qa_result"] as string) ?? null;

  const verdict = validateTicketTransition(input.status, merged);

  let usedException: LifecycleException | null = null;
  if (!verdict.ok) {
    const named = input.exception && isLifecycleException(input.exception) ? input.exception : null;
    const reason = String(input.exceptionReason ?? "").trim();
    if (!privileged || !named || named !== verdict.exception || reason.length < 5) {
      return {
        ok: false as const,
        code: verdict.code,
        message: verdict.message,
        exception: verdict.exception,
      };
    }
    usedException = named;
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { ...p, status: input.status };
  if (input.status === "in_progress") {
    if (!ticket["acknowledged_at"]) patch["acknowledged_at"] = now;
    if (!ticket["action_started_at"]) patch["action_started_at"] = now;
  }
  if (input.status === "resolved" && !ticket["resolved_at"]) patch["resolved_at"] = now;
  if (input.status === "closed" && !ticket["resolved_at"]) patch["resolved_at"] = now;

  const { error } = await db.from("tickets").update(patch).eq("id", input.ticketId);
  if (error)
    return { ok: false as const, code: "write_failed", message: error.message, exception: null };

  await db.from("ticket_activity").insert({
    ticket_id: input.ticketId,
    author_id: userId,
    kind: "status",
    event_type: "status_changed",
    internal: false,
    body: usedException
      ? `Status changed to ${ticketStatusLabel(input.status)} under a named exception — ${LIFECYCLE_EXCEPTIONS[usedException]}: ${input.exceptionReason}`
      : `Status changed to ${ticketStatusLabel(input.status)}.`,
  });


  if (usedException) {
    await db.from("audit_log").insert({
      actor_id: userId,
      entity_type: "ticket",
      entity_id: input.ticketId,
      entity_label: String(ticket["ref"] ?? input.ticketId),
      action: "lifecycle_exception",
      before_value: { status: facts.status },
      after_value: { status: input.status, exception: usedException },
      reason: `${LIFECYCLE_EXCEPTIONS[usedException]} — ${input.exceptionReason}`,
    });
  }

  return { ok: true as const, exception: usedException };
}
