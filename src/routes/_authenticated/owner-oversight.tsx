import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, FlaskConical, Search, Users } from "lucide-react";
import { EmptyState, LoadingPage, PageHeader, SectionCard, StatTile } from "@/components/ui/page";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ownerPrograms } from "@/lib/owner-program.functions";
import { useDemo } from "@/components/DemoProvider";
import { usDate } from "@/lib/dates";
import { OWNER_GOAL_HOURS, PROGRAM_TOTAL_DAYS } from "@/lib/owner-participation";
import {
  enrolledRows,
  oversightSummary,
  viewOversight,
  type OversightInput,
  type OversightSort,
  type PaceFilter,
} from "@/lib/owner-oversight";

export const Route = createFileRoute("/_authenticated/owner-oversight")({
  head: () => ({
    meta: [
      { title: "Active Owner oversight — Resolve Operations" },
      {
        name: "description",
        content:
          "One screen for supervisors: every enrolled homeowner, hours reported against pace, checkpoints coming due and what is waiting on the owner.",
      },
      { property: "og:title", content: "Active Owner oversight — Resolve Operations" },
      {
        property: "og:description",
        content: "The whole Active Owner program at a glance, home by home.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <OwnerOversightPage />
    </SupervisorOnly>
  ),
});

const TONE: Record<string, StatusTone> = {
  good: "resolved",
  warn: "escalated",
  muted: "closed",
};

function OwnerOversightPage() {
  const load = useServerFn(ownerPrograms);
  const { demoMode } = useDemo();
  const [showDemo, setShowDemo] = useState(false);
  const viewingDemo = demoMode || showDemo;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PaceFilter>("all");
  const [sort, setSort] = useState<OversightSort>("pace");

  const programs = useQuery({
    queryKey: ["owner-programs", viewingDemo],
    queryFn: () => load({ data: { demo: viewingDemo } }),
  });

  const rows = useMemo(
    () => enrolledRows((programs.data?.rows ?? []) as unknown as OversightInput[]),
    [programs.data],
  );
  const summary = useMemo(() => oversightSummary(rows), [rows]);
  const visible = useMemo(
    () => viewOversight(rows, { search, filter, sort }),
    [rows, search, filter, sort],
  );

  if (programs.isLoading) return <LoadingPage tiles={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Active Owner"
        title="Program oversight"
        description="Every enrolled homeowner on one screen: hours they have reported against the program's own pace, the checkpoints coming due, and what is still waiting on them."
        actions={
          <Button asChild variant="outline">
            <Link to="/owner-programs">Open program admin</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Enrolled homeowners" value={summary.enrolled} />
        <StatTile label="On pace" value={summary.onPace} tone="positive" />
        <StatTile label="Behind pace" value={summary.behind} tone="critical" />
        <StatTile
          label="Hours reported"
          value={summary.totalHours}
          hint={`Across the whole program · ${OWNER_GOAL_HOURS} hrs each`}
        />
        <StatTile
          label="Checkpoints in 7 days"
          value={summary.reviewsDueSoon}
          tone="attention"
          hint={`${summary.awaitingOwner} waiting on a homeowner`}
        />
      </div>

      <SectionCard
        title="Enrolled homes"
        description="Click any homeowner to open their program record."
        actions={
          <button
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            className={
              showDemo
                ? "inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                : "inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
          >
            <FlaskConical className="size-3.5" />
            {showDemo ? "Hide" : "Show"} demo programs
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a homeowner or home"
              className="pl-8"
              aria-label="Find a homeowner or home"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as PaceFilter)}>
            <SelectTrigger className="w-48" aria-label="Filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All enrolled</SelectItem>
              <SelectItem value="on_pace">On pace</SelectItem>
              <SelectItem value="behind">Behind pace</SelectItem>
              <SelectItem value="review_due">Checkpoint due</SelectItem>
              <SelectItem value="waiting_on_owner">Waiting on the owner</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as OversightSort)}>
            <SelectTrigger className="w-48" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pace">Sort: pace</SelectItem>
              <SelectItem value="review">Sort: checkpoint due</SelectItem>
              <SelectItem value="days_left">Sort: days remaining</SelectItem>
              <SelectItem value="hours">Sort: hours reported</SelectItem>
              <SelectItem value="name">Sort: name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="No homeowner matches this view."
            hint="Programs appear here once a homeowner's 90-day clock is running. Turn on demo programs to walk through the example home."
            icon={<Users className="size-8" />}
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((row) => (
              <li key={row.id}>
                <Link
                  to="/owner-programs"
                  className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{row.ownerName ?? "Unnamed homeowner"}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {row.properties.map((p) => p.name).join(" · ") || "No home linked yet"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={TONE[row.health.tone] ?? "closed"}>
                        {row.health.label}
                      </StatusBadge>
                      {row.reviewDueSoon && (
                        <StatusBadge tone="waiting">
                          <CalendarClock className="mr-1 inline size-3" />
                          {row.openCheckpoint
                            ? `Day ${row.openCheckpoint.day} check-in`
                            : `Day ${row.nextCheckpoint.day} in ${row.nextCheckpoint.daysAway} days`}
                        </StatusBadge>
                      )}
                      {row.openTasks > 0 && (
                        <StatusBadge tone="review">
                          {row.openTasks} waiting on the owner
                        </StatusBadge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Hours reported
                      </p>
                      <p className="text-sm font-medium">
                        {row.reportedHours} of {row.targetHours} hrs
                      </p>
                      <Progress
                        className="mt-1 h-1.5"
                        value={Math.min(100, (row.reportedHours / row.targetHours) * 100)}
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Day in program
                      </p>
                      <p className="text-sm font-medium">
                        Day {row.day} of {PROGRAM_TOTAL_DAYS} · {row.daysLeft} left
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Enrolled {row.startedOn ? usDate(row.startedOn) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Pace benchmark today
                      </p>
                      <p className="text-sm font-medium">{row.benchmark} hrs</p>
                      {row.health.behindHours > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {row.health.behindHours} hrs behind the benchmark
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Last contact
                      </p>
                      <p className="text-sm font-medium">
                        {row.lastContactAt ? usDate(row.lastContactAt.slice(0, 10)) : "No contact yet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.ownerLinked ? "Has a Resolve login" : "No Resolve login yet"}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
