/**
 * Shift handoffs data (Admin, Nov 16): read only, through the existing access rules, from the
 * coverage schedule (functional_roles, coverage_shifts, coverage_overrides), shift_end_records,
 * handoffs and tickets. One cache shared by the page, the Oversight menu count and Needs you now.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { OPEN_STATUSES } from "@/lib/tickets";
import { shiftHandoffsSince, type SHInput } from "@/lib/shift-handoffs";

async function loadShiftHandoffs(demo: boolean): Promise<SHInput> {
  const since = shiftHandoffsSince();
  const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const [roles, shifts, overrides, records, handoffs, tickets] = await Promise.all([
    supabase.from("functional_roles").select("code, name, current_seat_holder, active"),
    supabase.from("coverage_shifts").select("id, role_code, weekday, start_minute, end_minute, active"),
    supabase
      .from("coverage_overrides")
      .select("id, role_code, kind, user_id, starts_at, ends_at, note, created_at")
      .gte("ends_at", since)
      .lte("starts_at", tomorrow),
    supabase
      .from("shift_end_records")
      .select("id, user_id, kind, ended_at, nothing_to_hand_off, handoff_ids, is_demo")
      .eq("is_demo", demo)
      .gte("ended_at", since),
    supabase
      .from("handoffs")
      .select(
        "id, ticket_id, from_user, to_user, to_role_code, handoff_type, priority, actions_completed, current_status, next_action, due_at, status, responded_at, response_reason, accepted_at, created_at, is_demo, ticket:tickets(id, ref, title, priority, is_demo, functional_role_code)",
      )
      .or(`created_at.gte.${since},status.eq.pending`)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("tickets")
      .select("id, status, is_demo, archived_at, current_action_owner, assigned_to, record_owner, accountable_owner, external_source, external_status, reported_at, import_hold")
      .eq("is_demo", demo)
      .is("archived_at", null)
      .in("status", OPEN_STATUSES)
      .limit(5000),
  ]);
  const err = roles.error ?? shifts.error ?? overrides.error ?? records.error ?? handoffs.error ?? tickets.error;
  if (err) throw err;
  return {
    roles: roles.data ?? [],
    shifts: shifts.data ?? [],
    overrides: overrides.data ?? [],
    records: (records.data ?? []) as SHInput["records"],
    handoffs: (handoffs.data ?? []) as unknown as SHInput["handoffs"],
    tickets: (tickets.data ?? []) as SHInput["tickets"],
  };
}

/** Loads only for the Operations Supervisor, the Director of Operations and Admin. */
export function useShiftHandoffs() {
  const { demoMode } = useDemo();
  const { can } = useRole();
  const allowed = can("shift_handoffs");
  const q = useQuery({
    queryKey: ["shift-handoffs", demoMode],
    enabled: allowed,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: () => loadShiftHandoffs(demoMode),
  });
  return { ...q, allowed, demoMode };
}
