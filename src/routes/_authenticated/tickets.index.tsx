import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { useCurrentUserId, useStaffDirectory, displayName } from "@/hooks/useTeam";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlidersHorizontal } from "lucide-react";
import { Chip, EmptyState, LoadingRows, PageHeader, SegmentedControl } from "@/components/ui/page";
import { StatusBadge, ticketTone } from "@/components/ui/status";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { ownershipChip } from "@/lib/semantic";
import { usDate } from "@/lib/dates";

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
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
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
      {
        property: "og:description",
        content: "My work, team queue, unassigned and escalated tickets in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Queue tab, priority filter and search live in the URL: the workspace is
  // shareable, survives a reload, and is exactly what Back restores.
  validateSearch: (raw: Record<string, unknown>): TicketQueueSearch => {
    const out: TicketQueueSearch = {};
    if (typeof raw["tab"] === "string" && raw["tab"]) out.tab = raw["tab"];
    if (typeof raw["priority"] === "string" && raw["priority"]) out.priority = raw["priority"];
    if (typeof raw["q"] === "string" && raw["q"]) out.q = raw["q"];
    return out;
  },
  component: TicketsPage,
});

type TicketQueueSearch = {
  tab?: string | undefined;
  priority?: string | undefined;
  q?: string | undefined;
};

