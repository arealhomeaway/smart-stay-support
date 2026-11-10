/**
 * Coverage schedule management (server functions).
 *
 * These write the SAME rows the routing engine reads — seats, recurring
 * shifts, temporary overrides and the on-call roster. There is no separate
 * display schedule, so anything leadership changes here takes effect on the
 * next routing decision.
 *
 * Editing is limited to Operations Supervisor / Director / Admin through the
 * existing `is_supervisor` rule. Every change is recorded in the audit log
 * with actor, target, old value and new value; there is no audit UI noise.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { responsibilitySeatWriter } from "./responsibility-seats.server";
import { scheduleOnlyPeople } from "./team-schedule";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function assertCanEditCoverage({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("is_supervisor", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Operations leadership can change the coverage plan.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(entry: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const { writeAudit } = await import("./audit.server");
  await writeAudit(entry);
}

function code(value: unknown, label = "seat") {
  const v = String(value ?? "").trim();
  if (!/^[a-z0-9_]{2,40}$/.test(v)) throw new Error(`Invalid ${label}.`);
  return v;
}

function uuidOrNull(value: unknown) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (!/^[0-9a-f-]{36}$/i.test(v)) throw new Error("Invalid person reference.");
  return v;
}

function minute(value: unknown) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1440) throw new Error("Times must be within one day.");
  return n;
}

/** Everything the coverage editor and the routing engine share. */
export const coverageModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const [roles, shifts, overrides, triage, roster, people, cfg, canEdit] = await Promise.all([
      supabase.from("functional_roles").select("*").order("sort_order"),
      supabase.from("coverage_shifts").select("*").order("weekday"),
      supabase.from("coverage_overrides").select("*").order("starts_at"),
      supabase.from("coverage_triage_windows").select("*").eq("active", true).order("weekday"),
      supabase.from("oncall_roster").select("*").order("starts_on"),
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("coverage_config").select("*").maybeSingle(),
      supabase.rpc("is_supervisor", { _user_id: context.userId }),
    ]);
    const settings = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["oncall_weekday_pattern", "schedule_grid_seats", "test_account_ids"]);
    const setting = (k: string) => (settings.data ?? []).find((r: { key: string }) => r.key === k)?.value ?? null;
    // Staff with roles and sign-in state (for pickers). Only leadership gets
    // this list, read after the supervisor check above.
    let staff: { id: string; full_name: string | null; email: string | null; roles: string[]; active: boolean }[] = [];
    if (canEdit.data === true) {
      const db = await admin();
      const [{ data: ur }, users] = await Promise.all([
        db.from("user_roles").select("user_id, role"),
        db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
      const authById = new Map((users.data?.users ?? []).map((u) => [u.id, u]));
      staff = ((people.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => {
        const u = authById.get(p.id) as { banned_until?: string | null } | undefined;
        const banned = !!u?.banned_until && new Date(u.banned_until) > new Date();
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          roles: ((ur ?? []) as { user_id: string; role: string }[]).filter((r) => r.user_id === p.id).map((r) => r.role),
          active: !!u && !banned,
        };
      });
    }
    // Register S4: a coordinator (read only) gets only the people the schedule names, never the full list.
    const shownPeople =
      canEdit.data === true
        ? (people.data ?? [])
        : scheduleOnlyPeople((people.data ?? []) as { id: string; full_name: string | null; oncall_eligible: boolean | null }[], {
            roles: (roles.data ?? []) as { current_seat_holder?: string | null }[],
            overrides: (overrides.data ?? []) as { user_id?: string | null }[],
            roster: (roster.data ?? []) as { user_id?: string | null }[],
            pattern: setting("oncall_weekday_pattern"),
            self: context.userId,
          });
    const eligibleIds = (shownPeople as { id: string; oncall_eligible: boolean | null }[])
      .filter((p) => p.oncall_eligible)
      .map((p) => p.id);
    return {
      staff,
      eligibleIds,
      patternSetting: setting("oncall_weekday_pattern"),
      gridSeatsSetting: setting("schedule_grid_seats"),
      testAccountIds: (Array.isArray(setting("test_account_ids")) ? setting("test_account_ids") : []) as string[],
      roles: roles.data ?? [],
      shifts: shifts.data ?? [],
      overrides: overrides.data ?? [],
      triage: triage.data ?? [],
      roster: roster.data ?? [],
      people: shownPeople,
      config: cfg.data ?? null,
      canEdit: canEdit.data === true,
    };
  });

