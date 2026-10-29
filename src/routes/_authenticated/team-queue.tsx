import { formatPropertyLabel } from "@/lib/property-label";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { useCurrentUserId, useStaffDirectory, displayName } from "@/hooks/useTeam";
import { useHomeTeams, HOME_TEAM_SHORT } from "@/hooks/useHomeTeam";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { QueueBulkActions } from "@/components/QueueBulkActions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlidersHorizontal } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { jobMap } from "@/lib/geo.functions";
import { activeMapCount, directionsUrl, type MapPin } from "@/lib/geo";
import { JobMap, type MapViewport } from "@/components/JobMap";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { WorkOrderRow } from "@/lib/work-order-types";
import { standaloneOperationsOrders } from "@/lib/operations-population";
import { operationsCalendarDays, operationsCalendarMonth, operationsView, parseOperationsSearch, shiftOperationsMonth, withOperationsView } from "@/lib/operations-view-state";
import { Chip, EmptyState, LoadingRows, PageHeader } from "@/components/ui/page";
import { StatusBadge, ticketTone } from "@/components/ui/status";
import { Skeleton } from "@/components/ui/skeleton";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { ownershipChip } from "@/lib/semantic";
import { usDate } from "@/lib/dates";
import {
  PRIORITIES,
  OPEN_STATUSES,
  STATUSES,
  labelFor,
  priorityMeta,
  priorityTone,
  relativeTime,
  slaState,
} from "@/lib/tickets";
import { currentOwnerId, queueSort } from "@/lib/matters";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { DepartureReviewQueue } from "@/components/departure/DepartureReviewQueue";
import { DepartureMatchingPanel } from "@/components/departure/DepartureMatchingPanel";
import {
  AGE_OPTIONS,
  DEFAULT_TEAM_QUEUE_FILTERS,
  HOME_TEAM_OPTIONS,
  activeFilterCount,
  applyTeamQueueFilters,
  effectiveOperationsPriority,
  isBlocked,
  isEscalated,
  type TeamQueueFilters,
} from "@/lib/team-queue";