function TicketsPage() {
  const navigate = Route.useNavigate();
  const params = Route.useSearch();
  const search = params.q ?? "";
  const tab = (params.tab ?? "mine") as QueueTab;
  const priority = params.priority ?? "all";
  const setParam = (patch: TicketQueueSearch) =>
    void navigate({
      search: (prev: TicketQueueSearch) => {
        const next: TicketQueueSearch = { ...prev, ...patch };
        if (!next.tab || next.tab === "mine") delete next.tab;
        if (!next.priority || next.priority === "all") delete next.priority;
        if (!next.q) delete next.q;
        return next;
      },
      replace: true,
    });
  const setSearch = (v: string) => setParam({ q: v || undefined });
  const setTab = (v: string) => setParam({ tab: v });
  const setPriority = (v: string) => setParam({ priority: v });

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
    for (const t of QUEUE_TABS)
      c[t.value] = all.filter((x) => matchesTab(x, t.value, userId)).length;
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

  // The queue the employee is actually looking at, remembered so a ticket can
  // be opened, worked and left without rebuilding this page.
  const { token, originSearch } = useWorkspaceOrigin(
    tab === "mine" ? "My work" : (QUEUE_TABS.find((x) => x.value === tab)?.label ?? "Tickets"),
    tickets.map((t) => ({
      id: t.id,
      label: t.title,
      sub: t.properties?.nickname ?? t.properties?.name ?? undefined,
    })),
  );
  void token;

  const activeTab = QUEUE_TABS.find((t) => t.value === tab);
  // My work is exactly that: what this person is carrying, and what they have
  // finished. Everyone else's work lives in Team Queue; exceptions live in
  // Oversight. A coordinator should never have to filter their own day.
  const visibleTabs = QUEUE_TABS.filter(
    (t) => t.value === "mine" || t.value === "closed" || (t.supervisory && isSupervisor),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My work"
        description={activeTab?.hint}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/team-queue">Team Queue</Link>
            </Button>
            <Button asChild>
              <Link to="/tickets/new" search={{ origin: token }}>
                Report an issue
              </Link>
            </Button>
          </div>
        }
      />

      {demoMode && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          <span className="font-medium">Demo data.</span> These tickets are seeded examples. They
          are excluded from production analytics and never trigger emails, texts or integrations.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Ticket queue"
          value={tab}
          onChange={setTab}
          options={visibleTabs.map((t) => ({
            value: t.value,
            label: t.label,
            count: counts[t.value] ?? 0,
          }))}
        />

        <FilterPopover
          priority={priority}
          setPriority={setPriority}
          search={search}
          setSearch={setSearch}
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
          {tickets.map((t) => (
            <TicketWorkCard
              key={t.id}
              t={t}
              ownerName={
                currentOwnerId(t) ? displayName(people.get(currentOwnerId(t) ?? "")) : null
              }
              originSearch={originSearch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Consolidated priority + search behind one control, with a live summary. */
function FilterPopover({
  priority,
  setPriority,
  search,
  setSearch,
}: {
  priority: string;
  setPriority: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  const activeCount = (priority !== "all" ? 1 : 0) + (search.trim() ? 1 : 0);
  const summary = [
    priority !== "all" ? priority.toUpperCase() : null,
    search.trim() ? `"${search.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-2 sm:ml-auto">
      {summary && <span className="text-sm text-muted-foreground">{summary}</span>}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <SlidersHorizontal className="size-3.5" />
            Filter
            {activeCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 border-primary/40 bg-primary/10 text-primary"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Priority</p>
            <SegmentedControl
              ariaLabel="Filter by priority"
              value={priority}
              onChange={setPriority}
              options={["all", ...PRIORITIES.map((p) => p.value)].map((p) => ({
                value: p,
                label: p === "all" ? "All" : p.toUpperCase(),
              }))}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Search</p>
            <Input
              placeholder="Reference, title, guest, property, work type, owner…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tickets"
            />
          </div>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setPriority("all");
                setSearch("");
              }}
            >
              Clear filters
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** What should happen next, in plain English — the reason this card is here. */
function nextActionLabel(t: {
  status: string;
  priority: string;
  acknowledged_at: string | null;
  action_started_at: string | null;
  handoff_status?: string | null;
}) {
  if (!t.acknowledged_at) return t.priority === "p1" ? "Acknowledge now" : "Acknowledge";
  if (t.handoff_status === "pending") return "Accept handoff";
  if (!t.action_started_at) return "Start work";
  if (t.status === "waiting") return "Follow up";
  if (t.status === "awaiting_guest") return "Awaiting guest reply";
  if (t.status === "resolved") return "Confirm closure";
  return "Continue work";
}

function TicketWorkCard({
  t,
  ownerName,
  originSearch,
}: {
  t: any;
  ownerName: string | null;
  originSearch: { from: string };
}) {
  const sla = slaState(t);
  const live =
    sla.response?.met === false ? sla.response : sla.action?.met === false ? sla.action : null;

  return (
    <Link
      to="/tickets/$ticketId"
      params={{ ticketId: t.id }}
      search={originSearch}
      className="surface-row flex items-start gap-3 py-3 pl-4 pr-4"
    >
      <PropertyPhoto
        url={t.properties?.primary_photo_url}
        name={t.properties?.nickname ?? t.properties?.name}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="numeric text-xs text-muted-foreground">#{t.ref}</span>
          <span className="truncate font-medium">{t.title}</span>
          <Badge variant="outline" className={priorityTone(t.priority)}>
            {priorityMeta(t.priority).short}
          </Badge>
          <StatusBadge tone={ticketTone(t.status)}>{labelFor(STATUSES, t.status)}</StatusBadge>
          {sla.escalation && (
            <Badge variant="outline" className="border-danger/40 bg-danger/10 text-danger">
              Escalated
            </Badge>
          )}
          {t.is_demo && (
            <Badge variant="outline" className="border-warning/40 bg-warning/10">
              Demo
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.properties?.nickname ?? t.properties?.name ?? "No property"} ·{" "}
          {t.work_types?.name ?? t.category}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-medium text-primary">{nextActionLabel(t)}</span>
          <span className="text-muted-foreground">·</span>
          {ownerName ? (
            <span className="text-foreground">{ownerName}</span>
          ) : (
            <Chip className={ownershipChip("unassigned")}>Unassigned</Chip>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right text-sm text-muted-foreground">
        {live ? (
          <span className={"numeric " + (live.breached ? "font-medium text-danger" : "")}>
            {live.label}
          </span>
        ) : !OPEN_STATUSES.includes(t.status) && t.resolved_at ? (
          <span>Closed {usDate(t.resolved_at)}</span>
        ) : (
          <span>Reported {usDate(t.reported_at)}</span>
        )}
      </div>
    </Link>
  );
}
