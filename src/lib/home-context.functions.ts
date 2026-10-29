import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OpsOwnerRecord } from "./home-context";

const prop = z.object({ propertyId: z.string().uuid() });

/** Compact header data for one home: name, address, lifecycle and its onboarding project. */
export const readHomeContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => prop.parse(v))
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    const [home, project] = await Promise.all([
      db.from("properties").select("id,name,nickname,address_line1,city,state,lifecycle_status").eq("id", data.propertyId).single(),
      db.from("onboarding_projects").select("id,handoff_state").eq("property_id", data.propertyId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (home.error) throw new Error("This home could not be opened.");
    if (project.error) throw new Error(project.error.message);
    const h = home.data;
    return {
      name: h.nickname ?? h.name,
      address: [h.address_line1, h.city, h.state].filter(Boolean).join(", "),
      lifecycleStatus: h.lifecycle_status as string | null,
      project: project.data ? { id: project.data.id, handoffState: (project.data as { handoff_state: string | null }).handoff_state } : null,
    };
  });

/** Homes marked ready for Operations and not yet accepted, for the Director of Operations seat or its cover. */
export const readHandoffsWaitingForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const rpc = db.rpc.bind(db) as unknown as (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>;
    const [holder, cover] = await Promise.all([
      rpc("seat_holder", { _code: "director_ops" }),
      rpc("seat_override_at", { _role_code: "director_ops" }),
    ]);
    if (holder.error) throw new Error(holder.error.message);
    if (cover.error) throw new Error(cover.error.message);
    const coverUser = ((cover.data as { kind: string; user_id: string }[] | null) ?? []).find((o) => o.kind === "cover")?.user_id ?? null;
    const { isOpsDirectorSeat } = await import("./home-context");
    if (!isOpsDirectorSeat(context.userId, (holder.data as string | null) ?? null, coverUser)) return { show: false, rows: [] };
    const r = await db
      .from("onboarding_projects")
      .select("id,property_id,ready_for_ops_at,properties!inner(name,nickname,is_demo)")
      .eq("handoff_state", "ready")
      .neq("status", "cancelled");
    if (r.error) throw new Error(r.error.message);
    const rows = (r.data ?? []).map((p) => {
      const h = (p as unknown as { properties: { name: string; nickname: string | null; is_demo: boolean | null } }).properties;
      return { projectId: p.id, propertyId: p.property_id as string, name: h.nickname ?? h.name, readyAt: (p as { ready_for_ops_at: string | null }).ready_for_ops_at, demo: Boolean(h.is_demo) };
    });
    return { show: true, rows };
  });

/** Read-only: Ticket updates and Work Order approval requests sent to this home's owner from Operations. */
export const readOperationsOwnerRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => prop.parse(v))
  .handler(async ({ context, data }): Promise<OpsOwnerRecord[]> => {
    const db = context.supabase;
    const [updates, orders] = await Promise.all([
      db.from("ticket_owner_updates").select("id,ticket_id,revision,reviewed_at").eq("property_id", data.propertyId),
      db.from("work_orders").select("id,ticket_id,approval_id").eq("property_id", data.propertyId).not("approval_id", "is", null),
    ]);
    if (updates.error) throw new Error(updates.error.message);
    if (orders.error) throw new Error(orders.error.message);
    const ticketIds = [...new Set((updates.data ?? []).map((u) => u.ticket_id as string))];
    const approvalIds = (orders.data ?? []).map((o) => o.approval_id as string);
    const [responses, approvals] = await Promise.all([
      ticketIds.length
        ? db.from("owner_program_events").select("detail,created_at").in("kind", ["owner_participation_response", "owner_decision"]).eq("property_id", data.propertyId)
        : Promise.resolve({ data: [], error: null }),
      approvalIds.length
        ? db.from("approvals").select("id,title,status,created_at,decided_at").in("id", approvalIds).eq("approver_role", "owner")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (responses.error) throw new Error(responses.error.message);
    if (approvals.error) throw new Error(approvals.error.message);
    const answered = (ticketId: string, revision: number) =>
      ((responses.data ?? []) as { detail: unknown; created_at: string }[]).find((e) => {
        const d = e.detail as Record<string, unknown> | null;
        const u = d?.["ownerUpdate"] as Record<string, unknown> | undefined;
        return d?.["ticketId"] === ticketId && u?.["revision"] === revision;
      })?.created_at ?? null;
    const orderFor = new Map((orders.data ?? []).map((o) => [o.approval_id as string, o.ticket_id as string | null]));
    return [
      ...(updates.data ?? []).map((u) => ({ type: "Ticket update" as const, id: u.id as string, ticketId: u.ticket_id as string, title: "Ticket update", sentAt: u.reviewed_at as string | null, answeredAt: answered(u.ticket_id as string, u.revision as number) })),
      ...((approvals.data ?? []) as { id: string; title: string; status: string; created_at: string; decided_at: string | null }[]).map((a) => ({ type: "Approval request" as const, id: a.id, ticketId: orderFor.get(a.id) ?? null, title: a.title, sentAt: a.created_at, status: a.status, decidedAt: a.decided_at })),
    ];
  });
