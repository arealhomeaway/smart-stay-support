import { formatPropertyLabel } from "@/lib/property-label";
/**
 * Routine work — the four recurring controls, in one place.
 *
 * This screen is deliberately not the ticket queue. Nothing here is an
 * exception someone reported; it is the scheduled quality work the team
 * already does after every clean, every stay and every review.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireCapability } from "@/components/RequireCapability";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingPage, PageHeader, SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { RoutineDrawer, type RoutineRow } from "@/components/routines/RoutineDrawer";
import { MaintenanceReviewQueue } from "@/components/routines/MaintenanceReviewQueue";
import { useDemo } from "@/components/DemoProvider";
import { useSeat } from "@/hooks/useSeat";
import { useFeatureFlags } from "@/lib/feature-flags";
import { SURVEY_CHECK_FLAG, isLiveCheck } from "@/lib/record-routine";
import { openRecordRoutine } from "@/components/routines/RecordRoutinePanel";
import {
  OUTCOME_LABELS,
  ROUTINE_CONFIG,
  ROUTINE_KINDS,
  RETIRED_ROUTINE_KINDS,
  routineConfig,
  routineDueLabel,
  routineDueState,
  type RoutineKind,
  type RoutineOutcome,
} from "@/lib/routine-controls";

export const Route = createFileRoute("/_authenticated/routines")({
  head: () => ({
    meta: [
      { title: "Routine work — Resolve Operations" },
      {
        name: "description",
        content:
          "Guest touch bases, work order reviews and guest reviews: the daily checks that keep our guests happy and our homes in great shape.",
      },
      { property: "og:title", content: "Routine work — Resolve Operations" },
      {
        property: "og:description",
        content: "Routine checks with what is due, what is late and what was found.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="routines" title="Routine work">
      <RoutinesPage />
    </RequireCapability>
  ),
});

function RoutinesPage() {
  const qc = useQueryClient();
  const { demoMode } = useDemo();
  const seat = useSeat();
  const flags = useFeatureFlags();
  const surveyOn = flags.enabled(SURVEY_CHECK_FLAG);
  const [openRow, setOpenRow] = useState<RoutineRow | null>(null);
  const [filter, setFilter] = useState<"mine" | "all">("all");

  // Routine work follows the same demo lens as every other queue: demo rows
  // only inside the demo environment, live rows only outside it. Before this,
  // seeded scenarios leaked into the real routine queue.
  const { data, isLoading } = useQuery({
    queryKey: ["routine-controls", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_controls")
        .select("*, properties(name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id)")
        .eq("is_demo", demoMode)
        .order("due_at", { ascending: true })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as RoutineRow[];
    },
  });

  const myTeamKinds = useMemo(
    () => new Set(ROUTINE_KINDS.filter((k) => !seat.team || ROUTINE_CONFIG[k].team === seat.team)),
    [seat.team],
  );

  // Open work is recorded in the one Record routine work panel.
  const openInPanel = (r: RoutineRow) =>
    isLiveCheck(r.kind) ? openRecordRoutine({ kind: r.kind }) : setOpenRow(r);

  if (isLoading || !data) return <LoadingPage tiles={0} />;

  // Retired checks (Checkout, Cleaning Review) never show as work; their history stays below.
  const openRows = data.filter(
    (r) =>
      (r.status === "due" || r.status === "in_progress") &&
      !RETIRED_ROUTINE_KINDS.has(r.kind) &&
      (r.kind !== "survey_review" || surveyOn),
  );
  const visible =
    filter === "mine" ? openRows.filter((r) => myTeamKinds.has(r.kind as RoutineKind)) : openRows;
  const overdue = visible.filter((r) => routineDueState(r) === "overdue");
  const today = visible.filter((r) => routineDueState(r) === "today");
  const upcoming = visible.filter((r) => routineDueState(r) === "upcoming");
  const recent = data.filter((r) => r.status === "completed").slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Routine work"
        title={
          overdue.length
            ? `${overdue.length} routine ${overdue.length === 1 ? "check is" : "checks are"} late`
            : "Routine work is on track"
        }
        description="Guest touch bases, work order reviews and guest reviews. Checkout and Cleaning Review are retired: the Departure Review in the Team Queue covers them. Past checks stay here for history."
        actions={
          <>
            <div className="flex rounded-lg border border-border p-0.5">
              {(["mine", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                    filter === f ? "bg-secondary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "mine" ? "My team" : "Everything"}
                </button>
              ))}
            </div>
            <Button className="h-10" onClick={() => openRecordRoutine()}>
              <ClipboardCheck className="size-4" aria-hidden="true" /> Record routine work
            </Button>
          </>
        }
      />

      <Section
        title="Late"
        description="Past the time these were meant to be done."
        rows={overdue}
        tone="critical"
        onOpen={openInPanel}
      />
      <Section
        title="Due today"
        description="Scheduled for today."
        rows={today}
        onOpen={openInPanel}
      />
      <Section
        title="Coming up"
        description="Scheduled, not yet due."
        rows={upcoming}
        onOpen={openInPanel}
      />

      <MaintenanceReviewQueue demoMode={demoMode} onOpen={setOpenRow} />

      <SectionCard
        title="Recently completed"
        description="What the team found."
        bodyClassName="space-y-1.5"
      >
        {recent.length === 0 ? (
          <EmptyState title="Nothing completed yet." />
        ) : (
          recent.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpenRow(r)}
              className="surface-row flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left"
            >
              <PropertyPhoto
                name={formatPropertyLabel(r.properties).primary}
                className="size-9"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {routineConfig(r.kind).label}
                  {formatPropertyLabel(r.properties).primary
                    ? ` · ${formatPropertyLabel(r.properties).primary}`
                    : ""}
                </span>
              </span>
              <StatusBadge tone="resolved">
                {OUTCOME_LABELS[(r.outcome as RoutineOutcome) ?? "looks_good"]}
              </StatusBadge>
            </button>
          ))
        )}
      </SectionCard>

      <RoutineDrawer
        row={openRow}
        open={Boolean(openRow)}
        onOpenChange={(v) => !v && setOpenRow(null)}
      />
    </div>
  );
}

function Section({
  title,
  description,
  rows,
  tone,
  onOpen,
}: {
  title: string;
  description: string;
  rows: RoutineRow[];
  tone?: "critical";
  onOpen: (r: RoutineRow) => void;
}) {
  return (
    <SectionCard
      title={`${title} · ${rows.length}`}
      description={description}
      tone={tone && rows.length > 0 ? "critical" : "default"}
      bodyClassName="space-y-1.5"
    >
      {rows.length === 0 ? (
        <EmptyState title={`Nothing ${title.toLowerCase()}.`} />
      ) : (
        rows.map((r) => {
          const config = routineConfig(r.kind);
          const late = routineDueState(r) === "overdue";
          return (
            <button
              key={r.id}
              onClick={() => onOpen(r)}
              className="surface-row flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
            >
              <PropertyPhoto
                name={formatPropertyLabel(r.properties).primary}
                className="size-9"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{r.title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {config.label}
                  {formatPropertyLabel(r.properties).primary
                    ? ` · ${formatPropertyLabel(r.properties).primary}`
                    : ""}
                </span>
              </span>
              <StatusBadge tone={late ? "escalated" : "closed"}>{routineDueLabel(r)}</StatusBadge>
            </button>
          );
        })
      )}
    </SectionCard>
  );
}
