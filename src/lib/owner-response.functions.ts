/**
 * Homeowner email replies, for the people who act on them.
 *
 * Reading a reply never changes a decision. Staff read what the homeowner
 * actually wrote and record Approved, Declined or Changes requested against the
 * one canonical approval.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function uuid(value: unknown, label = "record") {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`Invalid ${label} reference.`);
  return id;
}

/** Replies Resolve could not place, newest first. */
export const unplacedOwnerRepliesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("approval_email_responses")
      .select("id, subject, from_name, from_address, received_at, body_text, web_link, candidates, is_demo")
      .eq("status", "needs_review")
      .order("received_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

/** The homeowner replies filed against one decision. */
export const ownerRepliesForApprovalFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { approvalId: string }) => ({ approvalId: uuid(input?.approvalId, "approval") }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("approval_email_responses")
      .select("id, subject, from_name, from_address, received_at, body_text, web_link, has_attachments, attachments, status, match_method")
      .eq("approval_id", data.approvalId)
      .order("received_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

/** Places a held reply against the decision a person says it answers. */
export const placeOwnerReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { responseId: string; approvalId: string }) => ({
    responseId: uuid(input?.responseId, "reply"),
    approvalId: uuid(input?.approvalId, "approval"),
  }))
  .handler(async ({ data, context }) => {
    const { linkOwnerResponse } = await import("./owner-response.server");
    return linkOwnerResponse(context.supabase, context.userId, data.responseId, data.approvalId);
  });

/** Records the homeowner's answer on the canonical approval. */
export const recordOwnerReplyDecisionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { approvalId: string; decision: string; note: string; responseId?: string | null }) => {
      const decision = String(input?.decision ?? "");
      if (!["approved", "declined", "changes_requested"].includes(decision)) {
        throw new Error("Choose Approved, Declined or Changes requested.");
      }
      return {
        approvalId: uuid(input?.approvalId, "approval"),
        decision: decision as "approved" | "declined" | "changes_requested",
        note: String(input?.note ?? "").slice(0, 4000),
        responseId: input?.responseId ? uuid(input.responseId, "reply") : null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { recordOwnerEmailDecision } = await import("./owner-response.server");
    return recordOwnerEmailDecision(context.supabase, context.userId, data);
  });
