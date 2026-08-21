import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

/** Staff: every enrolled home plus the homes still available to enroll. */
export const ownerPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadPrograms } = await import("./owner-program.server");
    await assertStaff(context.supabase, context.userId);
    return loadPrograms(context.supabase);
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

/** Supervisor: enroll a home in the 90-day program. */
export const startOwnerProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        ownerName: z.string().trim().max(120).default(""),
        ownerEmail: z.string().trim().email().max(255).or(z.literal("")).default(""),
        startedOn: isoDate.nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertSupervisor, createProgram } = await import("./owner-program.server");
    await assertSupervisor(context.supabase, context.userId);
    return createProgram(context.supabase, context.userId, data);
  });

/** Supervisor: set or move the 90-day clock. */
export const setOwnerProgramStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ programId: z.string().uuid(), startedOn: isoDate }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertSupervisor, setProgramStart } = await import("./owner-program.server");
    await assertSupervisor(context.supabase, context.userId);
    return setProgramStart(context.supabase, data.programId, data.startedOn);
  });

/** Supervisor: seed owner reviews from the roadmap catalog. */
export const seedOwnerRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        phase: z.enum(["onboarding", "ongoing", "all"]).default("all"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertSupervisor, seedRoadmap } = await import("./owner-program.server");
    await assertSupervisor(context.supabase, context.userId);
    return seedRoadmap(context.supabase, context.userId, data);
  });

/** Staff: one program with its roadmap and reported time. */
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
    const { assertSupervisor, createInvite } = await import("./owner-program.server");
    await assertSupervisor(context.supabase, context.userId);
    return createInvite(context.supabase, context.userId, data);
  });