/** Seat an existing internal user, or clear the seat. Never creates a user. */
export const setSeatHolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roleCode: string; userId: string | null }) => ({
    roleCode: code(input?.roleCode),
    userId: uuidOrNull(input?.userId),
  }))
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    const db = await responsibilitySeatWriter(context, data.roleCode, admin);
    const { data: before } = await db
      .from("functional_roles")
      .select("current_seat_holder, current_seat_name")
      .eq("code", data.roleCode)
      .maybeSingle();

    let name: string | null = null;
    if (data.userId) {
      const { data: profile } = await db
        .from("profiles")
        .select("full_name, email")
        .eq("id", data.userId)
        .maybeSingle();
      if (!profile) throw new Error("That person does not have a Resolve account yet.");
      const p = profile as { full_name: string | null; email: string | null };
      name = p.full_name ?? p.email;
    } else {
      name = (before as { current_seat_name: string | null } | null)?.current_seat_name ?? null;
    }

    const { error } = await db
      .from("functional_roles")
      .update({ current_seat_holder: data.userId, current_seat_name: name })
      .eq("code", data.roleCode);
    if (error) throw error;
    await audit({
      actorId: context.userId,
      action: "coverage.seat_holder_changed",
      entityType: "functional_role",
      entityId: data.roleCode,
      entityLabel: data.roleCode,
      before,
      after: { current_seat_holder: data.userId, current_seat_name: name },
    });
    return { ok: true as const };
  });

/** Temporarily mark a seat unavailable (or bring it back). */
export const setSeatAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { roleCode: string; available: boolean; note?: string; until?: string | null }) => ({
      roleCode: code(input?.roleCode),
      available: Boolean(input?.available),
      note: String(input?.note ?? "").slice(0, 400),
      until: input?.until ? new Date(input.until).toISOString() : null,
    }),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    const db = await responsibilitySeatWriter(context, data.roleCode, admin);
    const { data: before } = await db
      .from("functional_roles")
      .select("available, unavailable_note, unavailable_until")
      .eq("code", data.roleCode)
      .maybeSingle();
    const after = {
      available: data.available,
      unavailable_note: data.available ? null : data.note || null,
      unavailable_until: data.available ? null : data.until,
    };
    const { error } = await db
      .from("functional_roles")
      .update(after as never)
      .eq("code", data.roleCode);
    if (error) throw error;
    await audit({
      actorId: context.userId,
      action: "coverage.seat_availability_changed",
      entityType: "functional_role",
      entityId: data.roleCode,
      entityLabel: data.roleCode,
      before,
      after,
    });
    return { ok: true as const };
  });

/** Add or edit one recurring shift row. */
export const saveShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      roleCode: string;
      weekday: number;
      startMinute: number;
      endMinute: number;
      active?: boolean;
    }) => ({
      id: uuidOrNull(input?.id),
      roleCode: code(input?.roleCode),
      weekday: Number(input?.weekday),
      startMinute: minute(input?.startMinute),
      endMinute: minute(input?.endMinute),
      active: input?.active !== false,
    }),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    if (!Number.isInteger(data.weekday) || data.weekday < 0 || data.weekday > 6) {
      throw new Error("Pick a day of the week.");
    }
    if (data.startMinute === data.endMinute) throw new Error("The shift needs a length.");
    const db = await admin();
    const row = {
      role_code: data.roleCode,
      weekday: data.weekday,
      start_minute: data.startMinute,
      end_minute: data.endMinute,
      active: data.active,
    };
    let before: unknown = null;
    if (data.id) {
      const { data: prev } = await db
        .from("coverage_shifts")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      before = prev;
      const { error } = await db
        .from("coverage_shifts")
        .update(row as never)
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await db
        .from("coverage_shifts")
        .insert({ ...row, created_by: context.userId } as never);
      if (error) throw error;
    }
    await audit({
      actorId: context.userId,
      action: data.id ? "coverage.shift_updated" : "coverage.shift_added",
      entityType: "coverage_shift",
      entityId: data.id,
      entityLabel: data.roleCode,
      before,
      after: row,
    });
    return { ok: true as const };
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: uuidOrNull(input?.id)! }))
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    const db = await admin();
    const { data: before } = await db
      .from("coverage_shifts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await db.from("coverage_shifts").delete().eq("id", data.id);
    if (error) throw error;
    await audit({
      actorId: context.userId,
      action: "coverage.shift_removed",
      entityType: "coverage_shift",
      entityId: data.id,
      before,
      after: null,
    });
    return { ok: true as const };
  });

