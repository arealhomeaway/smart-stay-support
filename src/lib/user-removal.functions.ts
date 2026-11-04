import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./access.server";
import { BAN_FOREVER, isPendingSchemaError, type OpenWorkItem } from "./user-removal";

const PENDING = "This needs a database change that is not applied yet.";
const uid = (d: unknown) => z.object({ userId: z.string().uuid() }).parse(d);

// The new functions are not in the generated types until the pending SQL is applied.
type AnyRpc = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }> };

async function setLogin(userId: string, on: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: on ? "none" : BAN_FOREVER } as never);
  if (error) throw new Error(`The record was saved, but the login could not be turned ${on ? "on" : "off"}: ${error.message}`);
}

/** Admin: open work a staff member still owns. */
export const staffOpenWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uid)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await (context.supabase as unknown as AnyRpc).rpc("staff_open_work", { _user: data.userId });
    if (error) {
      if (isPendingSchemaError(error)) return { pending: true as const, items: [] as OpenWorkItem[] };
      throw new Error(error.message);
    }
    return { pending: false as const, items: (rows ?? []) as OpenWorkItem[] };
  });

/** Admin: hand every open item to the seat, its backup, then the Operations Supervisor. */
export const reassignStaffOpenWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uid)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: n, error } = await (context.supabase as unknown as AnyRpc).rpc("reassign_staff_open_work", { _user: data.userId });
    if (error) throw new Error(isPendingSchemaError(error) ? PENDING : error.message);
    return { moved: Number(n ?? 0) };
  });

/** Admin: delete a staff user (kept as a former record), then turn the login off. */
export const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uid)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase as unknown as AnyRpc).rpc("remove_staff_user", { _user: data.userId });
    if (error) throw new Error(isPendingSchemaError(error) ? PENDING : error.message);
    await setLogin(data.userId, false);
    return { ok: true as const };
  });

/** Admin: homeowner, co-owner or vendor logins with their archive state. */
export const listArchivableAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["owner", "vendor"]) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error: rErr } = await supabaseAdmin.from("user_roles").select("user_id, role");
    if (rErr) throw rErr;
    const all = (roles ?? []) as { user_id: string; role: string }[];
    const staff = new Set(all.filter((r) => ["admin", "manager", "onboarding", "tech"].includes(r.role)).map((r) => r.user_id));
    const ids = [...new Set(all.filter((r) => r.role === data.kind && !staff.has(r.user_id)).map((r) => r.user_id))];
    if (ids.length === 0) return { pending: false, accounts: [] };
    const { data: profiles, error } = await supabaseAdmin.from("profiles").select("*").in("id", ids).order("full_name");
    if (error) throw error;
    const rows = (profiles ?? []) as { id: string; full_name: string | null; email: string | null; archived_at?: string | null }[];
    const pending = rows.length > 0 && !("archived_at" in rows[0]!);
    return {
      pending,
      accounts: rows.map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Unnamed", email: p.email, archivedAt: p.archived_at ?? null })),
    };
  });

/** Admin: archive (login off, history kept) or restore a homeowner or vendor account. */
export const setAccountArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase as unknown as AnyRpc).rpc("set_account_archived", { _user: data.userId, _archived: data.archived });
    if (error) throw new Error(isPendingSchemaError(error) ? PENDING : error.message);
    await setLogin(data.userId, !data.archived);
    return { ok: true as const };
  });
