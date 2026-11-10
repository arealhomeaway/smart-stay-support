/**
 * Onboarding project fields from the Notion Onboarding Project Database (register O3).
 * Both writes are caller-authenticated database functions: the save runs under the
 * existing update rule for onboarding projects, the correction is Supervisor or Admin only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INVOICE_STATUSES, NOTION_STATUSES, OWNER_TYPES, PMA_STATUSES } from "@/lib/onboarding-board";

const optionalChoice = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).nullable().optional();

const patchSchema = z
  .object({
    owner_type: optionalChoice(OWNER_TYPES as unknown as [string, ...string[]]),
    project_status: optionalChoice(NOTION_STATUSES as unknown as [string, ...string[]]),
    pma_status: optionalChoice(PMA_STATUSES as unknown as [string, ...string[]]),
    invoice_status: optionalChoice(INVOICE_STATUSES as unknown as [string, ...string[]]),
    greater_area: z.string().trim().max(120).nullable().optional(),
    weekly_status: z.string().trim().max(2000).nullable().optional(),
    committed_handoff_on: z.string().date().nullable().optional(),
  })
  .strict();

export const saveOnboardingDetailsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), patch: patchSchema }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("save_onboarding_project_details", {
      _project_id: data.projectId,
      _patch: data.patch,
    });
    if (error) throw new Error(error.message);
    return result as { projectId: string; changed: number };
  });

export const correctCommittedHandoffFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        date: z.string().date(),
        reason: z.string().trim().min(5, "Give a reason for the correction.").max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("correct_committed_handoff_date", {
      _project_id: data.projectId,
      _date: data.date,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return result as { projectId: string; committedHandoffOn: string };
  });
