/**
 * Plan catch-up server actions (Admin approval Nov 12). Every call runs as the signed-in
 * teammate; the database functions plan_catch_up_tasks and undo_onboarding_task_batch decide
 * who may act on which Task (item 7). Mark done stays bulkCompleteHomeTasksFn.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SHARED_ROLE_SEATS, ASSIGN_ROLES, type CatchUpViewer } from "@/lib/plan-catch-up";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;

export type CatchUpHeld = { taskId: string; title: string; reason: string };
export type CatchUpCard = { taskId: string; title: string; code: string; onPlan: boolean };
export type CatchUpResult = {
  ready: { taskId: string; title: string }[];
  held: CatchUpHeld[];
  done: number;
  batchId?: string | null;
  covered?: CatchUpCard[];
};
export type UndoResult = { restored: { taskId: string; title: string }[]; held: CatchUpHeld[]; cards: number; action: string };

/** Before the staged database change is applied the functions do not exist yet. */
export function notReadyMessage(error: { message: string; code?: string }) {
  return error.code === "PGRST202" || /Could not find the function/i.test(error.message) ? "This action is not available yet." : error.message;
}

/** Who the signed-in person is on this home, read as that person (item 7; reused by Add task, Part 1). */
export async function loadCatchUpViewer(
  sb: { rpc: (...a: never[]) => unknown; from: (t: string) => unknown },
  uid: string,
  propertyId: string,
): Promise<Omit<CatchUpViewer, "userId">> {
  const db = sb as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown }>;
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          neq: (c: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown }> } };
          };
        };
      };
    };
  };
  const [admin, onboarding, director, project, ...seats] = await Promise.all([
    db.rpc("has_role", { _user_id: uid, _role: "admin" }),
    db.rpc("has_role", { _user_id: uid, _role: "onboarding" }),
    db.rpc("is_onboarding_director", { _user_id: uid }),
    db.from("onboarding_projects").select("project_manager").eq("property_id", propertyId).neq("status", "cancelled")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ...SHARED_ROLE_SEATS.map((code) => db.rpc("holds_functional_role", { _user_id: uid, _code: code })),
  ]);
  return {
    isAdmin: admin.data === true,
    isOnboarding: onboarding.data === true,
    isOnboardingDirector: director.data === true,
    isHomePm: (project.data as { project_manager?: string | null } | null)?.project_manager === uid,
    roleCodes: SHARED_ROLE_SEATS.filter((_, i) => (seats[i] as { data: unknown } | undefined)?.data === true),
  };
}

export const planCatchUpViewerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<Omit<CatchUpViewer, "userId">> =>
    loadCatchUpViewer(context.supabase as never, context.userId, data.propertyId),
  );

export const planCatchUpTasksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        taskIds: z.array(z.string().uuid()).min(1).max(200),
        action: z.enum(["not_needed", "assign", "due_date", "reopen"]),
        reason: z.string().trim().max(500).nullable().default(null),
        role: z.enum(ASSIGN_ROLES).nullable().default(null),
        person: z.string().uuid().nullable().default(null),
        dueOn: z.string().date().nullable().default(null),
        dryRun: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: out, error } = await (context.supabase.rpc as unknown as Rpc)("plan_catch_up_tasks", {
      _property_id: data.propertyId,
      _task_ids: data.taskIds,
      _action: data.action,
      _reason: data.reason,
      _role: data.role,
      _person: data.person,
      _due_on: data.dueOn,
      _dry_run: data.dryRun,
    });
    if (error) throw new Error(notReadyMessage(error));
    return out as CatchUpResult;
  });

export const undoPlanCatchUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ batchId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: out, error } = await (context.supabase.rpc as unknown as Rpc)("undo_onboarding_task_batch", { _batch_id: data.batchId });
    if (error) throw new Error(notReadyMessage(error));
    return out as UndoResult;
  });
