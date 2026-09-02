import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { useCurrentUserId, useStaffDirectory, displayName } from "@/hooks/useTeam";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, LoadingRows, PageHeader, PriorityRail, SegmentedControl } from "@/components/ui/page";
import { ownershipChip, stateChip, ticketState } from "@/lib/semantic";

import {
  OPEN_STATUSES,
  PRIORITIES,
  SOURCE_CHANNELS,
  STATUSES,
  labelFor,
  priorityMeta,
  priorityTone,
  relativeTime,
  slaState,
  statusTone,
} from "@/lib/tickets";
import { useRole } from "@/hooks/useRole";
import { QUEUE_TABS, currentOwnerId, matchesTab, queueSort, type QueueTab } from "@/lib/matters";

export const Route = createFileRoute("/_authenticated/tickets/")({
  head: () => ({
    meta: [
      { title: "Tickets queue — Resolve Operations" },
      {
        name: "description",
        content:
          "One searchable queue for every guest, owner and maintenance ticket across the A Real Home Away portfolio, with live response clocks.",
      },
      { property: "og:title", content: "Tickets queue — Resolve Operations" },
      { property: "og:description", content: "My work, team queue, unassigned and escalated tickets in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<QueueTab>("mine");
  const [priority, setPriority] = useState<string>("all");
  const { demoMode } = useDemo();
  const userId = useCurrentUserId();
  const { isSupervisor } = useRole();
  const { data: staff } = useStaffDirectory();

  const people = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s])), [staff]);

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, properties(name, nickname), work_types(name)")
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const all = data ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of QUEUE_TABS) c[t.value] = all.filter((x) => matchesTab(x, t.value, userId)).length;
    return c;
  }, [all, userId]);

  const tickets = all
    .filter((t) => matchesTab(t, tab, userId))
    .filter((t) => priority === "all" || t.priority === priority)
    .filter((t) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [
        t.ref,
        t.title,
        t.description,
        t.guest_name,
        t.properties?.name,
        t.properties?.nickname,
        t.work_types?.name,
        displayName(people.get(currentOwnerId(t) ?? "")),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    })
    .sort(queueSort);

  const activeTab = QUEUE_TABS.find((t) => t.value === tab);
  // The exception views belong to whoever oversees the work, not to the person
  // doing it — a coordinator should never have to filter their day.
  const visibleTabs = QUEUE_TABS.filter((t) => !t.supervisory || isSupervisor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets"
        description={activeTab?.hint}
        actions={
          <Button asChild>
            <Link to="/tickets/new">Log a ticket</Link>
          </Button>
        }
      />

      {demoMode && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          <span className="font-medium">Demo data.</span> These tickets are seeded examples. They are excluded from
          production analytics and never trigger emails, texts or integrations.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Ticket queue"
          value={tab}
          onChange={setTab}
          options={visibleTabs.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] ?? 0 }))}
        />

        <SegmentedControl
          ariaLabel="Filter by priority"
          value={priority}
          onChange={setPriority}
          options={["all", ...PRIORITIES.map((p) => p.value)].map((p) => ({
            value: p,
            label: p === "all" ? "All" : p.toUpperCase(),
          }))}
        />

        <Input
          placeholder="Search reference, title, guest, property, work type, owner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tickets"
          className="w-full max-w-sm sm:ml-auto sm:w-auto"
        />
      </div>


      {isLoading ? (
        <LoadingRows rows={6} />
      ) : tickets.length === 0 ? (
        <EmptyState
          title={tab === "mine" ? "You are clear." : "No tickets match this view."}
          hint={
            tab === "mine"
              ? "Nothing is assigned to you right now — check the team queue for unassigned work."
              : "Try a different queue, priority or search term."
          }
        />
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const sla = slaState(t);
            const live = sla.response?.met === false ? sla.response : sla.action?.met === false ? sla.action : null;
            const ownerId = currentOwnerId(t);
            return (
              <Link
                key={t.id}
                to="/tickets/$ticketId"
                params={{ ticketId: t.id }}
                className="surface-row relative block py-3 pl-5 pr-4"
              >
                <PriorityRail priority={t.priority} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="numeric text-xs text-muted-foreground">#{t.ref}</span>
                  <span className="font-medium">{t.title}</span>
                  <Badge variant="outline" className={priorityTone(t.priority)}>
                    {priorityMeta(t.priority).short}
                  </Badge>
                  <Chip className={stateChip(ticketState(t.status))}>
                    {labelFor(STATUSES, t.status)}
                  </Chip>
                  {sla.escalation && (
                    <Badge variant="outline" className="border-danger/40 bg-danger/10 text-danger">
                      Escalated
                    </Badge>
                  )}
                  {t.handoff_status === "pending" && (
                    <Badge variant="outline" className="border-info/40 bg-info/10 text-info">
                      Handoff pending
                    </Badge>
                  )}
                  {t.is_demo && (
                    <Badge variant="outline" className="border-warning/40 bg-warning/10">
                      Demo
                    </Badge>
                  )}
                  <span className="numeric ml-auto text-sm text-muted-foreground">
                    {live ? (
                      <span className={live.breached ? "font-medium text-danger" : ""}>{live.label}</span>
                    ) : (
                      relativeTime(t.reported_at)
                    )}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t.properties?.nickname ?? t.properties?.name ?? "No property"} ·{" "}
                  {t.work_types?.name ?? t.category} ·{" "}
                  {ownerId ? (
                    <span className="font-medium text-foreground">{displayName(people.get(ownerId))}</span>
                  ) : (
                    <Chip className={ownershipChip("unassigned")}>Unassigned</Chip>
                  )}
                  {" · "}
                  {labelFor(SOURCE_CHANNELS, t.source_channel)}
                  {t.guest_name ? ` · Guest: ${t.guest_name}` : ""}
                  {!OPEN_STATUSES.includes(t.status) && t.resolved_at
                    ? ` · closed ${relativeTime(t.resolved_at)}`
                    : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

