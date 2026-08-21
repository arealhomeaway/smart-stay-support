/**
 * Active Owner Participation Program (server-only).
 *
 * Each participating home gets one 90-day program. ARHA seeds the roadmap of
 * owner reviews from the task template catalog, the homeowner works through
 * them and self-reports the time they actually spent. The template catalog
 * carries internal planning ranges so we can staff the roadmap; those never
 * leave the staff surface.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_ONBOARDING_HOURS,
  DEFAULT_ONGOING_HOURS,
  DEFAULT_TARGET_HOURS,
  PROGRAM_DAYS,
  type DecisionPath,
  type ProgramPhase,
  type ProgramRow,
  type TaskTemplate,
} from "./owner-program";

type Client = SupabaseClient<Database>;

/** Throws unless the caller is an admin or manager. */
export async function assertSupervisor(supabase: Client, userId: string) {
  const [admin, manager] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  if (admin.error || manager.error) throw new Error("Could not verify your access level.");
  if (!admin.data && !manager.data) {
    throw new Error("Only a supervisor can manage owner participation programs.");
  }
}

function locationOf(p: { city: string | null; state: string | null }) {
  return [p.city, p.state].filter(Boolean).join(", ");
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The whole roadmap catalog, in phase / stage / sort order. */
export async function loadTaskTemplates(supabase: Client): Promise<TaskTemplate[]> {
  const { data, error } = await supabase
    .from("owner_task_templates")
    .select(
      "id, phase, stage, code, title, summary, owner_action, decision_path, planning_hours_low, planning_hours_high, respond_within_days, recurring, sort_order",
    )
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    ...t,
    phase: t.phase as ProgramPhase,
    decision_path: t.decision_path as DecisionPath,
    planning_hours_low: Number(t.planning_hours_low),
    planning_hours_high: Number(t.planning_hours_high),
  }));
}

/**
 * Every active home with its program state. Homes without a program appear
 * too, so a supervisor can start one without hunting for the property first.
 */
export async function loadPrograms(supabase: Client) {
  const [properties, programs, reviews, entries] = await Promise.all([
    supabase.from("properties").select("id, name, nickname, city, state").eq("active", true).order("name"),
    supabase
      .from("owner_programs")
      .select(
        "id, property_id, owner_user_id, owner_name, owner_email, status, started_on, ends_on, target_hours, onboarding_target_hours, ongoing_target_hours",
      ),
    supabase.from("owner_reviews").select("id, program_id, status"),
    supabase.from("owner_time_entries").select("program_id, phase, minutes"),
  ]);
  if (properties.error) throw properties.error;
  if (programs.error) throw programs.error;
  if (reviews.error) throw reviews.error;
  if (entries.error) throw entries.error;

  const rows: ProgramRow[] = [];
  for (const property of properties.data ?? []) {
    const program = (programs.data ?? []).find((p) => p.property_id === property.id);
    if (!program) continue;
    const mine = (reviews.data ?? []).filter((r) => r.program_id === program.id);
    const time = (entries.data ?? []).filter((e) => e.program_id === program.id);
    const sum = (phase?: ProgramPhase) =>
      time.filter((e) => !phase || e.phase === phase).reduce((n, e) => n + e.minutes, 0);

    rows.push({
      id: program.id,
      propertyId: property.id,
      propertyName: property.nickname || property.name,
      location: locationOf(property),
      ownerName: program.owner_name,
      ownerEmail: program.owner_email,
      ownerLinked: Boolean(program.owner_user_id),
      status: program.status as ProgramRow["status"],
      startedOn: program.started_on,
      endsOn: program.ends_on,
      targetHours: Number(program.target_hours),
      onboardingTargetHours: Number(program.onboarding_target_hours),
      ongoingTargetHours: Number(program.ongoing_target_hours),
      reviewCount: mine.length,
      openReviewCount: mine.filter((r) => r.status !== "closed").length,
      reportedMinutes: sum(),
      onboardingMinutes: sum("onboarding"),
      ongoingMinutes: sum("ongoing"),
    });
  }

  const enrolledIds = new Set(rows.map((r) => r.propertyId));
  const available = (properties.data ?? [])
    .filter((p) => !enrolledIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.nickname || p.name, location: locationOf(p) }));

  return { rows, available };
}

