import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

/** Staff: every participation program plus the homes still free to enroll. */
export const ownerPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ demo: z.boolean().optional() })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadPrograms } = await import("./owner-program.server");
    await assertStaff(context.supabase, context.userId);
    return loadPrograms(context.supabase, data?.demo === true);
  });

/** Staff: the roadmap catalog behind every program. */
export const ownerTaskRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadTaskTemplates } = await import("./owner-program.server");
    await assertStaff(context.supabase, context.userId);
    return { templates: await loadTaskTemplates(context.supabase) };
  });

/** Supervisor: create a draft program. Activation is a separate, manual step. */
export const startOwnerProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        ownerName: z.string().trim().max(120).default(""),
        ownerEmail: z.string().trim().email().max(255).or(z.literal("")).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertEnrollmentAuthority, createProgram } = await import("./owner-program.server");
    await assertEnrollmentAuthority(context.supabase, context.userId);
    return createProgram(context.supabase, context.userId, data);
  });

/** Supervisor: add another home to a program. */
export const addOwnerProgramProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        expectedVersion: z.string().uuid(),
        propertyId: z.string().uuid(),
        closingDate: isoDate.nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertEnrollmentAuthority, addProgramProperty } = await import("./owner-program.server");
    await assertEnrollmentAuthority(context.supabase, context.userId);
    return addProgramProperty(context.supabase, context.userId, data);
  });

export const removeOwnerProgramProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        expectedVersion: z.string().uuid(),
        propertyId: z.string().uuid(),
        reason: z.string().trim().max(500).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertEnrollmentAuthority, removeProgramProperty } = await import("./owner-program.server");
    await assertEnrollmentAuthority(context.supabase, context.userId);
    return removeProgramProperty(context.supabase, context.userId, data);
  });

/** Supervisor: confirm a property's closing, a prerequisite for activation. */
export const confirmOwnerPropertyClosing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        expectedVersion: z.string().uuid(),
        propertyId: z.string().uuid(),
        closingDate: isoDate,
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertEnrollmentAuthority, confirmPropertyClosing } = await import("./owner-program.server");
    await assertEnrollmentAuthority(context.supabase, context.userId);
    return confirmPropertyClosing(context.supabase, context.userId, data);
  });

/** Supervisor: owner details, ARHA leads, DFY confirmation and internal notes. */
export const updateOwnerProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        expectedVersion: z.string().uuid(),
        onboardingLead: z.string().uuid().nullable().default(null),
        operationsLead: z.string().uuid().nullable().default(null),
        dfyConfirmed: z.boolean().default(false),
        internalNotes: z.string().trim().max(4000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertEnrollmentAuthority, updateProgramSettings } = await import("./owner-program.server");
    await assertEnrollmentAuthority(context.supabase, context.userId);
    return updateProgramSettings(context.supabase, context.userId, data);
  });

/** Supervisor: manually activate the program window. */
export const activateOwnerProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        expectedVersion: z.string().uuid(),
        startedOn: isoDate,
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { activateProgram } = await import("./owner-program.server");
    return activateProgram(context.supabase, context.userId, data);
  });

export const setOwnerProgramStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        expectedVersion: z.string().uuid(),
        status: z.enum([
          "draft",
          "waiting_for_closing",
          "ready_for_onboarding",
          "paused",
          "active",
        ]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertEnrollmentAuthority, setProgramStatus } = await import("./owner-program.server");
    await assertEnrollmentAuthority(context.supabase, context.userId);
    return setProgramStatus(context.supabase, context.userId, data);
  });

/** Supervisor: formal closeout, gated on hours and completed property work. */
export const completeOwnerProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ programId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertSupervisor, completeProgram } = await import("./owner-program.server");
    await assertSupervisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return completeProgram(context.supabase, context.userId, data.programId, supabaseAdmin);
  });

/** Supervisor: record a correction without overwriting what the owner entered. */
export const correctOwnerTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        entryId: z.string().uuid(),
        minutes: z.number().int().min(1).max(1440),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertSupervisor, recordTimeCorrection } = await import("./owner-program.server");
    await assertSupervisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return recordTimeCorrection(context.supabase, context.userId, data, supabaseAdmin);
  });

/** Supervisor: release owner activities from the roadmap catalog. */
export const seedOwnerRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        expectedVersion: z.string().uuid(),
        phase: z.enum(["onboarding", "ongoing", "all"]).default("all"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertEnrollmentAuthority, seedRoadmap } = await import("./owner-program.server");
    await assertEnrollmentAuthority(context.supabase, context.userId);
    return seedRoadmap(context.supabase, context.userId, data);
  });

/** Staff: one program with its homes, roadmap, participation log and history. */
export const ownerProgramDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ programId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadProgramDetail, loadInvites } = await import("./owner-program.server");
    await assertStaff(context.supabase, context.userId);
    const detail = await loadProgramDetail(context.supabase, data.programId);
    return { ...detail, invites: await loadInvites(context.supabase, data.programId) };
  });

/** Staff: the single combined participation report for the program. */
export const ownerProgramReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ programId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("./vendor.server");
    const { buildProgramReport } = await import("./owner-program.server");
    await assertStaff(context.supabase, context.userId);
    return buildProgramReport(context.supabase, data.programId);
  });

/** Supervisor: issue a single-use self-signup code for the homeowner. */
export const createOwnerInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        ownerEmail: z.string().trim().email().max(255).or(z.literal("")).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertEnrollmentAuthority, createInvite } = await import("./owner-program.server");
    await assertEnrollmentAuthority(context.supabase, context.userId);
    return createInvite(context.supabase, context.userId, data);
  });

/** Staff: owner-reported entries waiting on an internal decision. */
export const ownerTimeReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadTimeReviewQueue, loadProgramRules } = await import("./owner-review.server");
    await assertStaff(context.supabase, context.userId);
    return {
      entries: await loadTimeReviewQueue(context.supabase),
      rules: await loadProgramRules(context.supabase),
    };
  });

/** Supervisor: approve, return or flag an owner-reported entry. */
export const reviewOwnerTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        entryId: z.string().uuid(),
        expectedVersion: z.string().uuid(),
        decision: z.enum(["approved", "returned", "flagged"]),
        note: z.string().trim().max(1000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertSupervisor } = await import("./owner-program.server");
    const { reviewTimeEntry } = await import("./owner-review.server");
    await assertSupervisor(context.supabase, context.userId);
    return reviewTimeEntry(context.supabase, context.userId, data);
  });

/** Supervisor: change a program rule. Every change is audited. */
export const saveOwnerProgramRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        key: z.string().trim().min(2).max(60),
        value: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertSupervisor } = await import("./owner-program.server");
    const { updateProgramRule } = await import("./owner-review.server");
    await assertSupervisor(context.supabase, context.userId);
    return updateProgramRule(context.supabase, context.userId, data);
  });
