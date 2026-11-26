/**
 * Prepare handoffs (change 5 of 5, items 1 and 2): my open tickets due today, each with
 * "Hand off to [next person]" and a Hand off all. Uses the existing End my shift handoff
 * (end_my_shift), so the receiver sees it in Handoffs waiting for you and can Accept or
 * Decline, and each handoff adds an update on the ticket. The next person comes from
 * shift_handoff_defaults (coverage schedule, time off skipped).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { displayName, useCurrentUserId, useStaffDirectory } from "@/hooks/useTeam";
import { useMyShift } from "@/components/home/MyShift";
import { useMyDueToday } from "@/components/home/ShiftEndBanner";
import { defaultDue, defaultReceiver, handoffAt, myTeamToday, type HandoffDefault, type HandoffTicket } from "@/lib/my-shift";
import { priorityMeta } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/prepare-handoffs")({
  head: () => ({
    meta: [
      { title: "Prepare handoffs: Resolve" },
      { name: "description", content: "Hand off your open tickets due today before your shift ends." },
      { property: "og:title", content: "Prepare handoffs: Resolve" },
      { property: "og:description", content: "Hand off today's open tickets to the next person on shift." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrepareHandoffs,
});

type Draft = { done: string; next: string };

function PrepareHandoffs() {
  const userId = useCurrentUserId();
  const role = useRole();
  const { demoMode } = useDemo();
  const qc = useQueryClient();
  const { data: staff } = useStaffDirectory();
  const shift = useMyShift(userId, role.roles.includes("tech"));
  const at = useMemo(() => (shift.data?.shift ? handoffAt("end_of_shift", shift.data.shift) : new Date().toISOString()), [shift.data]);
  const myTeam = shift.data?.shift ? myTeamToday(shift.data.shift) : null;
  const due = useMyDueToday(userId, true);
  const defaults = useQuery({
    queryKey: ["shift-handoff-defaults", at],
    queryFn: async (): Promise<HandoffDefault[]> => {
      const { data, error } = await supabase.rpc("shift_handoff_defaults", { _at: at });
      if (error) throw error;
      return (data ?? []) as HandoffDefault[];
    },
  });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const rows = (due.data ?? []) as unknown as HandoffTicket[];
  useEffect(() => {
    setDrafts((p) => {
      const n = { ...p };
      for (const t of rows) n[t.id] ??= { done: "", next: t.next_action ?? "" };
      return n;
    });
  }, [due.data]);

  const nameOf = (id: string | null | undefined) => displayName((staff ?? []).find((p) => p.id === id) ?? null);
  const receiverOf = (t: HandoffTicket) => defaultReceiver(t, defaults.data ?? [], myTeam);
  const ok = (t: HandoffTicket) => Boolean(receiverOf(t)?.user_id && drafts[t.id]?.done.trim() && drafts[t.id]?.next.trim());

  const send = async (list: HandoffTicket[], key: string) => {
    setBusy(key);
    try {
      const items = list.map((t) => ({
        ticket_id: t.id,
        to_user: receiverOf(t)!.user_id,
        to_role: null,
        done: drafts[t.id]!.done.trim(),
        next_step: drafts[t.id]!.next.trim(),
        due_at: defaultDue(t) || new Date(Date.parse(at) + 3600_000).toISOString(),
      }));
      const { data, error } = await supabase.rpc("end_my_shift", { _kind: "end_of_shift", _at: at, _items: items as never, _nothing: false, _demo: demoMode });
      if (error) throw new Error(error.message);
      const n = Number((data as { handoffs?: number } | null)?.handoffs ?? 0);
      toast.success(`${n} handoff${n === 1 ? "" : "s"} sent`);
      await qc.invalidateQueries({ queryKey: ["my-due-today"] });
      await qc.invalidateQueries({ queryKey: ["home-my-work"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The handoff could not be sent.");
    } finally { setBusy(null); }
  };

  if (due.isPending || defaults.isPending) return <Skeleton className="h-64 w-full" />;
  const ready = rows.filter(ok);
  return (
    <div className="space-y-4" data-tour="prepare-handoffs">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Prepare handoffs</h1>
          <p className="text-sm text-muted-foreground">Your open tickets due today.</p>
        </div>
        <Button className="min-h-11" data-tour="hand-off-all" disabled={!rows.length || ready.length !== rows.length || busy !== null} onClick={() => void send(rows, "all")}>Hand off all</Button>
      </header>
      <SectionCard title={`Due today (${rows.length})`}>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due today. You can still use End my shift on Home.</p> : (
          <ul className="divide-y divide-border">
            {rows.map((t) => {
              const r = receiverOf(t);
              return (
                <li key={t.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{priorityMeta(t.priority).short}</span>
                    <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="font-medium hover:underline">{t.ref ? `#${t.ref} ` : ""}{t.title ?? "Ticket"}</Link>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <Input aria-label="Done so far" placeholder="Done so far" value={drafts[t.id]?.done ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: { ...d[t.id]!, done: e.target.value } }))} />
                    <Input aria-label="Next step" placeholder="Next step" value={drafts[t.id]?.next ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: { ...d[t.id]!, next: e.target.value } }))} />
                    <Button variant="outline" className="min-h-11" disabled={!ok(t) || busy !== null} onClick={() => void send([t], t.id)}>
                      {r?.user_id ? `Hand off to ${nameOf(r.user_id)}` : "Nobody else on shift"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
