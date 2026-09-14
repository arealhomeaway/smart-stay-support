/**
 * Onboarding money, utilities and permanent-fact review (server-only).
 *
 * Everything here writes through the same canonical records the rest of
 * Resolve uses: spend decisions become rows in `approvals`, history goes to
 * the project event log and the audit trail, and nothing silently overwrites a
 * property fact.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { writeAudit } from "./audit.server";
import { recordProjectEvent } from "./onboarding-project.server";
import { loadOnboardingPolicy } from "./onboarding-policy.server";
import {
  authorityTier,
  AUTHORITY_TIER_LABELS,
  authorityGuidance,
  money,
} from "./maintenance-policy";
import {
  FACT_FIELDS,
  canRecordInvoice,
  financialNextAction,
  tierFor,
  variance,
  type FinancialRequest,
} from "./onboarding-finance";

type Client = SupabaseClient<Database>;

const ACCOUNTING_SETTING_KEY = "accounting_recipient";

async function assertOnboardingStaff(supabase: Client, userId: string) {
  const [staff, supervisor] = await Promise.all([
    supabase.rpc("is_onboarding_staff", { _user_id: userId }),
    supabase.rpc("is_supervisor", { _user_id: userId }),
  ]);
  if (!staff.data && !supervisor.data) {
    throw new Error("You do not have access to change onboarding money records.");
  }
}

async function projectFor(supabase: Client, propertyId: string) {
  const { data, error } = await supabase
    .from("onboarding_projects")
    .select("id, is_demo")
    .eq("property_id", propertyId)
    .neq("status", "cancelled")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function notifyStaff(
  rows: {
    userId: string;
    kind: string;
    title: string;
    body: string;
    linkPath: string;
    entityType: string;
    entityId: string;
    actorId: string;
    isDemo: boolean;
  }[],
) {
  if (rows.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("staff_notifications").insert(
    rows
      .filter((r) => r.userId && r.userId !== r.actorId)
      .map((r) => ({
        user_id: r.userId,
        kind: r.kind,
        title: r.title,
        body: r.body,
        link_path: r.linkPath,
        entity_type: r.entityType,
        entity_id: r.entityId,
        actor_id: r.actorId,
        is_demo: r.isDemo,
      })),
  );
}

/** Everyone who decides spend at the supervisor tier. */
async function supervisorApprovers(supabase: Client) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const at = new Date().toISOString();
  const holders = await Promise.all(
    ["ops_supervisor", "director_ops"].map((code) =>
      supabaseAdmin.rpc("seat_holder_at", { _role_code: code, _at: at }),
    ),
  );
  const ids = holders
    .map((h) => (h.data as string | null) ?? null)
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/** The mailbox that receives finished onboarding spend. Admin-configurable. */
export async function accountingRecipient(supabase: Client): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", ACCOUNTING_SETTING_KEY)
    .maybeSingle();
  const value = (data?.value ?? null) as { email?: string } | null;
  const email = value?.email?.trim();
  return email ? email : null;
}

export async function setAccountingRecipient(supabase: Client, userId: string, email: string) {
  const isAdmin = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin.data) throw new Error("Only an administrator can set the accounting recipient.");
  const { error } = await supabase.from("app_settings").upsert({
    key: ACCOUNTING_SETTING_KEY,
    value: { email },
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "accounting_recipient_set",
    entityType: "app_setting",
    entityId: ACCOUNTING_SETTING_KEY,
    entityLabel: "Accounting recipient",
    after: { email },
  });
  return { ok: true as const, email };
}

/* ------------------------------------------------------------------ */
/* Financial requests                                                  */
/* ------------------------------------------------------------------ */

