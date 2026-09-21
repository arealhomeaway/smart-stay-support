import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { QueueBulkActions } from "@/components/QueueBulkActions";
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
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { currentOwnerId, queueSort } from "@/lib/matters";
import { MY_WORK_VIEWS, matchesMyWorkView, type MyWorkView } from "@/lib/my-work";
import { isBlocked } from "@/lib/team-queue";

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
    if (raw["view"] === "board") out.view = "board";
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
  view?: "board" | undefined;
};

function TicketsPage() {
  const navigate = Route.useNavigate();
  const params = Route.useSearch();
  const search = params.q ?? "";
  const requestedTab =
    params.tab === "mine" ? "active" : params.tab === "closed" ? "completed" : params.tab;
  const tab: MyWorkView = MY_WORK_VIEWS.some((view) => view.value === requestedTab)
    ? (requestedTab as MyWorkView)
    : "active";
  const view = params.view === "board" ? "board" : "list";
  const priority = params.priority ?? "all";
  const setParam = (patch: TicketQueueSearch) =>
    void navigate({
      search: (prev: TicketQueueSearch) => {
        const next: TicketQueueSearch = { ...prev, ...patch };
        if (!next.tab || next.tab === "active") delete next.tab;
        if (next.view !== "board") delete next.view;
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
  const { data: staff } = useStaffDirectory();

  const people = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s])), [staff]);

  const { data, isLoading, isError, refetch } = useQuery({
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
    for (const t of MY_WORK_VIEWS)
      c[t.value] = all.filter((x) => matchesMyWorkView(x, t.value, userId)).length;
    return c;
  }, [all, userId]);

  const tickets = all
    .filter((t) => matchesMyWorkView(t, tab, userId))
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
    .sort(
      tab === "completed"
        ? (a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? "")
        : queueSort,
    );

  // The queue the employee is actually looking at, remembered so a ticket can
  // be opened, worked and left without rebuilding this page.
  const { token, originSearch } = useWorkspaceOrigin(
    `My work · ${MY_WORK_VIEWS.find((x) => x.value === tab)?.label ?? "Active"}`,
    tickets.map((t) => ({
      id: t.id,
      label: t.title,
      sub: t.properties?.nickname ?? t.properties?.name ?? undefined,
    })),
  );
  void token;

  const activeTab = MY_WORK_VIEWS.find((t) => t.value === tab);

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
          options={MY_WORK_VIEWS.map((t) => ({
            value: t.value,
            label: t.label,
            count: counts[t.value] ?? 0,
          }))}
        />

        <SegmentedControl
          ariaLabel="Work layout"
          value={view}
          onChange={(value) => setParam({ view: value === "board" ? "board" : undefined })}
          options={[
            { value: "list", label: "List" },
            { value: "board", label: "Board" },
          ]}
        />

        <FilterPopover
          priority={priority}
          setPriority={setPriority}
          search={search}
          setSearch={setSearch}
        />
      </div>

      {isError ? (
        <EmptyState
          title="Your work could not be loaded."
          hint="Try again before relying on this queue."
          action={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      ) : isLoading ? (
        <LoadingRows rows={6} />
      ) : tickets.length === 0 ? (
        <EmptyState
          title={tab === "active" ? "You are clear." : "No tickets match this view."}
          hint={
            tab === "active"
              ? "Nothing is assigned to you right now — check the team queue for unassigned work."
              : "Try a different queue, priority or search term."
          }
        />
      ) : view === "board" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(["Needs action", "In progress", "Waiting or blocked"] as const).map((lane) => {
            const laneTickets = tickets.filter((ticket) => {
              if (tab === "completed") return lane === "In progress";
              if (
                ticket.status === "waiting" ||
                ticket.status === "awaiting_guest" ||
                isBlocked(ticket)
              )
                return lane === "Waiting or blocked";
              if (!ticket.acknowledged_at || !ticket.action_started_at || slaState(ticket).breached)
                return lane === "Needs action";
              return lane === "In progress";
            });
            return (
              <section key={lane} className="rounded-xl border bg-muted/20 p-3" aria-label={lane}>
                <h2 className="mb-3 text-sm font-semibold">
                  {lane} · {laneTickets.length}
                </h2>
                <div className="space-y-2">
                  {laneTickets.map((t) => (
                    <TicketWorkCard
                      key={t.id}
                      t={t}
                      ownerName={
                        currentOwnerId(t) ? displayName(people.get(currentOwnerId(t) ?? "")) : null
                      }
                      viewerId={userId}
                      originSearch={originSearch}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <Checkbox
                className="ml-1 shrink-0"
                aria-label={`Select ticket ${t.ref}`}
                checked={selected.includes(t.id)}
                onCheckedChange={() => toggle(t.id)}
              />
              <div className="min-w-0 flex-1">
                <TicketWorkCard
                  t={t}
                  ownerName={
                    currentOwnerId(t) ? displayName(people.get(currentOwnerId(t) ?? "")) : null
                  }
                  viewerId={userId}
                  originSearch={originSearch}
                />
              </div>
            </div>
          ))}
          <QueueBulkActions selected={selected} onClear={() => setSelected([])} />
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
  if (!t.acknowledged_at) return t.priority === "p1" ? "Review urgently" : "Review and act";
  if (t.handoff_status === "pending") return "Accept handoff";
  if (!t.action_started_at) return "Take next action";
  if (t.status === "waiting") return "Follow up";
  if (t.status === "awaiting_guest") return "Awaiting guest reply";
  if (t.status === "resolved") return "Confirm closure";
  return "Continue work";
}

function TicketWorkCard({
  t,
  ownerName,
  viewerId,
  originSearch,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  ownerName: string | null;
  viewerId: string | null;
  originSearch: { from: string };
}) {
  const sla = slaState(t);
  const live =
    sla.response?.met === false ? sla.response : sla.action?.met === false ? sla.action : null;
  const nextOwnerIsViewer = Boolean(viewerId && currentOwnerId(t) === viewerId);

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
          {sla.escalation && <Badge variant="danger">Escalated</Badge>}
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
          <span className="font-medium text-primary">
            {!nextOwnerIsViewer && t.pending_handoff_to !== viewerId
              ? "Track next step"
              : nextActionLabel(t)}
          </span>
          <span className="text-muted-foreground">·</span>
          {ownerName ? (
            <span className="text-foreground">
              {nextOwnerIsViewer ? "You own the next action" : `Next action owner: ${ownerName}`}
            </span>
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
