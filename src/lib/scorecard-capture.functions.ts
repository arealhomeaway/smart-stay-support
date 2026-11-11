/**
 * Scorecard capture actions. Every write goes through a caller-authenticated database
 * function that checks the role and uses server time (docs/pending/scorecard-capture/).
 * Until that SQL is applied, writes answer "not ready" and reads return empty.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CAPTURE_COPY,
  RATING_CHANNELS_KEY,
  archiveReasonProblem,
  isNotReadyError,
  pairCommitments,
  readRatingChannels,
  scorecardRoles,
  type CommitmentRow,
} from "./scorecard-capture";

type DbError = { message: string; code?: string } | null;
type Result = Promise<{ data: unknown; error: DbError }>;
type Query = Result & {
  select: (cols: string) => Query;
  eq: (col: string, v: unknown) => Query;
  in: (col: string, v: unknown[]) => Query;
  not: (col: string, op: string, v: unknown) => Query;
  order: (col: string, o?: { ascending: boolean }) => Query;
  limit: (n: number) => Query;
  maybeSingle: () => Result;
};
type Loose = {
  rpc: (fn: string, args?: Record<string, unknown>) => Result;
  from: (table: string) => Query;
};
const loose = (db: unknown) => db as Loose;

async function call(db: unknown, fn: string, args: Record<string, unknown>) {
  const { data, error } = await loose(db).rpc(fn, args);
  if (error) throw new Error(isNotReadyError(error) ? CAPTURE_COPY.notReady : error.message);
  return data as Record<string, unknown>;
}

export const getMyScorecardRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = loose(context.supabase);
    const uid = context.userId;
    const holds = async (code: string) => {
      const [held, cover] = await Promise.all([
        db.rpc("holds_functional_role", { _user_id: uid, _code: code }),
        db.rpc("seat_holder_at", { _role_code: code }),
      ]);
      return held.data === true || cover.data === uid;
    };
    const [roles, supervisorRole, directorRole, cooRole] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", uid),
      holds("ops_supervisor"),
      holds("director_ops"),
      holds("coo"),
    ]);
    const isAdmin = ((roles.data as { role: string }[] | null) ?? []).some((r) => r.role === "admin");
    return scorecardRoles({ isAdmin, supervisorRole, directorRole, cooRole });
  });

// ---- a. Ready for arrival -------------------------------------------------

export const arrivalReadyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), arrivalOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await loose(context.supabase)
      .from("scorecard_records")
      .select("id, recorded_at")
      .eq("kind", "arrival_readiness")
      .eq("property_id", data.propertyId)
      .eq("details->>arrival_on", data.arrivalOn)
      .order("recorded_at", { ascending: true })
      .limit(1);
    if (error) return { ready: false, recordedAt: null as string | null, available: !isNotReadyError(error) };
    const first = ((rows as { recorded_at: string }[] | null) ?? [])[0];
    return { ready: Boolean(first), recordedAt: first?.recorded_at ?? null, available: true };
  });

export const recordArrivalReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ propertyId: z.string().uuid(), arrivalOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), stayRef: z.string().max(100).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await call(context.supabase, "record_arrival_readiness", {
      _property_id: data.propertyId,
      _arrival_on: data.arrivalOn,
      _stay_ref: data.stayRef ?? null,
      _note: null,
    });
    return { recordedAt: String(r["recorded_at"] ?? ""), alreadyRecorded: r["already_recorded"] === true };
  });

// ---- b. Queue sweep, logged automatically on page open ---------------------

export const logQueueOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => // Build 16 B: only opening All unclaimed or the Team Queue is a queue check.
    z.object({ source: z.literal("team_queue") }).parse(d))
  .handler(async ({ data, context }) => {
    // Never blocks the page: a missing function or any error just means nothing was logged.
    const { data: r, error } = await loose(context.supabase).rpc("log_queue_open", { _source: data.source });
    if (error) return { recorded: false };
    return { recorded: (r as { recorded?: boolean } | null)?.recorded === true };
  });

// ---- c. Coaching conversation ---------------------------------------------

export const recordCoaching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      coordinatorId: z.string().uuid(),
      strength: z.string().max(1000),
      improvement: z.string().max(1000),
      followUp: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await call(context.supabase, "record_coaching_conversation", {
      _coordinator: data.coordinatorId,
      _strength: data.strength,
      _improvement: data.improvement,
      _follow_up: data.followUp ?? null,
    });
    return { recordedAt: String(r["recorded_at"] ?? "") };
  });

// ---- e. Corrective commitments --------------------------------------------

export const listCommitments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await loose(context.supabase)
      .from("scorecard_records")
      .select("id, recorded_at, recorded_by, note, refers_to, details")
      .eq("kind", "corrective_commitment")
      .eq("ticket_id", data.ticketId)
      .order("recorded_at", { ascending: false });
    if (error) return { available: !isNotReadyError(error), items: [] as ReturnType<typeof pairCommitments> };
    return { available: true, items: pairCommitments((rows as CommitmentRow[] | null) ?? []) };
  });

export const addCommitment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ticketId: z.string().uuid(), commitment: z.string().max(1000), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await call(context.supabase, "record_corrective_commitment", {
      _ticket_id: data.ticketId,
      _commitment: data.commitment,
      _due_on: data.dueOn,
    });
    return { ok: true };
  });

export const approveCommitment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ recordId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await call(context.supabase, "approve_corrective_commitment", { _record_id: data.recordId });
    return { ok: true };
  });

// ---- f. Finance packet ----------------------------------------------------

export const recordFinancePacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ weekEnding: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), complete: z.boolean(), note: z.string().max(1000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await call(context.supabase, "record_finance_packet", {
      _week_ending: data.weekEnding,
      _complete: data.complete,
      _note: data.note ?? null,
    });
    return { ok: true };
  });

// ---- 7. Guest rating channels ---------------------------------------------

export const getRatingChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await loose(context.supabase).from("app_settings").select("value").eq("key", RATING_CHANNELS_KEY).maybeSingle();
    return { channels: readRatingChannels((data as { value?: unknown } | null)?.value ?? null) };
  });

export const saveRatingChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ channels: z.array(z.string()).min(1).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await call(context.supabase, "set_guest_rating_channels", { _channels: data.channels });
    return { channels: readRatingChannels(r) };
  });

// ---- 5. Archive instead of delete -----------------------------------------

export const archiveTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticketId: z.string().uuid(), reason: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const problem = archiveReasonProblem(data.reason);
    if (problem) throw new Error(problem);
    await call(context.supabase, "archive_ticket", { _ticket_id: data.ticketId, _reason: data.reason.trim() });
    return { ok: true };
  });

export const restoreTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await call(context.supabase, "restore_ticket", { _ticket_id: data.ticketId });
    return { ok: true };
  });

export const listArchivedTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await loose(context.supabase)
      .from("tickets")
      .select("id, ref, title, archived_at, archive_reason")
      .not("archived_at", "is", null)
      .eq("is_demo", false)
      .order("archived_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Archived tickets could not be loaded. Try again.");
    return (data as { id: string; ref: number; title: string; archived_at: string; archive_reason: string | null }[] | null) ?? [];
  });

// ---- 4. Routine check corrections -----------------------------------------

export const listRoutineCorrections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ routineId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await loose(context.supabase)
      .from("routine_check_corrections")
      .select("id, note, corrected_at, corrected_by")
      .eq("routine_control_id", data.routineId)
      .order("corrected_at", { ascending: true });
    if (error) return { available: !isNotReadyError(error), items: [] as { id: string; note: string; corrected_at: string; corrected_by: string }[] };
    return { available: true, items: (rows as { id: string; note: string; corrected_at: string; corrected_by: string }[] | null) ?? [] };
  });

export const addRoutineCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ routineId: z.string().uuid(), note: z.string().max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    await call(context.supabase, "add_routine_correction", { _routine_id: data.routineId, _note: data.note });
    return { ok: true };
  });
