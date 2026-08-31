/**
 * Server functions for Breezeway outbound task creation.
 *
 * Every one runs as the signed-in user and re-checks that they are Resolve
 * staff. The UI gate is cosmetic; this is the real boundary. Vendors and
 * homeowners can never reach these.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SourceInput = { sourceType: "ticket" | "onboarding_task"; sourceId: string };

async function assertStaff(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Resolve staff can send work to Breezeway.");
}

function parseSource(input: SourceInput) {
  const sourceType = input?.sourceType === "onboarding_task" ? "onboarding_task" : "ticket";
  const sourceId = String(input?.sourceId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(sourceId)) throw new Error("Invalid record reference.");
  return { sourceType, sourceId } as const;
}

/** Whether this record may be pushed, plus every link already created for it. */
export const breezewayOutboundState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseSource)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { listOutboundLinks, outboundEligibility } = await import(
      "@/lib/breezeway-outbound.server"
    );
    const [eligibility, links] = await Promise.all([
      outboundEligibility(data),
      listOutboundLinks(data),
    ]);
    return { eligibility, links };
  });

/** Creates one Breezeway task. Idempotent on `requestKey`. */
export const createBreezewayOutboundTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      input: SourceInput & {
        requestKey: string;
        title: string;
        description?: string | null;
        department?: string | null;
        priority?: string | null;
        scheduledDate?: string | null;
        scheduledTime?: string | null;
      },
    ) => {
      const source = parseSource(input);
      const requestKey = String(input?.requestKey ?? "").trim();
      if (requestKey.length < 16 || requestKey.length > 100) {
        throw new Error("Missing a valid request identifier.");
      }
      const title = String(input?.title ?? "").trim();
      if (!title) throw new Error("A task title is required.");
      const date = String(input?.scheduledDate ?? "").trim();
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid scheduled date.");
      const time = String(input?.scheduledTime ?? "").trim();
      if (time && !/^\d{2}:\d{2}$/.test(time)) throw new Error("Invalid scheduled time.");
      return {
        ...source,
        requestKey,
        title: title.slice(0, 200),
        description: input?.description ? String(input.description).slice(0, 4000) : null,
        department: input?.department ? String(input.department) : null,
        priority: input?.priority ? String(input.priority) : null,
        scheduledDate: date || null,
        scheduledTime: time || null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { createOutboundTask } = await import("@/lib/breezeway-outbound.server");
    return createOutboundTask(data, context.userId);
  });

/**
 * Admin review queue: outbound records Resolve could not confirm.
 * Admin-gated — this is the only place a Breezeway task id can be bound by hand.
 */
export const breezewayOutboundReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/access.server");
    await assertAdmin(context.supabase, context.userId);
    const { listOutboundNeedingReview } = await import("@/lib/breezeway-outbound.server");
    return listOutboundNeedingReview();
  });

/** Admin resolves ONE uncertain record: bind a verified task id, or close it as never created. */
export const reconcileBreezewayOutboundTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      action: "link" | "abandon";
      breezewayTaskId?: number | string | null;
      note?: string | null;
    }) => {
      const id = String(input?.id ?? "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid record reference.");
      const action = input?.action === "abandon" ? "abandon" : "link";
      const raw = String(input?.breezewayTaskId ?? "").trim();
      if (action === "link" && !/^\d{1,15}$/.test(raw)) {
        throw new Error("Enter the numeric Breezeway task id.");
      }
      return {
        id,
        action,
        breezewayTaskId: action === "link" ? Number(raw) : null,
        note: String(input?.note ?? "").slice(0, 500),
      } as const;
    },
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/access.server");
    await assertAdmin(context.supabase, context.userId);
    const { reconcileOutboundTask } = await import("@/lib/breezeway-outbound.server");
    return reconcileOutboundTask(data, context.userId);
  });
