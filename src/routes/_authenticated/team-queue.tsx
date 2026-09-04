import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { useCurrentUserId, useStaffDirectory, displayName } from "@/hooks/useTeam";
import { useHomeTeams, HOME_TEAM_SHORT } from "@/hooks/useHomeTeam";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chip, EmptyState, LoadingRows, PageHeader, PriorityRail } from "@/components/ui/page";
import { ownershipChip, stateChip, ticketState } from "@/lib/semantic";
import {
  PRIORITIES,
  STATUSES,
  labelFor,
  priorityMeta,
  priorityTone,
  relativeTime,
  slaState,
} from "@/lib/tickets";
import { currentOwnerId, queueSort } from "@/lib/matters";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import {
  AGE_OPTIONS,
  DEFAULT_TEAM_QUEUE_FILTERS,
  HOME_TEAM_OPTIONS,
  activeFilterCount,
  applyTeamQueueFilters,
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
  validateSearch: (raw: Record<string, unknown>): Partial<Record<string, string>> => {
    const out: Partial<Record<string, string>> = {};
    for (const key of [
      "assignee",
      "homeTeam",
      "priority",
      "status",
      "property",
      "age",
      "flags",
      "q",
    ]) {
      const v = raw[key];
      if (typeof v === "string" && v) out[key] = v;
    }
    return out;
  },
  component: TeamQueuePage,
});

function TeamQueuePage() {
  const navigate = Route.useNavigate();
  const params = Route.useSearch();
  const { demoMode } = useDemo();
  const userId = useCurrentUserId();
  const { data: staff } = useStaffDirectory();
  const { homeTeamOf } = useHomeTeams();

  const flags = new Set((params["flags"] ?? "").split(",").filter(Boolean));
  const filters: TeamQueueFilters = {
    ...DEFAULT_TEAM_QUEUE_FILTERS,
    assignee: params["assignee"] ?? "all",
    homeTeam: params["homeTeam"] ?? "all",
    priority: params["priority"] ?? "all",
    status: params["status"] ?? "active",
    property: params["property"] ?? "all",
    age: params["age"] ?? "all",
    waiting: flags.has("waiting"),
    unassigned: flags.has("unassigned"),
    escalated: flags.has("escalated"),
    blocked: flags.has("blocked"),
    overdue: flags.has("overdue"),
    q: params["q"] ?? "",
  };

  const setParam = (patch: Record<string, string | undefined>) =>
    void navigate({
      search: (prev: Record<string, string | undefined>) => {
        const next = { ...prev, ...patch };
        for (const [k, v] of Object.entries(next)) if (!v) delete next[k];
        return next;
      },
      replace: true,
    });

  const toggleFlag = (flag: string) => {
    const nextFlags = new Set(flags);
    if (nextFlags.has(flag)) nextFlags.delete(flag);
    else nextFlags.add(flag);
    setParam({ flags: [...nextFlags].join(",") || undefined });
  };

  const people = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s])), [staff]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["team-queue", demoMode],
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

  const all = useMemo(() => data ?? [], [data]);
  const tickets = useMemo(
    () =>
      (applyTeamQueueFilters(all as never, filters, homeTeamOf) as unknown as typeof all).sort(
        queueSort as never,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, JSON.stringify(filters), homeTeamOf],
  );


  const properties = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of all)
      if (t.property_id)
        map.set(t.property_id, t.properties?.nickname ?? t.properties?.name ?? "Property");
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);

  const owners = useMemo(() => {
    const ids = new Set<string>();
    for (const t of all) {
      const id = currentOwnerId(t);
      if (id) ids.add(id);
    }
    return [...ids]
      .map((id) => ({ id, name: displayName(people.get(id)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all, people]);

  const { originSearch } = useWorkspaceOrigin(
    "Team Queue",
    tickets.map((t) => ({
      id: t.id,
      label: t.title,
      sub: t.properties?.nickname ?? t.properties?.name ?? undefined,
    })),
  );

  const filterCount = activeFilterCount(filters);

  const flagButtons: { key: string; label: string; count: number }[] = useMemo(() => {
    const active = all.filter((t) => !["resolved", "closed"].includes(t.status));
    return [
      { key: "unassigned", label: "Unassigned", count: active.filter((t) => !currentOwnerId(t)).length },
      { key: "waiting", label: "Waiting", count: active.filter((t) => t.status === "waiting").length },
      { key: "blocked", label: "Blocked", count: active.filter((t) => isBlocked(t as never)).length },
      { key: "escalated", label: "Escalated", count: active.filter((t) => isEscalated(t as never)).length },
      { key: "overdue", label: "Overdue", count: active.filter((t) => slaState(t).breached).length },
    ];
  }, [all]);

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
        <Button
          size="sm"
          variant={filters.assignee === userId ? "default" : "outline"}
          onClick={() => setParam({ assignee: filters.assignee === userId ? undefined : (userId ?? undefined) })}
        >
          Only mine
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
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
      </div>

      <Input
        placeholder="Search reference, title, guest…"
        value={filters.q}
        onChange={(e) => setParam({ q: e.target.value || undefined })}
        aria-label="Search the team queue"
        className="max-w-sm"
      />

      {isError ? (
        <EmptyState
          title="The queue could not be loaded."
          hint="This is usually a connection hiccup."
          action={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      ) : isLoading ? (
        <LoadingRows rows={6} />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="Nothing matches this view."
          hint="Clear a filter or widen the status to see more of the team's work."
        />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          </p>
          {tickets.map((t) => {
            const ownerId = currentOwnerId(t);
            const team = homeTeamOf(ownerId);
            const sla = slaState(t);
            return (
              <Link
                key={t.id}
                to="/tickets/$ticketId"
                params={{ ticketId: t.id }}
                search={originSearch}
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
                  {isBlocked(t as never) && (
                    <Badge variant="outline" className="border-danger/40 bg-danger/10 text-danger">
                      Blocked
                    </Badge>
                  )}
                  {isEscalated(t as never) && (
                    <Badge variant="outline" className="border-danger/40 bg-danger/10 text-danger">
                      Escalated
                    </Badge>
                  )}
                  <span className="numeric ml-auto text-sm text-muted-foreground">
                    {sla.breached ? (
                      <span className="font-medium text-danger">Overdue</span>
                    ) : (
                      relativeTime(t.reported_at)
                    )}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t.properties?.nickname ?? t.properties?.name ?? "No property"} ·{" "}
                  {ownerId ? (
                    <span className="font-medium text-foreground">
                      {displayName(people.get(ownerId))}
                    </span>
                  ) : (
                    <Chip className={ownershipChip("unassigned")}>Unassigned</Chip>
                  )}
                  {team ? ` · ${HOME_TEAM_SHORT[team] ?? team}` : ""}
                </p>
              </Link>
            );
          })}
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
