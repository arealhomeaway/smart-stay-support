/** Change 5 of 5, item 1: shown on every page in the last 30 minutes of a shift. */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMyShift } from "@/components/home/MyShift";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { useCurrentUserId } from "@/hooks/useTeam";
import { bannerText, dueToday, laterKey, shiftEndSoon } from "@/lib/shift-end-reminder";
import { currentOwnerId } from "@/lib/matters";

export const MY_DUE_TICKET_FIELDS =
  "id, ref, title, priority, status, functional_role_code, import_hold, external_source, external_status, handoff_status, next_action, response_due_at, action_due_at, due_on, assigned_to, current_action_owner, record_owner, accountable_owner, pending_handoff_to";

/** My open tickets with a same-day due date (due_on is read only once it exists). */
export function useMyDueToday(userId: string | null, enabled: boolean) {
  const { demoMode } = useDemo();
  return useQuery({
    queryKey: ["my-due-today", userId, demoMode],
    enabled: Boolean(userId) && enabled,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const run = (fields: string) => supabase.from("tickets").select(fields).eq("is_demo", demoMode).is("archived_at", null)
        .not("status", "in", "(resolved,closed)")
        .or(`current_action_owner.eq.${userId},assigned_to.eq.${userId}`).limit(300);
      let r = await run(MY_DUE_TICKET_FIELDS);
      if (r.error) r = await run(MY_DUE_TICKET_FIELDS.replace(", due_on", ""));
      if (r.error) throw r.error;
      const rows = (r.data ?? []) as unknown as Array<Record<string, unknown> & { id: string; status: string }>;
      return rows.filter((t) => currentOwnerId(t as never) === userId && t["handoff_status"] !== "pending" && dueToday(t as never));
    },
  });
}

export function ShiftEndBanner() {
  const userId = useCurrentUserId();
  const role = useRole();
  const { demoMode } = useDemo();
  const shift = useMyShift(userId, role.roles.includes("tech"));
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id); }, []);
  const endIso = shift.data?.shift ? shiftEndSoon(shift.data.shift, now) : null;
  const due = useMyDueToday(userId, Boolean(endIso));
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    if (endIso && userId) setHidden(sessionStorage.getItem(laterKey(userId, endIso)));
  }, [endIso, userId]);
  const n = due.data?.length ?? 0;
  useEffect(() => {
    if (!endIso || !due.data) return;
    // Staged (shift-end-reminder): until approved the function is missing and this quietly does nothing.
    void supabase.rpc("notify_my_shift_end" as never, { _ends_at: endIso, _open_due: n, _demo: demoMode } as never);
  }, [endIso, due.data, n, demoMode]);
  if (!endIso || !userId || hidden || role.readOnly) return null;
  return (
    <div role="status" data-tour="shift-end-banner" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <p className="flex-1 font-medium">{bannerText(endIso, n)}</p>
      <Button asChild className="min-h-11"><Link to="/prepare-handoffs">Prepare handoffs</Link></Button>
      <Button variant="ghost" className="min-h-11" onClick={() => { sessionStorage.setItem(laterKey(userId, endIso), "1"); setHidden("1"); }}>Later</Button>
    </div>
  );
}
