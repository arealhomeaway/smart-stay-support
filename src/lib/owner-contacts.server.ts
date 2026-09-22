/**
 * The homeowner's ARHA contacts (server-only).
 *
 * The named escalation contacts come from the Welcome Packet and never change.
 * The day-to-day seats are resolved from the home's actual assignments, so a
 * homeowner sees the person really doing the work. Only a display name and a
 * role ever cross to the homeowner — no staff emails, ids or seat internals.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { contactPhaseFor, contactsFor, type ContactsView } from "./arha-contacts";
import { ownerPropertyAccess } from "./owner-property-access.server";

type Client = SupabaseClient<Database>;

const HANDED_OFF = new Set(["ready", "launching", "launched", "live"]);

async function displayNames(admin: Client, ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Map<string, string>();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", wanted);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const name = (row.full_name as string | null)?.trim();
    if (name) map.set(row.id as string, name);
  }
  return map;
}

async function seatHolder(admin: Client, code: string) {
  const { data, error } = await admin
    .from("functional_roles")
    .select("current_seat_holder")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();
  if (error) return null;
  return (data?.current_seat_holder as string | null) ?? null;
}

export async function loadOwnerContacts(
  supabase: Client,
  admin: Client,
  userId: string | null,
  programId: string | null,
): Promise<ContactsView | null> {
  if (!programId) return null;

  const program = await admin
    .from("owner_programs")
    .select("status, completed_at")
    .eq("id", programId)
    .maybeSingle();
  if (program.error) throw program.error;
  if (!program.data) return null;

  const links = await admin
    .from("owner_program_properties")
    .select("property_id, inclusion_status, launch_status, archived_at")
    .eq("program_id", programId);
  if (links.error) throw links.error;

  const included = (links.data ?? []).filter(
    (l) => l.inclusion_status === "included" && l.archived_at == null,
  );
  // Never describe a home the caller may not reach.
  const reachable = userId
    ? (
        await Promise.all(
          included.map(async (l) =>
            (await ownerPropertyAccess(admin, userId, l.property_id as string)) ? l : null,
          ),
        )
      ).filter((l): l is (typeof included)[number] => Boolean(l))
    : included;

  const handedOff =
    reachable.length > 0 &&
    reachable.every((l) => HANDED_OFF.has(String(l.launch_status ?? "").toLowerCase()));

  const phase = contactPhaseFor({
    completedAt: (program.data.completed_at as string | null) ?? null,
    status: String(program.data.status ?? ""),
    handedOff,
  });

  const projects = reachable.length
    ? await admin
        .from("onboarding_projects")
        .select("property_id, project_manager, director, utility_manager")
        .in(
          "property_id",
          reachable.map((l) => l.property_id as string),
        )
    : { data: [], error: null };
  if (projects.error) throw projects.error;

  const project = (projects.data ?? [])[0] ?? null;
  const [directorSeat, coordinatorSeat] = await Promise.all([
    seatHolder(admin, "director_onboarding"),
    seatHolder(admin, "po_day"),
  ]);

  const names = await displayNames(admin, [
    project?.project_manager as string | null,
    project?.utility_manager as string | null,
    (project?.director as string | null) ?? directorSeat,
    coordinatorSeat,
  ]);

  const directorId = (project?.director as string | null) ?? directorSeat;
  return contactsFor(phase, {
    projectManager: names.get(String(project?.project_manager ?? "")) ?? null,
    utilityManager: names.get(String(project?.utility_manager ?? "")) ?? null,
    propertyCoordinator: coordinatorSeat ? (names.get(coordinatorSeat) ?? null) : null,
    directorOfOnboarding: directorId ? (names.get(directorId) ?? null) : null,
  });
}
