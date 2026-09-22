/**
 * Onboarding budget — server side.
 *
 * Every read and write goes through the caller's own session, so the staff-only
 * row policies are the real boundary. Changing an approved budget, or any money
 * figure on a line, always writes an append-only history row with the written
 * reason the person gave.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { BudgetChange, BudgetLine, BudgetRecord } from "./onboarding-budget";

type Client = SupabaseClient<Database>;

async function assertStaff(db: Client, userId: string) {
  const { data, error } = await db.rpc("is_internal_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Resolve staff can manage onboarding budgets.");
}

const LINE_FIELDS =
  "id, category, label, vendor, estimated_amount, committed_amount, actual_amount, status, financial_request_id, note, updated_at";

/** The budget row for a home, created on first use so the tab is never empty-handed. */
async function ensureBudget(db: Client, userId: string, propertyId: string): Promise<BudgetRecord> {
  const { data: existing, error } = await db
    .from("onboarding_budgets")
    .select("id, property_id, project_id, approved_amount, approved_basis, approved_at, notes")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing as BudgetRecord;

  const { data: project } = await db
    .from("onboarding_projects")
    .select("id, is_demo")
    .eq("property_id", propertyId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error: insertError } = await db
    .from("onboarding_budgets")
    .insert({
      property_id: propertyId,
      project_id: project?.id ?? null,
      is_demo: project?.is_demo ?? false,
      created_by: userId,
    })
    .select("id, property_id, project_id, approved_amount, approved_basis, approved_at, notes")
    .single();
  if (insertError) throw insertError;
  return created as BudgetRecord;
}

export async function loadBudget(db: Client, userId: string, propertyId: string) {
  await assertStaff(db, userId);
  const budget = await ensureBudget(db, userId, propertyId);

  const [lines, history, requests] = await Promise.all([
    db
      .from("onboarding_budget_lines")
      .select(LINE_FIELDS)
      .eq("budget_id", budget.id)
      .order("created_at", { ascending: true }),
    db
      .from("onboarding_budget_changes")
      .select("id, field, old_value, new_value, reason, changed_by, changed_at")
      .eq("budget_id", budget.id)
      .order("changed_at", { ascending: false })
      .limit(50),
    db
      .from("financial_requests")
      .select("id, title, kind, vendor, estimate_amount, approved_amount, invoice_amount, actual_amount, status")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
  ]);
  if (lines.error) throw lines.error;
  if (history.error) throw history.error;
  if (requests.error) throw requests.error;

  return {
    budget,
    lines: (lines.data ?? []) as BudgetLine[],
    history: (history.data ?? []) as BudgetChange[],
    requests: requests.data ?? [],
  };
}

async function recordChange(
  db: Client,
  input: {
    budgetId: string;
    lineId?: string | null;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    reason: string;
    userId: string;
  },
) {
  const { error } = await db.from("onboarding_budget_changes").insert({
    budget_id: input.budgetId,
    line_id: input.lineId ?? null,
    field: input.field,
    old_value: input.oldValue,
    new_value: input.newValue,
    reason: input.reason,
    changed_by: input.userId,
  });
  if (error) throw error;
}

export async function setApprovedBudget(
  db: Client,
  userId: string,
  input: { propertyId: string; amount: number | null; basis: string | null; reason: string },
) {
  await assertStaff(db, userId);
  const budget = await ensureBudget(db, userId, input.propertyId);

  const { error } = await db
    .from("onboarding_budgets")
    .update({
      approved_amount: input.amount,
      approved_basis: input.basis,
      approved_by: userId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", budget.id);
  if (error) throw error;

  await recordChange(db, {
    budgetId: budget.id,
    field: "approved_amount",
    oldValue: budget.approved_amount == null ? null : String(budget.approved_amount),
    newValue: input.amount == null ? null : String(input.amount),
    reason: input.reason,
    userId,
  });
  return { ok: true as const };
}

export type BudgetLineInput = {
  propertyId: string;
  lineId?: string | null;
  category: string;
  label: string;
  vendor: string | null;
  estimatedAmount: number;
  committedAmount: number | null;
  actualAmount: number | null;
  status: string;
  note: string | null;
  reason: string;
};

export async function saveBudgetLine(db: Client, userId: string, input: BudgetLineInput) {
  await assertStaff(db, userId);
  const budget = await ensureBudget(db, userId, input.propertyId);

  const payload = {
    budget_id: budget.id,
    property_id: input.propertyId,
    category: input.category,
    label: input.label,
    vendor: input.vendor,
    estimated_amount: input.estimatedAmount,
    committed_amount: input.committedAmount,
    actual_amount: input.actualAmount,
    status: input.status,
    note: input.note,
  };

  if (input.lineId) {
    const { data: before, error: readError } = await db
      .from("onboarding_budget_lines")
      .select(LINE_FIELDS)
      .eq("id", input.lineId)
      .eq("budget_id", budget.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!before) throw new Error("That budget line no longer exists.");

    const { error } = await db
      .from("onboarding_budget_lines")
      .update(payload)
      .eq("id", input.lineId);
    if (error) throw error;

    await recordChange(db, {
      budgetId: budget.id,
      lineId: input.lineId,
      field: "line",
      oldValue: describeLine(before as BudgetLine),
      newValue: describeLine({ ...(before as BudgetLine), ...payload } as BudgetLine),
      reason: input.reason,
      userId,
    });
    return { id: input.lineId };
  }

  const { data: created, error } = await db
    .from("onboarding_budget_lines")
    .insert({ ...payload, created_by: userId, is_demo: false })
    .select("id")
    .single();
  if (error) throw error;

  await recordChange(db, {
    budgetId: budget.id,
    lineId: created.id,
    field: "line_added",
    oldValue: null,
    newValue: describeLine(payload as unknown as BudgetLine),
    reason: input.reason,
    userId,
  });
  return { id: created.id };
}

function describeLine(line: BudgetLine): string {
  return [
    line.label,
    line.category,
    line.status,
    `est ${line.estimated_amount ?? 0}`,
    `committed ${line.committed_amount ?? "—"}`,
    `actual ${line.actual_amount ?? "—"}`,
  ].join(" · ");
}