export async function loadFinance(supabase: Client, propertyId: string) {
  const [requests, accounts, costs, facts, recipient, owner, property, reviewers, authorityPolicy] =
    await Promise.all([
      supabase
        .from("financial_requests")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("utility_accounts")
        .select("*")
        .eq("property_id", propertyId)
        .order("utility_type"),
      supabase
        .from("utility_costs")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_fact_proposals")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false }),
      accountingRecipient(supabase),
      supabase
        .from("property_owner_contacts")
        .select("owner_name, owner_email, owner_phone")
        .eq("property_id", propertyId)
        .maybeSingle(),
      supabase
        .from("properties")
        .select("wifi_notes, access_notes, address_line1, city, state, postal_code, nickname")
        .eq("id", propertyId)
        .maybeSingle(),
      supabase.from("profiles").select("id, full_name"),
      loadOnboardingPolicy(supabase),
    ]);
  if (requests.error) throw requests.error;
  if (accounts.error) throw accounts.error;
  if (costs.error) throw costs.error;
  if (facts.error) throw facts.error;
  if (owner.error) throw owner.error;
  if (property.error) throw property.error;
  if (reviewers.error) throw reviewers.error;
  return {
    requests: requests.data ?? [],
    utilities: accounts.data ?? [],
    utilityCosts: costs.data ?? [],
    factProposals: facts.data ?? [],
    accountingRecipient: recipient,
    ownerContact: owner.data ?? null,
    currentFacts: property.data ?? null,
    reviewers: reviewers.data ?? [],
    authorityPolicy,
  };
}