/** Temporary cover or time off for a seat on a specific date/time range. */
export const saveOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      roleCode: string;
      kind: "cover" | "off";
      userId?: string | null;
      startsAt: string;
      endsAt: string;
      note?: string;
    }) => ({
      roleCode: code(input?.roleCode),
      kind: input?.kind === "off" ? ("off" as const) : ("cover" as const),
      userId: uuidOrNull(input?.userId),
      startsAt: new Date(input?.startsAt).toISOString(),
      endsAt: new Date(input?.endsAt).toISOString(),
      note: String(input?.note ?? "").slice(0, 400),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    if (new Date(data.endsAt) <= new Date(data.startsAt))
      throw new Error("The override needs an end after its start.");
    if (data.kind === "cover" && !data.userId) throw new Error("Choose who is covering.");
    const db = await responsibilitySeatWriter(context, data.roleCode, admin);
    const row = {
      role_code: data.roleCode,
      kind: data.kind,
      user_id: data.kind === "cover" ? data.userId : null,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      note: data.note || null,
      created_by: context.userId,
    };
    const { error } = await db.from("coverage_overrides").insert(row as never);
    if (error) throw error;
    await audit({
      actorId: context.userId,
      action: "coverage.override_added",
      entityType: "coverage_override",
      entityId: null,
      entityLabel: data.roleCode,
      before: null,
      after: row,
    });
    return { ok: true as const };
  });

/** Removing the override restores the normal recurring schedule. */
export const deleteOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: uuidOrNull(input?.id)! }))
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    const db = await admin();
    const { data: before } = await db
      .from("coverage_overrides")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("That coverage override no longer exists.");
    const writer = await responsibilitySeatWriter(context, before.role_code, admin);
    const { error } = await writer
      .from("coverage_overrides")
      .delete()
      .eq("id", data.id)
      .eq("role_code", before.role_code);
    if (error) throw error;
    await audit({
      actorId: context.userId,
      action: "coverage.override_removed",
      entityType: "coverage_override",
      entityId: data.id,
      before,
      after: null,
    });
    return { ok: true as const };
  });

/** On-call roster write — the same table after-hours routing reads. */
export const saveOnCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      userId: string;
      startsOn: string;
      endsOn: string;
      label?: string;
    }) => ({
      id: uuidOrNull(input?.id),
      userId: uuidOrNull(input?.userId)!,
      startsOn: String(input?.startsOn ?? "").slice(0, 10),
      endsOn: String(input?.endsOn ?? "").slice(0, 10),
      label: String(input?.label ?? "On-call").slice(0, 80),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(data.endsOn)) {
      throw new Error("Pick a start and end date.");
    }
    if (data.endsOn < data.startsOn)
      throw new Error("The end date cannot be before the start date.");
    const db = await admin();
    const row = {
      user_id: data.userId,
      starts_on: data.startsOn,
      ends_on: data.endsOn,
      label: data.label,
    };
    let before: unknown = null;
    if (data.id) {
      const { data: prev } = await db
        .from("oncall_roster")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      before = prev;
      const { error } = await db
        .from("oncall_roster")
        .update(row as never)
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await db
        .from("oncall_roster")
        .insert({ ...row, created_by: context.userId } as never);
      if (error) throw error;
    }
    await audit({
      actorId: context.userId,
      action: data.id ? "coverage.oncall_updated" : "coverage.oncall_added",
      entityType: "oncall_roster",
      entityId: data.id,
      before,
      after: row,
    });
    return { ok: true as const };
  });

export const deleteOnCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: uuidOrNull(input?.id)! }))
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    const db = await admin();
    const { data: before } = await db
      .from("oncall_roster")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await db.from("oncall_roster").delete().eq("id", data.id);
    if (error) throw error;
    await audit({
      actorId: context.userId,
      action: "coverage.oncall_removed",
      entityType: "oncall_roster",
      entityId: data.id,
      before,
      after: null,
    });
    return { ok: true as const };
  });

// ---------- Pass A.2: weekday pattern, date changes, settings ----------

async function assertAdminCaller({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only an Admin can change this setting.");
}

async function writeSetting(key: string, value: unknown, actorId: string) {
  const db = await admin();
  const { data: prev } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
  const { error } = await db
    .from("app_settings")
    .upsert({ key, value: value as never, updated_by: actorId, updated_at: new Date().toISOString() } as never, { onConflict: "key" });
  if (error) throw error;
  await audit({ actorId, action: "settings.updated", entityType: "app_settings", entityId: null, entityLabel: key, before: prev?.value ?? null, after: value });
}

async function eligibleOnCall(): Promise<Set<string>> {
  const db = await admin();
  const { data, error } = await db.from("profiles").select("id").eq("oncall_eligible", true);
  if (error) throw error;
  return new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Weekday pattern (Sunday to Saturday). Never touches dated roster rows. */
export const saveOnCallPattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pattern: (string | null)[] }) => {
    const p = Array.isArray(input?.pattern) ? input.pattern : [];
    if (p.length !== 7) throw new Error("Pick a person for each day of the week.");
    return { pattern: p.map((x) => uuidOrNull(x)) };
  })
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    const ok = await eligibleOnCall();
    if (data.pattern.some((u) => !u)) throw new Error("Every day needs someone on call.");
    if (data.pattern.some((u) => u && !ok.has(u))) throw new Error("Only people on the on-call list can be picked.");
    await writeSetting("oncall_weekday_pattern", Object.fromEntries(data.pattern.map((u, i) => [String(i), u ?? ""])), context.userId);
    return { ok: true as const };
  });