export const Route = createFileRoute("/_authenticated/team-queue")({
  head: () => ({
    meta: [
      { title: "Team Queue — Resolve Operations" },
      {
        name: "description",
        content:
          "Every active Operations ticket across A Real Home Away in one shared queue, filtered by owner, home team, priority, property, age and status.",
      },
      { property: "og:title", content: "Team Queue — Resolve Operations" },
      {
        property: "og:description",
        content:
          "The shared Operations queue: who is carrying what, what is unassigned, what is waiting and what is overdue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: parseOperationsSearch,
  component: TeamQueuePage,
});

function TeamQueuePage() {
  const navigate = Route.useNavigate();
  const params = Route.useSearch();
  const { demoMode } = useDemo();
  const userId = useCurrentUserId();
  const { data: staff } = useStaffDirectory();
  const { homeTeamOf } = useHomeTeams();
  const { can, isLoading: rolesLoading } = useRole();
  const operationsAccess = can("work_orders_internal");
  const lens = params["lens"] === "mine" ? "mine" : "team";
  const view = operationsView(params);
  const loadMap = useServerFn(jobMap);
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const preferred = window.localStorage.getItem("preferred-theme") === "dark";
    document.documentElement.classList.toggle("dark", preferred);
    setDarkMode(preferred);
  }, []);
  const toggleDarkMode = () => {
    const next = !darkMode;
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("preferred-theme", next ? "dark" : "light");
    setDarkMode(next);
  };
  const map = useQuery({
    queryKey: ["job-map", view],
    queryFn: () => loadMap(),
    enabled: operationsAccess && view === "map",
  });

  // Tickets picked for a batch change from this queue.
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);

  const flagParam = params["flags"] ?? "";
  const sortParam = params["sort"] ?? "priority";
  const flags = useMemo(() => new Set(flagParam.split(",").filter(Boolean)), [flagParam]);
  const filters: TeamQueueFilters = useMemo(() => ({
    ...DEFAULT_TEAM_QUEUE_FILTERS,
    assignee: params["assignee"] ?? "all",
    homeTeam: params["homeTeam"] ?? "all",
    priority: params["priority"] ?? "all",
    status: params["status"] ?? "active",
    property: params["property"] ?? "all",
    market: params["market"] ?? "all",
    city: params["city"] ?? "all",
    state: params["state"] ?? "all",
    workType: params["workType"] ?? "all",
    kind: params["kind"] ?? "all",
    vendor: params["vendor"] ?? "all",
    dispatch: params["dispatch"] ?? "all",
    acceptance: params["acceptance"] ?? "all",
    completion: params["completion"] ?? "all",
    dateFrom: params["dateFrom"] ?? "",
    dateTo: params["dateTo"] ?? "",
    scheduled: flags.has("scheduled"),
    due: params["due"] ?? "all",
    age: params["age"] ?? "all",
    waiting: flags.has("waiting"),
    untouched: flags.has("untouched"),
    unassigned: flags.has("unassigned"),
    escalated: flags.has("escalated"),
    blocked: flags.has("blocked"),
    overdue: flags.has("overdue"),
    q: params["q"] ?? "",
  }), [params, flags]);

  const setParam = (patch: Record<string, string | undefined>, replace = false) =>
    void navigate({
      search: (prev: Record<string, string | undefined>) => {
        const next = { ...prev, ...patch };
        for (const [k, v] of Object.entries(next)) if (!v) delete next[k];
        return next;
      },
      replace,
    });

  const toggleFlag = (flag: string) => {
    const nextFlags = new Set(flags);
    if (nextFlags.has(flag)) nextFlags.delete(flag);
    else nextFlags.add(flag);
    setParam({
      flags: [...nextFlags].join(",") || undefined,
    });
  };

  const people = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s])), [staff]);
  const orders = useQuery({
    queryKey: ["operations-map-work-orders", demoMode],
    enabled: operationsAccess,
    queryFn: async () => {
      const { data, error } = await supabase.from("work_orders").select("*").eq("is_demo", demoMode);
      if (error) throw error;
      return data as WorkOrderRow[];
    },
  });
  const dispatches = useQuery({
    queryKey: ["operations-map-dispatch", demoMode],
    enabled: operationsAccess,
    queryFn: async () => {
      const { data, error } = await supabase.from("breezeway_outbound_tasks")
        .select("ticket_id, work_order_id, status, last_synced_at");
      if (error) throw error;
      return data;
    },
  });
  const propertyCatalog = useQuery({
    queryKey: ["operations-property-catalog", demoMode],
    enabled: operationsAccess,
    queryFn: async () => {
      const { data, error } = await supabase.from("properties")
        .select("id, name, nickname, market, city, state, address_line1, unit, postal_code, ownerrez_property_id")
        .eq("active", true).eq("is_demo", demoMode).is("archived_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["team-queue", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, properties(name, nickname, market, city, state, address_line1, unit, postal_code, ownerrez_property_id), work_types(name)")
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const all = useMemo(() => {
    const byTicket = new Map((orders.data ?? []).filter((o) => o.ticket_id).map((o) => [o.ticket_id, o]));
    const byDispatch = new Map((dispatches.data ?? []).filter((d) => d.ticket_id).map((d) => [d.ticket_id, d]));
    for (const row of dispatches.data ?? []) {
      if (!row.ticket_id && row.work_order_id) {
        const linked = (orders.data ?? []).find((order) => order.id === row.work_order_id);
        if (linked?.ticket_id) byDispatch.set(linked.ticket_id, row);
      }
    }
    return (data ?? []).map((ticket) => ({
      ...ticket,
      workOrder: byTicket.get(ticket.id) ?? null,
      dispatchState: byDispatch.get(ticket.id)?.status ?? null,
      dispatchSyncedAt: byDispatch.get(ticket.id)?.last_synced_at ?? null,
    }));
  }, [data, orders.data, dispatches.data]);
  const tickets = useMemo(
    () =>
      (applyTeamQueueFilters(
        (lens === "mine" ? all.filter((ticket) => currentOwnerId(ticket) === userId) : all) as never,
        filters,
        homeTeamOf,
      ) as unknown as typeof all).sort((a, b) => {
        if (sortParam === "due") {
          return (a.next_action_due_at ?? a.action_due_at ?? a.response_due_at ?? "9999")
            .localeCompare(b.next_action_due_at ?? b.action_due_at ?? b.response_due_at ?? "9999");
        }
        if (sortParam === "newest") return (b.reported_at ?? "").localeCompare(a.reported_at ?? "");
        const priorityOrder = { p1: 0, p2: 1, p3: 2 } as Record<string, number>;
        const priorityGap = (priorityOrder[effectiveOperationsPriority(a)] ?? 3) - (priorityOrder[effectiveOperationsPriority(b)] ?? 3);
        if (priorityGap) return priorityGap;
        return queueSort(a as never, b as never);
      }),
    [all, filters, homeTeamOf, lens, userId, sortParam],
  );

  const standaloneOrders = useMemo(() => {
    const activeTicketIds = new Set(all.filter((ticket) => OPEN_STATUSES.includes(ticket.status)).map((ticket) => ticket.id));
    const rows = standaloneOperationsOrders(orders.data ?? [], propertyCatalog.data ?? [], dispatches.data ?? [], activeTicketIds);
    const scoped = lens === "mine" ? rows.filter((row) => row.assigned_to === userId) : rows;
    return (applyTeamQueueFilters(scoped, filters, homeTeamOf) as typeof rows).sort((a, b) => {
      if (sortParam === "due") return (a.next_action_due_at ?? "9999").localeCompare(b.next_action_due_at ?? "9999");
      if (sortParam === "newest") return (b.reported_at ?? "").localeCompare(a.reported_at ?? "");
      const priorityOrder = { p1: 0, p2: 1, p3: 2 } as Record<string, number>;
      const priorityGap = (priorityOrder[effectiveOperationsPriority(a)] ?? 3) - (priorityOrder[effectiveOperationsPriority(b)] ?? 3);
      if (priorityGap) return priorityGap;
      return queueSort(a as never, b as never);
    });
  }, [orders.data, propertyCatalog.data, dispatches.data, all, filters, homeTeamOf, lens, userId, sortParam]);

  const mapPins = useMemo(() => {
    const byProperty = new Map<string, Array<(typeof tickets)[number] | (typeof standaloneOrders)[number]>>();
    for (const ticket of [...tickets, ...standaloneOrders]) {
      if (!ticket.property_id) continue;
      byProperty.set(ticket.property_id, [...(byProperty.get(ticket.property_id) ?? []), ticket]);
    }
    return (map.data?.pins ?? []).filter((pin) => {
      if (lens === "mine" && !byProperty.has(pin.propertyId)) return false;
      if (filters.property !== "all" && pin.propertyId !== filters.property) return false;
      if (filters.market !== "all" && pin.market !== filters.market) return false;
      if (filters.city !== "all" && pin.city !== filters.city) return false;
      if (filters.state !== "all" && pin.state !== filters.state) return false;
      return activeFilterCount(filters) === 0 || byProperty.has(pin.propertyId);
    }).map((pin): MapPin => ({
      ...pin,
      openJobs: (byProperty.get(pin.propertyId) ?? []).map((ticket) => ({
        id: ticket.id,
        ticketId: "kind" in ticket ? null : ticket.id,
        ref: ticket.ref ?? null,
        title: ticket.title ?? "Untitled work",
        priority: effectiveOperationsPriority(ticket),
        status: ticket.status,
        dueAt: ticket.next_action_due_at ?? ("action_due_at" in ticket ? ticket.action_due_at : null) ?? ("response_due_at" in ticket ? ticket.response_due_at : null) ?? ("due_at" in ticket ? ticket.due_at : null) ?? null,
        vendorName: ticket.workOrder?.vendor_name ?? ticket.vendor_name ?? null,
        vendorStatus: ticket.vendor_status ?? null,
        workOrderId: ticket.workOrder?.id ?? null,
        assigneeId: currentOwnerId(ticket),
        team: homeTeamOf(currentOwnerId(ticket)),
        waitingOn: "waiting_on" in ticket ? ticket.waiting_on : null,
        escalated: "kind" in ticket ? false : isEscalated(ticket),
        slaBreached: "kind" in ticket ? false : slaState(ticket).breached,
        dispatchState: ticket.dispatchState,
        dispatchSyncedAt: ticket.dispatchSyncedAt,
        acceptanceState: ticket.workOrder?.vendor_acknowledged_at ? "Accepted" : "Pending",
        completionState: ticket.workOrder?.vendor_completed_at ? "Reported complete" : "Pending",
      })),
    }));
  }, [map.data, tickets, standaloneOrders, filters, homeTeamOf, lens]);
  const selectedPin = mapPins.find((pin) => pin.propertyId === params["pin"]) ?? null;
  const viewItems = [...tickets, ...standaloneOrders];
  const calendarMonth = operationsCalendarMonth(params["month"]);
  const itemDate = (item: { next_action_due_at?: string | null; action_due_at?: string | null; response_due_at?: string | null; due_at?: string | null; workOrder?: { scheduled_for: string | null } | null }) =>
    (item.next_action_due_at ?? item.action_due_at ?? item.response_due_at ?? item.due_at ?? item.workOrder?.scheduled_for)?.slice(0, 10) ?? "Unscheduled";
  const mapViewport: MapViewport | null =
    Number.isFinite(Number(params["lat"])) && Number.isFinite(Number(params["lng"])) &&
    Number.isFinite(Number(params["zoom"])) && params["lat"] && params["lng"] && params["zoom"]
      ? { lat: Number(params["lat"]), lng: Number(params["lng"]), zoom: Number(params["zoom"]) }
      : null;

  const properties = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of propertyCatalog.data ?? []) map.set(property.id, formatPropertyLabel(property).primary);
    for (const t of all)
      if (t.property_id)
        map.set(t.property_id, formatPropertyLabel(t.properties).primary);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all, propertyCatalog.data]);

  const markets = useMemo(
    () =>
      [
        ...new Set(
          [...all.map((t) => t.properties?.market), ...(propertyCatalog.data ?? []).map((p) => p.market)].filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [all, propertyCatalog.data],
  );
  const cities = useMemo(
    () =>
      [
        ...new Set(
          [...all.map((t) => t.properties?.city), ...(propertyCatalog.data ?? []).map((p) => p.city)].filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [all, propertyCatalog.data],
  );
  const states = useMemo(
    () =>
      [
        ...new Set(
          [...all.map((t) => t.properties?.state), ...(propertyCatalog.data ?? []).map((p) => p.state)].filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [all, propertyCatalog.data],
  );
  const workTypes = useMemo(() => {
    const types = new Map<string, string>();
    for (const ticket of all)
      if (ticket.work_type_id && ticket.work_types?.name)
        types.set(ticket.work_type_id, ticket.work_types.name);
    for (const order of standaloneOrders)
      if (order.work_type_id) types.set(order.work_type_id, order.work_type_id);
    return [...types.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all, standaloneOrders]);
  const vendors = useMemo(() => [...new Set([...all.map((ticket) => ticket.workOrder?.vendor_name ?? ticket.vendor_name), ...standaloneOrders.map((order) => order.vendor_name)].filter((name): name is string => Boolean(name)))].sort(), [all, standaloneOrders]);
  const dispatchStates = useMemo(() => [...new Set((dispatches.data ?? []).map((row) => row.status))].sort(), [dispatches.data]);

  const owners = useMemo(() => {
    const ids = new Set<string>();
    for (const t of all) {
      const id = currentOwnerId(t);
      if (id) ids.add(id);
    }
    for (const order of standaloneOrders) if (order.assigned_to) ids.add(order.assigned_to);
    return [...ids]
      .map((id) => ({ id, name: displayName(people.get(id)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all, standaloneOrders, people]);

  const { originSearch } = useWorkspaceOrigin(
    "Team Queue",
    tickets.map((t) => ({
      id: t.id,
      label: t.title,
      sub: formatPropertyLabel(t.properties).primary,
    })),
  );

  const filterCount = activeFilterCount(filters);

  const flagButtons: { key: string; label: string; count: number }[] = useMemo(() => {
    const active = [...all, ...standaloneOrders].filter((t) => !["resolved", "closed"].includes(t.status));
    return [
      {
        key: "untouched",
        label: "Untouched",
        count: active.filter((t) => !t.acknowledged_at && !t.action_started_at).length,
      },
      {
        key: "unassigned",
        label: "Unassigned",
        count: active.filter((t) => !currentOwnerId(t)).length,
      },
      {
        key: "waiting",
        label: "Waiting",
        count: active.filter((t) => t.status === "waiting").length,
      },
      {
        key: "blocked",
        label: "Blocked",
        count: active.filter((t) => isBlocked(t as never)).length,
      },
      {
        key: "escalated",
        label: "Escalated",
        count: active.filter((t) => isEscalated(t as never)).length,
      },
      {
        key: "overdue",
        label: "Overdue",
        count: active.filter((t) => slaState(t).breached).length,
      },
    ];
  }, [all, standaloneOrders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Queue"
        description="Every active ticket the team is carrying. Coverage overlaps all day, so this is open to everyone — pick up what needs picking up."
        actions={
          filterCount > 0 ? (
            <Button
              variant="outline"
              onClick={() =>
                setParam({
                  assignee: undefined,
                  homeTeam: undefined,
                  priority: undefined,
                  status: undefined,
                  property: undefined,
                  market: undefined,
                  city: undefined,
                  state: undefined,
                  workType: undefined,
                  kind: undefined,
                  vendor: undefined,
                  dispatch: undefined,
                  acceptance: undefined,
                  completion: undefined,
                  dateFrom: undefined,
                  dateTo: undefined,
                  due: undefined,
                  age: undefined,
                  flags: undefined,
                  q: undefined,
                })
              }
            >
              Clear {filterCount} filter{filterCount === 1 ? "" : "s"}
            </Button>
          ) : null
        }
      />

      {demoMode && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          <span className="font-medium">Demo data.</span> These tickets are seeded examples and
          never trigger emails, texts or integrations.
        </div>
      )}

      <DepartureReviewQueue />
      <DepartureMatchingPanel />

      <nav aria-label="Operations work views" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
        {(["list", "kanban", "map", "calendar"] as const).map((option) => (
          <Button key={option} size="sm" variant={view === option ? "default" : "ghost"}
            aria-current={view === option ? "page" : undefined}
            disabled={!operationsAccess && option !== "list"}
            onClick={() => void navigate({ search: withOperationsView(params, option) })}>
            {{ list: "List", kanban: "Kanban", map: "Work Map", calendar: "Calendar" }[option]}
          </Button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Button size="sm" variant={lens === "team" ? "secondary" : "ghost"}
          onClick={() => setParam({ lens: undefined })}>Team Queue</Button>
        <Button size="sm" variant={lens === "mine" ? "secondary" : "ghost"}
          onClick={() => setParam({ lens: "mine" })}>My Work</Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Sort
          <select aria-label="Sort Operations work" className="rounded border border-input bg-background px-2 py-1.5 text-foreground"
            value={params["sort"] ?? "priority"}
            onChange={(event) => setParam({ sort: event.target.value === "priority" ? undefined : event.target.value })}>
            <option value="priority">Priority</option><option value="due">Due</option><option value="newest">Newest</option>
          </select>
        </label>
        <Button size="sm" variant="outline" onClick={toggleDarkMode} aria-label={darkMode ? "Use light mode" : "Use dark mode"}>
          {darkMode ? "Light mode" : "Dark mode"}
        </Button>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        {flagButtons.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={flags.has(f.key) ? "default" : "outline"}
            onClick={() => toggleFlag(f.key)}
            aria-pressed={flags.has(f.key)}
          >
            {f.label}
            <span className="numeric ml-1.5 opacity-70">{f.count}</span>
          </Button>
        ))}
        <Button size="sm" variant={filters.scheduled ? "default" : "outline"}
          aria-pressed={filters.scheduled} onClick={() => toggleFlag("scheduled")}>Scheduled</Button>
        <Button
          size="sm"
          variant={filters.status === "closed" ? "default" : "outline"}
          aria-pressed={filters.status === "closed"}
          onClick={() =>
            setParam({
              status: filters.status === "closed" ? undefined : "closed",
            })
          }
        >
          Closed
        </Button>
        <Button
          size="sm"
          variant={lens === "mine" ? "default" : "outline"}
          onClick={() =>
            setParam({ lens: lens === "mine" ? undefined : "mine" })
          }
        >
          Only mine
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {filterCount > 0
            ? `${filterCount} filter${filterCount === 1 ? "" : "s"} active`
            : "Showing active work"}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="size-3.5" />
              Filter
              {filterCount > 0 && (
                <Badge
                  variant="outline"
                  className="ml-1 border-primary/40 bg-primary/10 text-primary"
                >
                  {filterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-[75vh] w-[min(28rem,calc(100vw-2rem))] space-y-3 overflow-y-auto">
            <div className="grid gap-2 sm:grid-cols-2">
              <FilterSelect
                label="Owner"
                value={filters.assignee}
                onChange={(v) => setParam({ assignee: v === "all" ? undefined : v })}
                options={[
                  { value: "all", label: "Anyone" },
                  { value: "unassigned", label: "Unassigned" },
                  ...owners.map((o) => ({ value: o.id, label: o.name })),
                ]}
              />
              <FilterSelect
                label="Home team"
                value={filters.homeTeam}
                onChange={(v) => setParam({ homeTeam: v === "all" ? undefined : v })}
                options={HOME_TEAM_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <FilterSelect
                label="Priority"
                value={filters.priority}
                onChange={(v) => setParam({ priority: v === "all" ? undefined : v })}
                options={[
                  { value: "all", label: "Any priority" },
                  ...PRIORITIES.map((p) => ({ value: p.value, label: p.value.toUpperCase() })),
                ]}
              />
              <FilterSelect
                label="Status"
                value={filters.status}
                onChange={(v) => setParam({ status: v === "active" ? undefined : v })}
                options={[
                  { value: "active", label: "Active work" },
                  { value: "all", label: "Everything" },
                  ...STATUSES.map((s) => ({ value: s.value, label: s.label })),
                ]}
              />
              <FilterSelect
                label="Property"
                value={filters.property}
                onChange={(v) => setParam({ property: v === "all" ? undefined : v })}
                options={[
                  { value: "all", label: "Any property" },
                  ...properties.map(([id, name]) => ({ value: id, label: name })),
                ]}
              />
              <FilterSelect
                label="Age"
                value={filters.age}
                onChange={(v) => setParam({ age: v === "all" ? undefined : v })}
                options={AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <FilterSelect
                label="Market"
                value={filters.market}
                onChange={(v) => setParam({ market: v === "all" ? undefined : v })}
                options={[
                  { value: "all", label: "Any market" },
                  ...markets.map((market) => ({ value: market, label: market })),
                ]}
              />
              <FilterSelect
                label="Work type"
                value={filters.workType}
                onChange={(v) => setParam({ workType: v === "all" ? undefined : v })}
                options={[
                  { value: "all", label: "Any type" },
                  ...workTypes.map(([value, label]) => ({ value, label })),
                ]}
              />
              <FilterSelect label="Record type" value={filters.kind}
                onChange={(v) => setParam({ kind: v === "all" ? undefined : v })}
                options={[{ value: "all", label: "Tickets and Work Orders" }, { value: "ticket", label: "Tickets" }, { value: "work_order", label: "Work Orders without active Ticket" }]} />
              <FilterSelect label="Vendor" value={filters.vendor}
                onChange={(v) => setParam({ vendor: v === "all" ? undefined : v })}
                options={[{ value: "all", label: "Any vendor" }, ...vendors.map((vendor) => ({ value: vendor, label: vendor }))]} />
              <FilterSelect label="Dispatch state" value={filters.dispatch}
                onChange={(v) => setParam({ dispatch: v === "all" ? undefined : v })}
                options={[{ value: "all", label: "Any dispatch" }, { value: "not_sent", label: "Not sent" }, ...dispatchStates.map((state) => ({ value: state, label: state }))]} />
              <FilterSelect label="Acceptance" value={filters.acceptance}
                onChange={(v) => setParam({ acceptance: v === "all" ? undefined : v })}
                options={[{ value: "all", label: "Any acceptance" }, { value: "accepted", label: "Accepted" }, { value: "pending", label: "Pending" }]} />
              <FilterSelect label="Completion" value={filters.completion}
                onChange={(v) => setParam({ completion: v === "all" ? undefined : v })}
                options={[{ value: "all", label: "Any completion" }, { value: "complete", label: "Reported complete" }, { value: "pending", label: "Pending" }]} />
              <FilterSelect
                label="City"
                value={filters.city}
                onChange={(v) => setParam({ city: v === "all" ? undefined : v })}
                options={[
                  { value: "all", label: "Any city" },
                  ...cities.map((city) => ({ value: city, label: city })),
                ]}
              />
              <FilterSelect
                label="State"
                value={filters.state}
                onChange={(v) => setParam({ state: v === "all" ? undefined : v })}
                options={[
                  { value: "all", label: "Any state" },
                  ...states.map((state) => ({ value: state, label: state })),
                ]}
              />
              <FilterSelect
                label="Next due"
                value={filters.due}
                onChange={(v) => setParam({ due: v === "all" ? undefined : v })}
                options={[
                  { value: "all", label: "Any date" },
                  { value: "overdue", label: "Overdue" },
                  { value: "today", label: "Today" },
                  { value: "next7", label: "Next 7 days" },
                  { value: "unscheduled", label: "No date" },
                ]}
              />
              <label className="space-y-1 text-xs font-medium">From date
                <Input type="date" value={filters.dateFrom} onChange={(event) => setParam({ dateFrom: event.target.value || undefined }, true)} />
              </label>
              <label className="space-y-1 text-xs font-medium">Through date
                <Input type="date" value={filters.dateTo} onChange={(event) => setParam({ dateTo: event.target.value || undefined }, true)} />
              </label>
            </div>
            <Input
              placeholder="Search reference, title, guest…"
              value={filters.q}
              onChange={(e) => setParam({ q: e.target.value || undefined }, true)}
              aria-label="Search the team queue"
            />
          </PopoverContent>
        </Popover>
      </div>

      {isError || (operationsAccess && (orders.isError || dispatches.isError || propertyCatalog.isError)) ? (
        <EmptyState
          title="The queue could not be loaded."
          hint="This is usually a connection hiccup."
          action={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      ) : isLoading || (operationsAccess && (orders.isLoading || dispatches.isLoading || propertyCatalog.isLoading)) ? (
        <LoadingRows rows={6} />
      ) : view === "map" ? (
        !operationsAccess && !rolesLoading ? <EmptyState title="Operations access required" hint="This view is for Operations staff and leadership." />
        : map.isError ? <EmptyState title="The map could not be loaded" hint="Check the connection and try again."
            action={<Button onClick={() => void map.refetch()}>Try again</Button>} />
        : map.isLoading ? <Skeleton className="h-[min(70vh,720px)] min-h-[420px] w-full" />
        : <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {mapPins.length} geocoded properties · {mapPins.reduce((total, pin) => total + activeMapCount(pin), 0)} active issues shown
              {(map.data?.unpinned ?? 0) > 0 ? ` · ${map.data?.unpinned} properties need coordinate review` : ""}
            </p>
            {mapPins.length ? <JobMap pins={mapPins} selectedPropertyId={selectedPin?.propertyId ?? null}
              viewport={mapViewport}
              onViewportChange={(next) => setParam({ lat: next.lat.toFixed(5), lng: next.lng.toFixed(5), zoom: String(next.zoom) }, true)}
              onSelect={(pin) => setParam({ pin: pin.propertyId })} />
            : <EmptyState title="No properties match these filters" hint="Clear a filter or choose a wider date range." />}
            {(map.data?.unpinned ?? 0) > 0 && <p className="text-xs text-muted-foreground">
              Missing or invalid coordinates are excluded from the map. Ask an administrator to review the property address and geocoding status.
              {can("integrations") && <> <Link to="/properties" className="font-medium text-primary underline underline-offset-2">Review properties</Link>.</>}
            </p>}
            {can("integrations") && Boolean(map.data?.exceptions.length) &&
              <details className="rounded-lg border border-border bg-card p-3 text-sm">
                <summary className="cursor-pointer font-medium">Coordinate exceptions · {map.data?.exceptions.length}</summary>
                <ul className="mt-2 space-y-1">
                  {map.data?.exceptions.map((exception) => <li key={exception.propertyId}>
                    <Link to="/property/$propertyId" params={{ propertyId: exception.propertyId }} className="text-primary underline underline-offset-2">{exception.name}</Link>
                    <span className="text-muted-foreground"> · {exception.reason} · {exception.address || "No address"}</span>
                  </li>)}
                </ul>
              </details>}
            <Sheet open={Boolean(selectedPin)} onOpenChange={(open) => { if (!open) setParam({ pin: undefined }); }}>
              <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>{selectedPin?.name ?? "Property"}</SheetTitle>
                  <SheetDescription>{selectedPin?.address || "Address unavailable"}</SheetDescription>
                </SheetHeader>
                {selectedPin && <div className="space-y-4 px-4 pb-6 text-sm">
                  <p className="text-muted-foreground">{selectedPin.market || "Market not set"} · {activeMapCount(selectedPin)} active issue{activeMapCount(selectedPin) === 1 ? "" : "s"}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPin.openJobs.filter((job) => job.ticketId && !["closed", "resolved"].includes(job.status)).length} active Tickets · {selectedPin.openJobs.filter((job) => job.workOrderId).length} canonical Work Orders
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline"><Link to="/property/$propertyId" params={{ propertyId: selectedPin.propertyId }} search={originSearch as never}>Open Property</Link></Button>
                    <Button asChild size="sm" variant="outline"><a href={directionsUrl(selectedPin)} target="_blank" rel="noopener noreferrer">Directions</a></Button>
                  </div>
                  {selectedPin.openJobs.length ? selectedPin.openJobs.map((job) => (
                    <div key={job.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2"><strong>{job.ticketId ? `#${job.ref}` : "Work Order"} {job.title}</strong>
                        <StatusBadge tone={ticketTone(job.status)}>{job.priority.toUpperCase()}</StatusBadge></div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span>Status: {job.status}</span><span>Owner: {job.assigneeId ? displayName(people.get(job.assigneeId)) : "Unassigned"}</span>
                        <span>Team: {job.team || "Unassigned"}</span><span>Vendor: {job.vendorName || "None"}</span>
                        <span>Dispatch: {job.dispatchState || "Not sent"}</span><span>Acceptance: {job.acceptanceState || "Pending"}</span>
                        {job.dispatchSyncedAt && <span className="col-span-2">Breezeway synced: {relativeTime(job.dispatchSyncedAt)}</span>}
                        <span>Completion: {job.completionState || "Pending"}</span><span>Due: {job.dueAt ? relativeTime(job.dueAt) : "Not set"}</span>
                        <span>SLA: {job.slaBreached ? "Breached" : "Within window"}</span><span>Escalation: {job.escalated ? "Escalated" : "None"}</span>
                        {job.waitingOn && <span className="col-span-2">Waiting on: {job.waitingOn}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {job.ticketId && <Button asChild size="sm"><Link to="/tickets/$ticketId" params={{ ticketId: job.ticketId }} search={originSearch}>Open Ticket</Link></Button>}
                        {job.workOrderId && <Button asChild size="sm" variant="outline"><Link to="/work-orders" search={{ open: job.workOrderId, ...originSearch } as never}>Open Work Order</Link></Button>}
                      </div>
                    </div>
                  )) : <p className="text-muted-foreground">No work matches the current filters at this property.</p>}
                </div>}
              </SheetContent>
            </Sheet>
          </div>
      ) : viewItems.length === 0 ? (
        <EmptyState
          title="Nothing matches this view."
          hint="Clear a filter or widen the status to see more of the team's work."
        />
      ) : view === "kanban" ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {(["open", "in_progress", "waiting", "other"] as const).map((column) => {
            const rows = viewItems.filter((ticket) => column === "other"
              ? !["open", "in_progress", "waiting"].includes(ticket.status) : ticket.status === column);
            return <section key={column} className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-3">
              <h2 className="font-semibold capitalize">{column.replace("_", " ")} · {rows.length}</h2>
              {rows.map((ticket) => "kind" in ticket ? <Link key={ticket.id} to="/work-orders" search={{ open: ticket.id, ...originSearch } as never}
                className="block rounded-md border border-border bg-background p-3 text-sm hover:bg-accent/40">
                <strong>Work Order · {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {effectiveOperationsPriority(ticket).toUpperCase()}</p>
              </Link> : <Link key={ticket.id} to="/tickets/$ticketId" params={{ ticketId: ticket.id }} search={originSearch}
                className="block rounded-md border border-border bg-background p-3 text-sm hover:bg-accent/40">
                <strong>#{ticket.ref} {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {effectiveOperationsPriority(ticket).toUpperCase()}</p>
              </Link>)}
            </section>;
          })}
        </div>
      ) : view === "calendar" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <h2 className="font-display text-lg font-semibold">{new Date(`${calendarMonth}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setParam({ month: shiftOperationsMonth(calendarMonth, -1) })}>Previous month</Button>
              <Button size="sm" variant="outline" onClick={() => setParam({ month: shiftOperationsMonth(calendarMonth, 1) })}>Next month</Button>
            </div>
          </div>
          <div className="hidden grid-cols-7 overflow-hidden rounded-lg border border-border bg-card md:grid">
            {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map((day) =>
              <div key={day} className="border-b border-border bg-muted/30 p-2 text-center text-xs font-semibold">{day}</div>)}
            {operationsCalendarDays(calendarMonth).map((day) => <section key={day}
              className={`min-h-32 border-b border-r border-border p-1.5 ${day.slice(0, 7) === calendarMonth ? "" : "bg-muted/20 text-muted-foreground"}`}>
              <h3 className="mb-1 text-xs font-semibold">{Number(day.slice(8))}</h3>
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {viewItems.filter((item) => itemDate(item) === day).map((item) => "kind" in item
                  ? <Link key={item.id} to="/work-orders" search={{ open: item.id, ...originSearch } as never}
                      className="block rounded border border-border bg-background p-1 text-xs hover:bg-accent/40">
                      <span className="font-semibold">WO · {effectiveOperationsPriority(item).toUpperCase()}</span> {item.title}
                    </Link>
                  : <Link key={item.id} to="/tickets/$ticketId" params={{ ticketId: item.id }} search={originSearch}
                      className="block rounded border border-border bg-background p-1 text-xs hover:bg-accent/40">
                      <span className="font-semibold">#{item.ref} · {effectiveOperationsPriority(item).toUpperCase()}</span> {item.title}
                    </Link>)}
              </div>
            </section>)}
          </div>
          {viewItems.some((item) => itemDate(item) === "Unscheduled") && <section className="hidden rounded-lg border border-border bg-card p-3 md:block">
            <h3 className="font-semibold">Unscheduled</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {viewItems.filter((item) => itemDate(item) === "Unscheduled").map((item) => "kind" in item
                ? <Link key={item.id} to="/work-orders" search={{ open: item.id, ...originSearch } as never} className="rounded border border-border p-2 text-sm hover:bg-accent/40">WO · {item.title}</Link>
                : <Link key={item.id} to="/tickets/$ticketId" params={{ ticketId: item.id }} search={originSearch} className="rounded border border-border p-2 text-sm hover:bg-accent/40">#{item.ref} · {item.title}</Link>)}
            </div>
          </section>}
          <div className="space-y-3 md:hidden">{[...new Set(viewItems.map(itemDate).filter((date) => date === "Unscheduled" || date.startsWith(calendarMonth)))].sort().map((date) => (
            <section key={date} className="rounded-lg border border-border bg-card p-3">
              <h2 className="font-semibold">{date === "Unscheduled" ? date : usDate(date)}</h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {viewItems.filter((ticket) => itemDate(ticket) === date)
                  .map((ticket) => "kind" in ticket ? <Link key={ticket.id} to="/work-orders" search={{ open: ticket.id, ...originSearch } as never}
                    className="rounded-md border border-border bg-background p-3 text-sm hover:bg-accent/40">
                    <strong>Work Order · {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {effectiveOperationsPriority(ticket).toUpperCase()}</p>
                  </Link> : <Link key={ticket.id} to="/tickets/$ticketId" params={{ ticketId: ticket.id }} search={originSearch}
                    className="rounded-md border border-border bg-background p-3 text-sm hover:bg-accent/40">
                    <strong>#{ticket.ref} {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {effectiveOperationsPriority(ticket).toUpperCase()}</p>
                  </Link>)}
              </div>
            </section>
          ))}</div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"} · {standaloneOrders.length} separate Work Order{standaloneOrders.length === 1 ? "" : "s"}
          </p>
          {tickets.map((t) => {
            const ownerId = currentOwnerId(t);
            const team = homeTeamOf(ownerId);
            const sla = slaState(t);
            const blocked = isBlocked(t as never);
            const escalated = isEscalated(t as never);
            return (
              <div key={t.id} className="flex items-center gap-2">
              <Checkbox
                className="ml-1 shrink-0"
                aria-label={`Select ticket ${t.ref}`}
                checked={selectedTickets.includes(t.id)}
                onCheckedChange={() =>
                  setSelectedTickets((prev) =>
                    prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                  )
                }
              />
              <Link
                to="/tickets/$ticketId"
                params={{ ticketId: t.id }}
                search={originSearch}
                className="surface-row flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 pr-4"
              >
                <PropertyPhoto
                  url={(t.properties as { primary_photo_url?: string } | null)?.primary_photo_url}
                  name={formatPropertyLabel(t.properties).primary}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="numeric text-xs text-muted-foreground">#{t.ref}</span>
                    <span className="truncate font-medium">{t.title}</span>
                    <Badge variant="outline" className={priorityTone(effectiveOperationsPriority(t))}>
                      {priorityMeta(effectiveOperationsPriority(t)).short}
                    </Badge>
                    <StatusBadge tone={ticketTone(t.status)}>
                      {labelFor(STATUSES, t.status)}
                    </StatusBadge>
                    {blocked && (
                      <Badge
                        variant="outline"
                        className="border-danger/40 bg-danger/10 text-danger"
                      >
                        Blocked
                      </Badge>
                    )}
                    {escalated && (
                      <Badge
                        variant="outline"
                        className="border-danger/40 bg-danger/10 text-danger"
                      >
                        Escalated
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm">
                    {ownerId ? (
                      <span className="font-medium text-foreground">
                        {displayName(people.get(ownerId))}
                      </span>
                    ) : (
                      <Chip className={ownershipChip("unassigned")}>Unassigned</Chip>
                    )}
                    {team ? (
                      <span className="text-muted-foreground">{HOME_TEAM_SHORT[team] ?? team}</span>
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm text-muted-foreground">
                  {sla.breached ? (
                    <span className="numeric font-medium text-danger">Overdue</span>
                  ) : (
                    <span>Reported {usDate(t.reported_at)}</span>
                  )}
                </div>
              </Link>
              </div>
            );
          })}
          <QueueBulkActions selected={selectedTickets} onClear={() => setSelectedTickets([])} />
          {standaloneOrders.map((order) => <Link key={order.id} to="/work-orders" search={{ open: order.id, ...originSearch } as never}
            className="surface-row flex items-start gap-3 py-3 pl-4 pr-4">
            <PropertyPhoto name={formatPropertyLabel(order.properties).primary} />
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Work Order · {order.title}</span>
              <Badge variant="outline" className={priorityTone(order.priority)}>{order.priority.toUpperCase()}</Badge>
              <StatusBadge tone={ticketTone(order.status)}>{order.status.replace("_", " ")}</StatusBadge>
            </div><p className="mt-1 text-sm text-muted-foreground">{formatPropertyLabel(order.properties).primary} · {order.assigned_to ? displayName(people.get(order.assigned_to)) : "Unassigned"} · {order.vendor_name || "No vendor"}</p></div>
            <span className="text-xs text-muted-foreground">{order.next_action_due_at ? `Due ${usDate(order.next_action_due_at)}` : "No due date"}</span>
          </Link>)}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 w-full text-sm text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