/** Starts (or re-reads) the 90-day program for one home. */
export async function createProgram(
  supabase: Client,
  userId: string,
  input: { propertyId: string; ownerName: string; ownerEmail: string; startedOn: string | null },
) {
  const existing = await supabase
    .from("owner_programs")
    .select("id")
    .eq("property_id", input.propertyId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { programId: existing.data.id, alreadyExists: true as const };

  const startedOn = input.startedOn;
  const { data, error } = await supabase
    .from("owner_programs")
    .insert({
      property_id: input.propertyId,
      owner_name: input.ownerName || null,
      owner_email: input.ownerEmail || null,
      status: startedOn ? "active" : "pending",
      started_on: startedOn,
      // The 90th day inclusive of day one.
      ends_on: startedOn ? addDays(startedOn, PROGRAM_DAYS - 1) : null,
      target_hours: DEFAULT_TARGET_HOURS,
      onboarding_target_hours: DEFAULT_ONBOARDING_HOURS,
      ongoing_target_hours: DEFAULT_ONGOING_HOURS,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { programId: data.id, alreadyExists: false as const };
}

/** Sets or moves the 90-day clock. */
export async function setProgramStart(supabase: Client, programId: string, startedOn: string) {
  const { error } = await supabase
    .from("owner_programs")
    .update({ started_on: startedOn, ends_on: addDays(startedOn, PROGRAM_DAYS - 1), status: "active" })
    .eq("id", programId);
  if (error) throw error;
  return { ok: true as const };
}

/**
 * Seeds owner reviews from the roadmap catalog. Templates already on the
 * program are skipped, so this is safe to run again when the catalog grows
 * or when a home moves from onboarding into ongoing operations.
 */
export async function seedRoadmap(
  supabase: Client,
  userId: string,
  input: { programId: string; phase: ProgramPhase | "all" },
) {
  const program = await supabase
    .from("owner_programs")
    .select("id, started_on")
    .eq("id", input.programId)
    .single();
  if (program.error) throw program.error;

  const templates = await loadTaskTemplates(supabase);
  const wanted = templates.filter((t) => input.phase === "all" || t.phase === input.phase);

  const existing = await supabase
    .from("owner_reviews")
    .select("template_id")
    .eq("program_id", input.programId);
  if (existing.error) throw existing.error;
  const seeded = new Set((existing.data ?? []).map((r) => r.template_id).filter(Boolean));

  const anchor = program.data.started_on ?? new Date().toISOString().slice(0, 10);
  const toInsert = wanted
    .filter((t) => !seeded.has(t.id))
    .map((t) => ({
      program_id: input.programId,
      template_id: t.id,
      phase: t.phase,
      stage: t.stage,
      title: t.title,
      recommendation: t.summary,
      impact: t.owner_action,
      decision_path: t.decision_path,
      respond_by: addDays(anchor, t.respond_within_days),
      status: "prepared",
      sort_order: t.sort_order,
      created_by: userId,
    }));

  if (toInsert.length === 0) return { added: 0 };
  const { error } = await supabase.from("owner_reviews").insert(toInsert);
  if (error) throw error;
  return { added: toInsert.length };
}

/** The roadmap as it stands for one program, grouped for display. */
export async function loadProgramDetail(supabase: Client, programId: string) {
  const [program, reviews, entries] = await Promise.all([
    supabase
      .from("owner_programs")
      .select(
        "id, property_id, owner_user_id, owner_name, owner_email, status, started_on, ends_on, target_hours, onboarding_target_hours, ongoing_target_hours, properties(name, nickname, city, state)",
      )
      .eq("id", programId)
      .single(),
    supabase
      .from("owner_reviews")
      .select("id, phase, stage, title, recommendation, impact, decision_path, respond_by, status, owner_decision, ticket_id, sort_order")
      .eq("program_id", programId)
      .order("sort_order"),
    supabase
      .from("owner_time_entries")
      .select("id, phase, entry_date, minutes, activity, attested, review_id")
      .eq("program_id", programId)
      .order("entry_date", { ascending: false }),
  ]);
  if (program.error) throw program.error;
  if (reviews.error) throw reviews.error;
  if (entries.error) throw entries.error;

  const p = program.data;
  const prop = p.properties as unknown as { name: string; nickname: string | null; city: string | null; state: string | null } | null;

  return {
    program: {
      id: p.id,
      propertyId: p.property_id,
      propertyName: prop ? prop.nickname || prop.name : "Property",
      location: prop ? locationOf(prop) : "",
      ownerName: p.owner_name,
      ownerEmail: p.owner_email,
      ownerLinked: Boolean(p.owner_user_id),
      status: p.status as ProgramRow["status"],
      startedOn: p.started_on,
      endsOn: p.ends_on,
      targetHours: Number(p.target_hours),
      onboardingTargetHours: Number(p.onboarding_target_hours),
      ongoingTargetHours: Number(p.ongoing_target_hours),
    },
    reviews: reviews.data ?? [],
    entries: entries.data ?? [],
  };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 — read aloud safely

function newInviteCode() {
  const pick = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
  return `${pick()}-${pick()}`;
}

/** Issues a self-signup code the owner uses once, after closing. */
export async function createInvite(
  supabase: Client,
  userId: string,
  input: { programId: string; ownerEmail: string },
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    const { data, error } = await supabase
      .from("owner_invites")
      .insert({
        code,
        program_id: input.programId,
        owner_email: input.ownerEmail || null,
        created_by: userId,
      })
      .select("code, expires_at")
      .maybeSingle();
    if (!error && data) return { code: data.code, expiresAt: data.expires_at };
    // 23505 is a code collision; anything else is a real failure.
    if (error && error.code !== "23505") throw error;
  }
  throw new Error("Could not generate an invite code. Please try again.");
}

export async function loadInvites(supabase: Client, programId: string) {
  const { data, error } = await supabase
    .from("owner_invites")
    .select("id, code, owner_email, expires_at, redeemed_at")
    .eq("program_id", programId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