/**
 * Date changes in one call: each date gets one single-night row (or none, to
 * fall back to the pattern). One delete and one insert, so range, swap and
 * single nights save together.
 */
export const saveOnCallNights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { changes: { date: string; userId: string | null; note?: string }[] }) => {
    const c = Array.isArray(input?.changes) ? input.changes : [];
    if (c.length === 0 || c.length > 370) throw new Error("Pick between 1 and 370 nights.");
    return {
      changes: c.map((x) => {
        const date = String(x?.date ?? "").slice(0, 10);
        if (!isDate(date)) throw new Error("Pick a valid date.");
        return { date, userId: uuidOrNull(x?.userId), note: String(x?.note ?? "").slice(0, 160) };
      }),
    };
  })
  .handler(async ({ data, context }) => {
    await assertCanEditCoverage(context);
    const ok = await eligibleOnCall();
    if (data.changes.some((c) => c.userId && !ok.has(c.userId))) throw new Error("Only people on the on-call list can be picked.");
    const { dateChangeLabel } = await import("./team-schedule");
    const db = await admin();
    const dates = [...new Set(data.changes.map((c) => c.date))];
    const { data: before } = await db.from("oncall_roster").select("*").in("starts_on", dates);
    const replace = ((before ?? []) as { id: string; starts_on: string; ends_on: string }[]).filter((r) => r.starts_on === r.ends_on);
    if (replace.length) {
      const { error } = await db.from("oncall_roster").delete().in("id", replace.map((r) => r.id));
      if (error) throw error;
    }
    const rows = data.changes
      .filter((c) => c.userId)
      .map((c) => ({ user_id: c.userId!, starts_on: c.date, ends_on: c.date, label: dateChangeLabel(c.note), created_by: context.userId }));
    if (rows.length) {
      const { error } = await db.from("oncall_roster").insert(rows as never);
      if (error) throw error;
    }
    await audit({ actorId: context.userId, action: "coverage.oncall_dates_changed", entityType: "oncall_roster", entityId: null, before: replace, after: rows });
    return { ok: true as const };
  });

/** Admin: who may be picked for on call. */
export const setOncallEligible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; eligible: boolean }) => ({ userId: uuidOrNull(input?.userId)!, eligible: input?.eligible === true }))
  .handler(async ({ data, context }) => {
    await assertAdminCaller(context);
    const db = await admin();
    const { data: prev } = await db.from("profiles").select("oncall_eligible").eq("id", data.userId).maybeSingle();
    const { error } = await db.from("profiles").update({ oncall_eligible: data.eligible } as never).eq("id", data.userId);
    if (error) throw error;
    await audit({ actorId: context.userId, action: "user.oncall_eligible_changed", entityType: "user", entityId: data.userId, before: prev, after: { oncall_eligible: data.eligible } });
    return { ok: true as const };
  });

/** Admin: mark or unmark an account as a test account (hidden by default). Never deletes. */
export const setTestAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; test: boolean }) => ({ userId: uuidOrNull(input?.userId)!, test: input?.test === true }))
  .handler(async ({ data, context }) => {
    await assertAdminCaller(context);
    const db = await admin();
    const { data: row } = await db.from("app_settings").select("value").eq("key", "test_account_ids").maybeSingle();
    const cur = (Array.isArray(row?.value) ? row!.value : []) as string[];
    const next = data.test ? [...new Set([...cur, data.userId])] : cur.filter((x) => x !== data.userId);
    await writeSetting("test_account_ids", next, context.userId);
    return { ok: true as const };
  });

/** Admin: which seats show as rows on the schedule grid. Display only. */
export const saveGridSeats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { codes: string[] }) => ({ codes: (Array.isArray(input?.codes) ? input.codes : []).map((c) => code(c)) }))
  .handler(async ({ data, context }) => {
    await assertAdminCaller(context);
    await writeSetting("schedule_grid_seats", data.codes, context.userId);
    return { ok: true as const };
  });
