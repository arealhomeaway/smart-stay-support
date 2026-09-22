import { z } from "zod";
import { readCountedRows } from "./read-all-rows";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
const nullableText = z.string().nullable();
const ownerApprovalSchema = z.object({
  id: z.string(),
  updated_at: z.string(),
  kind: z.string(),
  /** The operational record behind the request — onboarding items get their own section. */
  entity_type: z.string().nullable().default(null),
  title: z.string(),
  detail: nullableText,
  amount: z.number().nullable(),
  currency: z.string(),
  status: z.string(),
  decision_note: nullableText,
  decided_at: nullableText,
  due_on: nullableText,
  evidence_url: z.null(),
  property_id: nullableText,
  property_name: nullableText,
  active_owner: z.boolean(),
  created_at: z.string(),
  publication_id: nullableText,
  revision: z.number().int().positive().nullable(),
  can_respond: z.boolean(),
  recorded_by_owner: z.boolean(),
  blocked_reason: nullableText,
});
export type OwnerApproval = z.infer<typeof ownerApprovalSchema>;
export function parseOwnerApproval(row: { id: string; approval: unknown }): OwnerApproval {
  const approval = ownerApprovalSchema.parse(row.approval);
  if (approval.id !== row.id)
    throw new Error("The approval context changed. Refresh your requests.");
  if (
    approval.can_respond &&
    (!approval.publication_id || !approval.detail || approval.status !== "pending")
  ) {
    throw new Error("This request has no current owner-reviewed decision context.");
  }
  return approval;
}
/** Database projection checks the signed-in account, recipient and canonical enrollment. */
export async function loadOwnerApprovals(
  supabase: Client,
  _userId: string,
): Promise<OwnerApproval[]> {
  const { data, error } = await readCountedRows(
    supabase.rpc("read_owner_approvals", {} as never, { count: "exact" }).order("id"),
  );
  if (error) throw error;
  return (data ?? []).map(parseOwnerApproval);
}
export async function recordOwnerApproval(
  supabase: Client,
  _userId: string,
  input: {
    approvalId: string;
    publicationId: string;
    expectedUpdatedAt: string;
    decision: "approved" | "declined";
    comment: string;
  },
) {
  const note = input.comment.trim();
  if (!input.publicationId)
    throw new Error("A current staff-reviewed summary is required before deciding.");
  if (input.decision === "declined" && !note)
    throw new Error("Please add a short note explaining what you would like changed.");
  const { data, error } = await supabase.rpc("respond_owner_approval", {
    _approval_id: input.approvalId,
    _publication_id: input.publicationId,
    _expected_updated_at: input.expectedUpdatedAt,
    _approved: input.decision === "approved",
    _note: note,
  });
  if (error) throw error;
  if (!data) throw new Error("The owner response was not confirmed. Refresh before trying again.");
  return { ok: true as const, status: input.decision, decidedAt: data };
}
const publicationContextSchema = z.object({
  approvalId: z.string(),
  expectedUpdatedAt: z.string(),
  expectedRevision: z.number().int().nonnegative(),
  programId: nullableText,
  ownerId: nullableText,
  recipientId: nullableText,
  ownerName: nullableText,
  recipientEmail: nullableText,
  canPublish: z.boolean(),
  blockedReason: nullableText,
  publishedTitle: nullableText,
  publishedDetail: nullableText,
});
export type OwnerApprovalPublicationContext = z.infer<typeof publicationContextSchema>;
export async function loadOwnerApprovalPublicationContext(supabase: Client, approvalId: string) {
  const { data, error } = await supabase.rpc("read_owner_approval_publication_context", {
    _approval_id: approvalId,
  });
  if (error) throw error;
  return publicationContextSchema.parse(data);
}
export async function publishOwnerApproval(
  supabase: Client,
  input: {
    approvalId: string;
    expectedUpdatedAt: string;
    expectedRevision: number;
    expectedOwnerId: string;
    expectedProgramId: string;
    expectedRecipientId: string;
    title: string;
    detail: string;
    reviewed: true;
  },
) {
  const { data, error } = await supabase.rpc("publish_owner_approval", {
    _approval_id: input.approvalId,
    _expected_updated_at: input.expectedUpdatedAt,
    _expected_revision: input.expectedRevision,
    _expected_owner_id: input.expectedOwnerId,
    _expected_program_id: input.expectedProgramId,
    _expected_recipient_id: input.expectedRecipientId,
    _title: input.title.trim(),
    _detail: input.detail.trim(),
    _reviewed: input.reviewed,
  });
  if (error) throw error;
  if (!data) throw new Error("The publication was not confirmed. Refresh before trying again.");
  return { id: data };
}
