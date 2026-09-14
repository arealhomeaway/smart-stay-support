import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOnboardingFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { loadFinance } = await import("./onboarding-finance.server");
    return loadFinance(context.supabase, data.propertyId);
  });

export const createFinancialRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        taskId: z.string().uuid().nullable().optional(),
        kind: z.string().trim().min(2).max(40),
        title: z.string().trim().min(3).max(200),
        vendor: z.string().trim().max(120).nullable().optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        estimateAmount: z.number().min(0).max(1_000_000),
        emergency: z.boolean().default(false),
        emergencyReason: z.string().trim().max(200).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { createFinancialRequest } = await import("./onboarding-finance.server");
    return createFinancialRequest(context.supabase, context.userId, data);
  });

export const sendFinancialForApprovalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ requestId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { sendFinancialForApproval } = await import("./onboarding-finance.server");
    return sendFinancialForApproval(context.supabase, context.userId, data);
  });

export const decideFinancialRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        approved: z.boolean(),
        note: z.string().trim().min(3).max(1000),
        approvedAmount: z.number().min(0).max(1_000_000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { decideFinancialRequest } = await import("./onboarding-finance.server");
    return decideFinancialRequest(context.supabase, context.userId, data);
  });

export const recordInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        invoiceAmount: z.number().min(0).max(1_000_000),
        invoiceRef: z.string().trim().max(120).nullable().optional(),
        varianceNote: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { recordInvoice } = await import("./onboarding-finance.server");
    return recordInvoice(context.supabase, context.userId, data);
  });

export const sendToAccountingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ requestId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { sendToAccounting } = await import("./onboarding-finance.server");
    return sendToAccounting(context.supabase, context.userId, data);
  });

export const settleFinancialRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        note: z.string().trim().min(3).max(1000),
        actualAmount: z.number().min(0).max(1_000_000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { settleFinancialRequest } = await import("./onboarding-finance.server");
    return settleFinancialRequest(context.supabase, context.userId, data);
  });

export const setAccountingRecipientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ context, data }) => {
    const { setAccountingRecipient } = await import("./onboarding-finance.server");
    return setAccountingRecipient(context.supabase, context.userId, data.email);
  });

export const saveUtilityAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        propertyId: z.string().uuid(),
        utilityType: z.string().trim().min(2).max(40),
        provider: z.string().trim().max(120).default(""),
        accountLabel: z.string().trim().max(120).default(""),
        status: z.enum(["needed", "requested", "pending_transfer", "active", "closed"]),
        responsible: z.enum(["arha", "owner", "hoa"]).default("arha"),
        serviceStartOn: z.string().date().nullable().optional(),
        notes: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveUtilityAccount } = await import("./onboarding-finance.server");
    return saveUtilityAccount(context.supabase, context.userId, data);
  });

export const recordUtilityCostFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        propertyId: z.string().uuid(),
        amount: z.number().min(0).max(1_000_000),
        periodStart: z.string().date().nullable().optional(),
        periodEnd: z.string().date().nullable().optional(),
        invoiceRef: z.string().trim().max(120).nullable().optional(),
        paidOn: z.string().date().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { recordUtilityCost } = await import("./onboarding-finance.server");
    return recordUtilityCost(context.supabase, context.userId, data);
  });

export const proposeFactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        assetId: z.string().uuid().nullable().optional(),
        fieldKey: z.string().trim().min(2).max(60),
        proposedValue: z.string().trim().min(1).max(2000),
        taskId: z.string().uuid().nullable().optional(),
        sourceDetail: z.string().trim().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { proposeFact } = await import("./onboarding-finance.server");
    return proposeFact(context.supabase, context.userId, data);
  });

export const decideFactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        proposalId: z.string().uuid(),
        accept: z.boolean(),
        note: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { decideFact } = await import("./onboarding-finance.server");
    return decideFact(context.supabase, context.userId, data);
  });

export const setFinancialReconciliationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        handoffId: z.string().uuid(),
        status: z.enum(["open", "in_review", "reconciled"]),
        note: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setFinancialReconciliation } = await import("./onboarding-finance.server");
    return setFinancialReconciliation(context.supabase, context.userId, data);
  });
export const createOnboardingAssetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        kind: z.string().trim().min(1).max(80),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { createOnboardingAsset } = await import("./onboarding-finance.server");
    return createOnboardingAsset(context.supabase, context.userId, data);
  });