export async function createFinancialRequest(
  supabase: Client,
  userId: string,
  input: {
    propertyId: string;
    taskId?: string | null | undefined;
    kind: string;
    title: string;
    vendor?: string | null | undefined;
    description?: string | null | undefined;
    estimateAmount: number;
    emergency?: boolean;
    emergencyReason?: string | null | undefined;
  },
) {
  await assertOnboardingStaff(supabase, userId);
  const project = await projectFor(supabase, input.propertyId);
  if (input.taskId) {
    const task = await supabase
      .from("onboarding_tasks")
      .select("id")
      .eq("id", input.taskId)
      .eq("property_id", input.propertyId)
      .maybeSingle();
    if (task.error) throw task.error;
    if (!task.data) throw new Error("That task is not available for this property.");
  }
  const policy = await loadOnboardingPolicy(supabase);
  const tier = authorityTier(input.estimateAmount, { emergency: input.emergency ?? false, policy });
  if (tier === "emergency" && !input.emergencyReason?.trim()) {
    throw new Error("An emergency needs a recorded reason before it can proceed.");
  }
  const { data, error } = await supabase
    .from("financial_requests")
    .insert({
      property_id: input.propertyId,
      project_id: project?.id ?? null,
      task_id: input.taskId ?? null,
      kind: input.kind,
      title: input.title,
      vendor: input.vendor ?? null,
      description: input.description ?? null,
      estimate_amount: input.estimateAmount,
      authority_tier: tier,
      authority_policy: policy,
      emergency: input.emergency ?? false,
      emergency_reason: input.emergencyReason ?? null,
      status: "estimate",
      created_by: userId,
      is_demo: project?.is_demo ?? false,
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;

  if (project) {
    await recordProjectEvent(supabase, {
      projectId: project.id,
      propertyId: input.propertyId,
      kind: "financial_request_created",
      summary: `${input.title} — ${money(input.estimateAmount)} (${AUTHORITY_TIER_LABELS[tier]})`,
      detail: authorityGuidance(input.estimateAmount, {
        emergency: input.emergency ?? false,
        policy,
      }),
      actor: userId,
      isDemo: project.is_demo ?? false,
    });
  }
  await writeAudit({
    actorId: userId,
    action: "financial_request_created",
    entityType: "financial_request",
    entityId: data?.id ?? input.propertyId,
    entityLabel: input.title,
    after: { amount: input.estimateAmount, tier },
  });
  return data as FinancialRequest;
}

/**
 * Send a request for the decision its amount requires.
 *
 * Supervisor tier creates an approval addressed to the supervisors and pings
 * them in Resolve. Owner tier creates the same canonical approval record and
 * routes it to the homeowner — in-app for an Active Owner, by Resolve-generated
 * email for a standard owner.
 */
export async function sendFinancialForApproval(
  supabase: Client,
  userId: string,
  input: { requestId: string },
) {
  await assertOnboardingStaff(supabase, userId);
  const row = await supabase
    .from("financial_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (row.error) throw row.error;
  const request = row.data as FinancialRequest | null;
  if (!request) throw new Error("That request is not available.");
  if (request.estimate_amount == null || !Number.isFinite(request.estimate_amount)) {
    throw new Error("Record a valid estimate before requesting approval.");
  }
  const tier = tierFor(request);
  if (tier === "proceed") {
    throw new Error(
      "This request can proceed under its recorded authority — record the invoice when it arrives.",
    );
  }

  const { data: approvalId, error } = await supabase.rpc("prepare_onboarding_financial_approval", {
    _request_id: request.id,
    _expected_amount: request.estimate_amount,
    _expected_tier: tier,
  });
  if (error) throw error;
  if (!approvalId) throw new Error("The approval could not be prepared.");

  const link = `/onboarding/${request.property_id}?tab=financial`;
  if (tier === "supervisor") {
    const approvers = await supervisorApprovers(supabase);
    await notifyStaff(
      approvers.map((id) => ({
        userId: id,
        kind: "approval_needed",
        title: `Approve ${money(request.estimate_amount)} — ${request.title}`,
        body: authorityGuidance(
          request.estimate_amount,
          request.authority_policy ? { policy: request.authority_policy } : {},
        ),
        linkPath: link,
        entityType: "financial_request",
        entityId: request.id,
        actorId: userId,
        isDemo: request.is_demo,
      })),
    );
  } else {
    await routeOwnerDecision(supabase, userId, {
      propertyId: request.property_id,
      approvalId,
      subject: request.title,
      amount: Number(request.estimate_amount ?? 0),
      detail: request.description ?? "",
    });
  }

  await writeAudit({
    actorId: userId,
    action: "financial_request_sent_for_approval",
    entityType: "financial_request",
    entityId: request.id,
    entityLabel: request.title,
    after: { tier, approvalId },
  });
  return { ok: true as const, tier, approvalId };
}

/**
 * Put an owner decision in front of the right homeowner.
 *
 * Both paths point at the same approval row, so the decision, who made it and
 * when are recorded in one place regardless of how the owner answered.
 */
export async function routeOwnerDecision(
  supabase: Client,
  userId: string,
  input: {
    propertyId: string;
    approvalId: string | null;
    subject: string;
    /** Money at stake, or null for a decision that is not about spend. */
    amount: number | null;
    detail: string;
  },
) {
  if (!input.approvalId) throw new Error("Save the approval before routing its decision.");
  const canonical = await supabase
    .from("approvals")
    .select("id, status, ref, owner_email_to, owner_email_sent_at")
    .eq("id", input.approvalId)
    .eq("property_id", input.propertyId)
    .maybeSingle();
  if (canonical.error) throw canonical.error;
  if (!canonical.data || canonical.data.status !== "pending") {
    throw new Error("This approval is not available for delivery. Refresh its decision status.");
  }
  const { activeOwnerFor } = await import("./active-owner.server");
  const link = await activeOwnerFor(supabase, input.propertyId);
  const property = await supabase
    .from("properties")
    .select("name")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (property.error) throw property.error;
  const home = property.data?.name ?? "your home";

  if (link?.ownerUserId && input.approvalId) {
    const routed = await supabase
      .from("approvals")
      .update({ approver_id: link.ownerUserId })
      .eq("id", input.approvalId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (routed.error) throw routed.error;
    if (!routed.data) throw new Error("The approval changed before it could reach the owner.");
    return { channel: "in_app" as const, to: null };
  }

  if (canonical.data.owner_email_sent_at && canonical.data.owner_email_to) {
    return { channel: "email" as const, to: canonical.data.owner_email_to };
  }

  // Standard owner: Resolve generates the email and keeps it tied to the record.
  const contact = await supabase
    .from("property_owner_contacts")
    .select("owner_name, owner_email")
    .eq("property_id", input.propertyId)
    .not("owner_email", "is", null)
    .limit(1)
    .maybeSingle();
  if (contact.error) throw contact.error;
  const to = contact.data?.owner_email ?? null;
  if (!to)
    throw new Error("The approval is saved. Add the homeowner's email address before sending it.");

  // Every approval carries one short reference. Resolve prints it in the
  // subject and the body, so when the homeowner replies the answer can be filed
  // against this exact decision rather than guessed at.
  const { approvalRef } = await import("./approval-reference");
  const reference = approvalRef(canonical.data.ref ?? null);

  const { sendEmail, emailShell } = await import("./email.server");
  const body = [
    `${contact.data?.owner_name ?? "Hello"},`,
    "",
    `We need your decision before we go ahead with the following at ${home}:`,
    "",
    `${input.subject}`,
    input.amount != null ? `Estimated cost: ${money(input.amount)}` : "",
    input.detail ? `\n${input.detail}` : "",
    "",
    "Reply to this email with approve or hold, and we will record your answer against this request.",
    "",
    reference
      ? `Please keep ${reference} in the subject line so your answer reaches the right request.`
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = emailShell(`Approval needed for ${home}`, body, undefined, "owner");
  const result = await sendEmail({
    to,
    subject: `Approval needed — ${input.subject} at ${home}${reference ? ` [${reference}]` : ""}`,
    html,
    purpose: "onboarding_owner_approval",
  });
  if (result.status !== "sent") {
    throw new Error(`The approval was saved but email was not sent: ${result.error}.`);
  }
  if (input.approvalId) {
    const recorded = await supabase
      .from("approvals")
      .update({
        external_reference: `email:${to}`,
        owner_email_to: to,
        owner_email_sent_at: new Date().toISOString(),
      })
      .eq("id", input.approvalId);
    if (recorded.error) throw recorded.error;
  }
  await writeAudit({
    actorId: userId,
    action: "owner_approval_emailed",
    entityType: "approval",
    entityId: input.approvalId ?? input.propertyId,
    entityLabel: input.subject,
    after: { to, status: result.status },
  });
  return { channel: "email" as const, to };
}

/** Record the decision on the canonical approval and move the request along. */
export async function decideFinancialRequest(
  supabase: Client,
  userId: string,
  input: {
    requestId: string;
    approved: boolean;
    note: string;
    approvedAmount?: number | null | undefined;
  },
) {
  await assertOnboardingStaff(supabase, userId);
  const { error } = await supabase.rpc("decide_onboarding_financial_request", {
    _request_id: input.requestId,
    _approved: input.approved,
    _note: input.note,
    ...(input.approvedAmount != null ? { _approved_amount: input.approvedAmount } : {}),
  });
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: input.approved ? "financial_request_approved" : "financial_request_declined",
    entityType: "financial_request",
    entityId: input.requestId,
    reason: input.note,
    after: { approvedAmount: input.approvedAmount ?? null },
  });
  return { ok: true as const };
}

/** Invoice arrived: record it, compute the variance, ask for a note if it moved. */
export async function recordInvoice(
  supabase: Client,
  userId: string,
  input: {
    requestId: string;
    invoiceAmount: number;
    invoiceRef?: string | null | undefined;
    varianceNote?: string | null | undefined;
  },
) {
  await assertOnboardingStaff(supabase, userId);
  const row = await supabase
    .from("financial_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (row.error) throw row.error;
  const request = row.data as FinancialRequest | null;
  if (!request) throw new Error("That request is not available.");

  if (!canRecordInvoice(request))
    throw new Error(
      "This request needs approval or already has an invoice. Refresh its current status.",
    );
  if (!Number.isFinite(input.invoiceAmount) || input.invoiceAmount < 0)
    throw new Error("Enter a valid invoice amount.");
  const merged = { ...request, invoice_amount: input.invoiceAmount };
  const delta = variance(merged);
  if (delta != null && delta > 0 && !input.varianceNote?.trim()) {
    const baseline = Number(request.approved_amount ?? request.estimate_amount ?? 0);
    if (baseline <= 0 || delta / baseline > 0.1) {
      throw new Error(
        "The invoice is above what was approved — record why before it goes to accounting.",
      );
    }
  }

  const { data, error } = await supabase
    .from("financial_requests")
    .update({
      invoice_amount: input.invoiceAmount,
      invoice_ref: input.invoiceRef ?? null,
      invoice_at: new Date().toISOString(),
      variance_note: input.varianceNote ?? null,
      status: "invoiced",
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", request.status)
    .is("invoice_amount", null)
    .is("invoice_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error("The request changed before the invoice was saved. Refresh and review it.");

  await writeAudit({
    actorId: userId,
    action: "financial_invoice_recorded",
    entityType: "financial_request",
    entityId: request.id,
    entityLabel: request.title,
    after: { invoice: input.invoiceAmount, variance: delta },
  });
  return { ok: true as const, variance: delta };
}

/** Hand the finished cost to accounting, at the address an admin configured. */
export async function sendToAccounting(
  supabase: Client,
  userId: string,
  input: { requestId: string },
) {
  await assertOnboardingStaff(supabase, userId);
  const row = await supabase
    .from("financial_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (row.error) throw row.error;
  const request = row.data as FinancialRequest | null;
  if (!request) throw new Error("That request is not available.");
  if (request.invoice_amount == null)
    throw new Error("Record the invoice before sending it to accounting.");

  if (
    request.accounting_sent_at &&
    request.accounting_recipient &&
    ["sent_to_accounting", "settled"].includes(request.status)
  )
    return { ok: true as const, to: request.accounting_recipient, delivery: "sent" as const };
  if (request.status !== "invoiced")
    throw new Error("Only an invoiced request can be sent to accounting.");

  const to = await accountingRecipient(supabase);
  if (!to) {
    throw new Error(
      "No accounting recipient is configured yet — an administrator can set one in Integrations.",
    );
  }
  const property = await supabase
    .from("properties")
    .select("name")
    .eq("id", request.property_id)
    .maybeSingle();
  const { sendEmail, emailShell } = await import("./email.server");
  const delta = variance(request);
  const body = [
    request.title,
    "",
    `Estimate: ${money(request.estimate_amount)}`,
    `Approved: ${money(request.approved_amount)}`,
    `Invoice: ${money(request.invoice_amount)}${delta ? ` (${money(delta)} variance)` : ""}`,
    request.vendor ? `Vendor: ${request.vendor}` : "",
    request.invoice_ref ? `Invoice reference: ${request.invoice_ref}` : "",
    request.variance_note ? `Variance note: ${request.variance_note}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
  const html = emailShell(
    `Onboarding cost — ${property.data?.name ?? "property"}`,
    body,
    undefined,
    "staff",
  );
  const result = await sendEmail({
    to,
    subject: `Onboarding cost — ${request.title}`,
    html,
    purpose: "onboarding_accounting",
  });
  if (result.status !== "sent") {
    throw new Error(`Accounting handoff was not sent: ${result.error}. The request remains open.`);
  }

  const { data, error } = await supabase
    .from("financial_requests")
    .update({
      status: "sent_to_accounting",
      accounting_recipient: to,
      accounting_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "invoiced")
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "The accounting email was sent, but its handoff could not be recorded. Verify delivery before retrying.",
    );
  await writeAudit({
    actorId: userId,
    action: "financial_sent_to_accounting",
    entityType: "financial_request",
    entityId: request.id,
    entityLabel: request.title,
    after: { to, delivery: result.status },
  });
  return { ok: true as const, to, delivery: result.status };
}

/** Accounting has settled it. This is separate from the home going Live. */
export async function settleFinancialRequest(
  supabase: Client,
  userId: string,
  input: { requestId: string; note: string; actualAmount: number },
) {
  await assertOnboardingStaff(supabase, userId);
  if (!Number.isFinite(input.actualAmount) || input.actualAmount < 0)
    throw new Error("Enter the actual paid amount.");
  const { data, error } = await supabase
    .from("financial_requests")
    .update({
      status: "settled",
      settled_at: new Date().toISOString(),
      settlement_note: input.note,
      actual_amount: input.actualAmount,
      actual_recorded_by: userId,
      actual_recorded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .eq("status", "sent_to_accounting")
    .select("title, property_id")
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      "Only a request handed to accounting can be settled. Refresh its current status.",
    );
  await writeAudit({
    actorId: userId,
    action: "financial_request_settled",
    entityType: "financial_request",
    entityId: input.requestId,
    entityLabel: data?.title ?? "Financial request",
    reason: input.note,
    after: { actualAmount: input.actualAmount },
  });
  return { ok: true as const };
}

/** Next-action text for one request, reused by the panel and Director Hub. */
export function nextActionFor(request: FinancialRequest) {
  return financialNextAction(request);
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

export async function saveUtilityAccount(
  supabase: Client,
  userId: string,
  input: {
    id?: string | null | undefined;
    propertyId: string;
    utilityType: string;
    provider: string;
    accountLabel: string;
    status: string;
    responsible: string;
    serviceStartOn?: string | null | undefined;
    notes?: string | null | undefined;
  },
) {
  await assertOnboardingStaff(supabase, userId);
  const project = await projectFor(supabase, input.propertyId);
  const patch = {
    property_id: input.propertyId,
    project_id: project?.id ?? null,
    utility_type: input.utilityType,
    provider: input.provider,
    account_label: input.accountLabel,
    status: input.status,
    responsible: input.responsible,
    ...(input.serviceStartOn !== undefined
      ? { service_start_on: input.serviceStartOn || null }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? supabase
        .from("utility_accounts")
        .update(patch)
        .eq("id", input.id)
        .eq("property_id", input.propertyId)
        .select("id")
        .maybeSingle()
    : supabase
        .from("utility_accounts")
        .insert({ ...patch, created_by: userId, is_demo: project?.is_demo ?? false })
        .select("id")
        .maybeSingle();
  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error("That utility account is not available for this property.");
  await writeAudit({
    actorId: userId,
    action: input.id ? "utility_account_updated" : "utility_account_added",
    entityType: "utility_account",
    entityId: data?.id ?? input.propertyId,
    entityLabel: `${input.utilityType} — ${input.provider}`,
    after: { status: input.status, responsible: input.responsible },
  });
  return { ok: true as const, id: data?.id ?? null };
}

export async function recordUtilityCost(
  supabase: Client,
  userId: string,
  input: {
    accountId: string;
    propertyId: string;
    amount: number;
    periodStart?: string | null | undefined;
    periodEnd?: string | null | undefined;
    invoiceRef?: string | null | undefined;
    paidOn?: string | null | undefined;
  },
) {
  await assertOnboardingStaff(supabase, userId);
  if (!Number.isFinite(input.amount) || input.amount < 0)
    throw new Error("Enter a valid utility cost.");
  if (input.periodStart && input.periodEnd && input.periodStart > input.periodEnd)
    throw new Error("The billing period must end on or after its start date.");
  const account = await supabase
    .from("utility_accounts")
    .select("id")
    .eq("id", input.accountId)
    .eq("property_id", input.propertyId)
    .maybeSingle();
  if (account.error) throw account.error;
  if (!account.data) throw new Error("That utility account is not available for this property.");
  const project = await projectFor(supabase, input.propertyId);
  const { error } = await supabase.from("utility_costs").insert({
    account_id: input.accountId,
    property_id: input.propertyId,
    amount: input.amount,
    period_start: input.periodStart || null,
    period_end: input.periodEnd || null,
    invoice_ref: input.invoiceRef ?? null,
    paid_on: input.paidOn || null,
    created_by: userId,
    is_demo: project?.is_demo ?? false,
  });
  if (error) throw error;
  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Permanent facts                                                     */
/* ------------------------------------------------------------------ */

/** Field capture never overwrites: it proposes, and a human compares. */
export async function proposeFact(
  supabase: Client,
  userId: string,
  input: {
    propertyId: string;
    fieldKey: string;
    proposedValue: string;
    taskId?: string | null | undefined;
    sourceDetail?: string | null | undefined;
  },
) {
  await assertOnboardingStaff(supabase, userId);
  const label = FACT_FIELDS[input.fieldKey];
  if (!label) throw new Error("This field cannot be changed through onboarding fact review.");
  const property = await supabase
    .from("properties")
    .select("*")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (property.error) throw property.error;
  if (!property.data) throw new Error("That property is not available.");
  if (input.taskId) {
    const task = await supabase
      .from("onboarding_tasks")
      .select("id")
      .eq("id", input.taskId)
      .eq("property_id", input.propertyId)
      .is("archived_at", null)
      .maybeSingle();
    if (task.error) throw task.error;
    if (!task.data) throw new Error("Choose a current task belonging to this property.");
  }
  const current = (property.data as Record<string, unknown> | null)?.[input.fieldKey];
  const project = await projectFor(supabase, input.propertyId);

  const { data, error } = await supabase
    .from("property_fact_proposals")
    .insert({
      property_id: input.propertyId,
      project_id: project?.id ?? null,
      task_id: input.taskId ?? null,
      field_key: input.fieldKey,
      field_label: label,
      current_value: current == null ? null : String(current),
      proposed_value: input.proposedValue,
      source: "field_capture",
      source_detail: input.sourceDetail ?? null,
      proposed_by: userId,
      is_demo: project?.is_demo ?? false,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "property_fact_proposed",
    entityType: "property",
    entityId: input.propertyId,
    entityLabel: label,
    before: { value: current == null ? null : String(current) },
    after: { value: input.proposedValue },
  });
  return { ok: true as const, id: data?.id ?? null };
}

/** Accept or reject one proposal. Accepting is the only path that writes. */
export async function decideFact(
  supabase: Client,
  userId: string,
  input: { proposalId: string; accept: boolean; note?: string | null | undefined },
) {
  await assertOnboardingStaff(supabase, userId);
  const row = await supabase
    .from("property_fact_proposals")
    .select("*")
    .eq("id", input.proposalId)
    .maybeSingle();
  if (row.error) throw row.error;
  const proposal = row.data;
  if (!proposal) throw new Error("That proposed change is not available.");
  if (proposal.status !== "pending") throw new Error("That change has already been reviewed.");

  const { error } = await supabase.rpc("review_onboarding_fact", {
    _proposal_id: proposal.id,
    _accept: input.accept,
    ...(input.note != null ? { _note: input.note } : {}),
  });
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: input.accept ? "property_fact_accepted" : "property_fact_rejected",
    entityType: "property",
    entityId: proposal.property_id,
    entityLabel: proposal.field_label,
    before: { value: proposal.current_value },
    after: { value: input.accept ? proposal.proposed_value : proposal.current_value },
    reason: input.note ?? null,
  });
  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Financial reconciliation on handoff                                 */
/* ------------------------------------------------------------------ */

/**
 * Money is reconciled on its own track. A home can be Live for guests while
 * an invoice is still open, and closing the books never implies Live.
 */
export async function setFinancialReconciliation(
  supabase: Client,
  userId: string,
  input: {
    handoffId: string;
    status: "open" | "in_review" | "reconciled";
    note?: string | null | undefined;
  },
) {
  await assertOnboardingStaff(supabase, userId);
  const { data, error } = await supabase
    .from("property_handoffs")
    .update({
      financial_status: input.status,
      financial_note: input.note ?? null,
      financial_reconciled_by: input.status === "reconciled" ? userId : null,
      financial_reconciled_at: input.status === "reconciled" ? new Date().toISOString() : null,
    })
    .eq("id", input.handoffId)
    .select("property_id")
    .maybeSingle();
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "handoff_financial_status_set",
    entityType: "property_handoff",
    entityId: input.handoffId,
    entityLabel: "Financial reconciliation",
    after: { status: input.status, propertyId: data?.property_id ?? null },
  });
  return { ok: true as const };
}
