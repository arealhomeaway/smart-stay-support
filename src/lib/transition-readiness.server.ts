import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isTestRecord } from "@/lib/test-data";
import { accessConfirmed } from "@/lib/onboarding-state";
import {
  homeItem,
  ownerItem,
  sortQueue,
  type HomeTransitionInput,
  type OwnerTransitionInput,
  type TransitionItem,
} from "@/lib/transition-readiness";

/** Homes still moving toward Operations. Accepted homes leave the queue. */
const IN_FLIGHT = ["onboarding", "paused", "handoff_requested", "handoff_corrections"];

export async function loadTransitionQueue(
  supabase: SupabaseClient<Database>,
): Promise<TransitionItem[]> {
  const [properties, programs] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, nickname, lifecycle_status, actual_access_on, actual_closing_on, is_demo")
      .in("lifecycle_status", IN_FLIGHT)
      .limit(300),
    supabase
      .from("owner_programs")
      .select("id, owner_name, owner_email, status, started_on, dfy_confirmed, is_demo")
      .is("archived_at", null)
      .neq("status", "complete")
      .limit(300),
  ]);
  if (properties.error) throw properties.error;
  if (programs.error) throw programs.error;

  const propertyIds = (properties.data ?? []).map((p) => p.id);
  const programIds = (programs.data ?? []).map((p) => p.id);

  const [projects, tasks, handoffs, links] = await Promise.all([
    propertyIds.length
      ? supabase
          .from("onboarding_projects")
          .select("property_id, status")
          .in("property_id", propertyIds)
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length
      ? supabase
          .from("onboarding_tasks")
          .select(
            "property_id, status, completed_at, requires_owner_approval, owner_approval_status",
          )
          .in("property_id", propertyIds)
          .is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length
      ? supabase
          .from("property_handoffs")
          .select(
            "property_id, gate_step, kati_decision, micah_decision, accepted_at, live_confirmed_at, requested_at",
          )
          .in("property_id", propertyIds)
          .is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
    programIds.length
      ? supabase
          .from("owner_program_properties")
          .select("program_id, property_id, inclusion_status, closing_confirmed, properties(name)")
          .in("program_id", programIds)
          .is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [projects, tasks, handoffs, links]) if (r.error) throw r.error;

  const items: TransitionItem[] = [];

  for (const p of properties.data ?? []) {
    const own = (tasks.data ?? []).filter((t) => t.property_id === p.id);
    const open = own.filter((t) => t.status !== "complete" && t.status !== "carryover");
    const handoffRows = (handoffs.data ?? [])
      .filter((h) => h.property_id === p.id)
      .sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)));
    const h = handoffRows[0] ?? null;
    const name = p.nickname?.trim() || p.name;
    const input: HomeTransitionInput = {
      propertyId: p.id,
      name,
      lifecycleStatus: p.lifecycle_status,
      accessConfirmed: accessConfirmed({
        id: p.id,
        name,
        lifecycle_status: p.lifecycle_status,
        actual_access_on: p.actual_access_on,
        actual_closing_on: p.actual_closing_on,
      }),
      openTasks: open.length,
      corrections: open.filter((t) => Boolean(t.completed_at)).length,
      openApprovals: open.filter(
        (t) => t.requires_owner_approval && t.owner_approval_status !== "approved",
      ).length,
      projectStarted: (projects.data ?? []).some(
        (pr) => pr.property_id === p.id && ["planning", "active"].includes(pr.status ?? ""),
      ),
      handoff: h
        ? {
            gateStep: h.gate_step,
            katiDecision: h.kati_decision,
            micahDecision: h.micah_decision,
            acceptedAt: h.accepted_at,
            liveConfirmedAt: h.live_confirmed_at,
          }
        : null,
      isTest: isTestRecord({ name: p.name, is_demo: p.is_demo }),
    };
    items.push(homeItem(input));
  }

  for (const g of programs.data ?? []) {
    const own = (links.data ?? []).filter((l) => l.program_id === g.id);
    const input: OwnerTransitionInput = {
      programId: g.id,
      ownerName: g.owner_name,
      ownerEmail: g.owner_email,
      status: g.status,
      startedOn: g.started_on,
      dfyConfirmed: g.dfy_confirmed,
      properties: own.map((l) => ({
        propertyId: l.property_id,
        name:
          (l.properties as unknown as { name?: string } | null)?.name ?? "Home",
        inclusionStatus: l.inclusion_status,
        closingConfirmed: l.closing_confirmed,
      })),
      isTest: isTestRecord({ name: g.owner_name ?? "", is_demo: g.is_demo }),
    };
    items.push(ownerItem(input));
  }

  return sortQueue(items);
}
