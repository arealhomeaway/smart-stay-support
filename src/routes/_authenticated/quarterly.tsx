import { LaunchStateGate } from "@/components/LaunchStateGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Play } from "lucide-react";
import { toast } from "sonner";
import {
  quarterlyReviews,
  startQuarterlyReview,
  startDueQuarterlyReviews,
} from "@/lib/quarterly.functions";
import { QUARTERLY_LABELS, daysUntil, type QuarterlyRow } from "@/lib/quarterly";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionCard, StatTile, EmptyState, LoadingRows } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { usDate } from "@/lib/dates";
import { CleaningRegionsPanel } from "@/components/CleaningRegionsPanel";

export const Route = createFileRoute("/_authenticated/quarterly")({
  head: () => ({
    meta: [
      { title: "Quarterly reviews — Resolve Operations" },
      {
        name: "description",
        content:
          "Track the three-month property review cycle: which homes are due, which reviews are in progress, and the cleaning supervisor checklist behind each one.",
      },
      { property: "og:title", content: "Quarterly reviews — Resolve Operations" },
      {
        property: "og:description",
        content: "Every managed home reviewed by a cleaning supervisor every three months.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GatedQuarterlyPage,
});

function reviewTone(status: QuarterlyRow["status"]): StatusTone {
  switch (status) {
    case "in_progress":
      return "progress";
    case "overdue":
    case "due":
      return "escalated";
    case "upcoming":
      return "waiting";
    default:
      return "closed";
  }
}

function dueText(row: QuarterlyRow) {
  const d = daysUntil(row.dueOn);
  if (d === 0) return "Due today";
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue`;
  return `Due in ${d} day${d === 1 ? "" : "s"}`;
}

function GatedQuarterlyPage() {
  return (
    <LaunchStateGate
      flag="quarterly_reviews"
      title="Quarterly reviews are not part of the Operations beta"
      description="Quarterly property reviews launch later, alongside the mature Vendor Portal."
    >
      <QuarterlyPage />
    </LaunchStateGate>
  );
}

function QuarterlyPage() {
  const qc = useQueryClient();
  const load = useServerFn(quarterlyReviews);
  const startOne = useServerFn(startQuarterlyReview);
  const startDue = useServerFn(startDueQuarterlyReviews);

  const reviews = useQuery({ queryKey: ["quarterly-reviews"], queryFn: () => load() });
  const rows = reviews.data?.rows ?? [];
  const playbookId = reviews.data?.checklistPlaybookId ?? null;

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["quarterly-reviews"] });

  const openOne = useMutation({
    mutationFn: (propertyId: string) => startOne({ data: { propertyId } }),
    onSuccess: (r) => {
      toast.success(
        r.alreadyOpen
          ? "That review is already open."
          : "Quarterly review opened with its checklist.",
      );
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open the review"),
  });

  const openAll = useMutation({
    mutationFn: () => startDue(),
    onSuccess: (r) =>
      r.created === 0
        ? toast.info("Nothing is due right now.")
        : (toast.success(`${r.created} quarterly review${r.created === 1 ? "" : "s"} opened.`),
          invalidate()),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open the reviews"),
  });

  const needsWork = rows.filter((r) => r.status === "overdue" || r.status === "due");
  const inFlight = rows.filter((r) => r.status === "in_progress");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Quarterly reviews"
        description="Every home gets a supervisor visit 30 days after handoff, then every 90 days after that. Reviews open on their own as the date arrives."
        actions={
          <>
            {playbookId ? (
              <Button asChild variant="outline">
                <Link to="/playbooks">
                  <ClipboardList className="mr-2 size-4" /> View the checklist
                </Link>
              </Button>
            ) : null}
            <Button
              onClick={() => openAll.mutate()}
              disabled={openAll.isPending || needsWork.length === 0}
            >
              <Play className="mr-2 size-4" />
              Open all due ({needsWork.length})
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Due or overdue"
          value={needsWork.length}
          tone={needsWork.length ? "attention" : "neutral"}
        />
        <StatTile label="Reviews in progress" value={inFlight.length} tone="progress" />
        <StatTile label="Homes on the cycle" value={rows.length} />
      </div>

      <CleaningRegionsPanel />

      <SectionCard
        title="The cycle"
        description="Sorted by what needs a supervisor on site soonest."
      >
        {reviews.isLoading ? (
          <LoadingRows rows={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No active homes yet"
            hint="Add properties and they'll join the quarterly cycle automatically."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const meta = QUARTERLY_LABELS[row.status];
              return (
                <div
                  key={row.propertyId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <PropertyPhoto name={row.name} />
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.market ? `${row.market} · ` : ""}
                        {row.inspector ?? "No regional manager set"} ·{" "}
                        {row.location || "No address on file"} ·{" "}
                        {row.lastReviewedAt
                          ? `Last reviewed ${usDate(row.lastReviewedAt)}`
                          : "Never reviewed in Resolve"}{" "}
                        · {dueText(row)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={reviewTone(row.status)}>{meta.label}</StatusBadge>
                    {row.openTicketId ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/tickets/$ticketId" params={{ ticketId: row.openTicketId }}>
                          Open review #{row.openTicketRef}
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={row.status === "current" ? "ghost" : "default"}
                        onClick={() => openOne.mutate(row.propertyId)}
                        disabled={openOne.isPending}
                      >
                        Start review
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
