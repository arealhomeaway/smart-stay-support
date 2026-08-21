import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, ClipboardList, Play } from "lucide-react";
import { toast } from "sonner";
import {
  quarterlyReviews,
  startQuarterlyReview,
  startDueQuarterlyReviews,
} from "@/lib/quarterly.functions";
import { QUARTERLY_LABELS, daysUntil, type QuarterlyRow } from "@/lib/quarterly";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  component: QuarterlyPage,
});

function dueText(row: QuarterlyRow) {
  const d = daysUntil(row.dueOn);
  if (d === 0) return "Due today";
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue`;
  return `Due in ${d} day${d === 1 ? "" : "s"}`;
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
      toast.success(r.alreadyOpen ? "That review is already open." : "Quarterly review opened with its checklist.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open the review"),
  });

  const openAll = useMutation({
    mutationFn: () => startDue(),
    onSuccess: (r) =>
      r.created === 0
        ? toast.info("Nothing is due right now.")
        : (toast.success(`${r.created} quarterly review${r.created === 1 ? "" : "s"} opened.`), invalidate()),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open the reviews"),
  });

  const needsWork = rows.filter((r) => r.status === "overdue" || r.status === "due");
  const inFlight = rows.filter((r) => r.status === "in_progress");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <CalendarCheck className="size-6" /> Quarterly reviews
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The first inspection is scheduled 30 days after a home is handed off to operations, and every one after
            that lands 90 days later. Inspections open on their own as the date arrives, assigned to the regional
            cleaning manager for that market.
          </p>

        </div>
        <div className="flex gap-2">
          {playbookId ? (
            <Button asChild variant="outline">
              <Link to="/playbooks">
                <ClipboardList className="mr-2 size-4" /> View the checklist
              </Link>
            </Button>
          ) : null}
          <Button onClick={() => openAll.mutate()} disabled={openAll.isPending || needsWork.length === 0}>
            <Play className="mr-2 size-4" />
            Open all due ({needsWork.length})
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Due or overdue" value={needsWork.length} />
        <StatCard label="Reviews in progress" value={inFlight.length} />
        <StatCard label="Homes on the cycle" value={rows.length} />
      </div>

      <CleaningRegionsPanel />

      <Card>
        <CardHeader>
          <CardTitle>The cycle</CardTitle>
          <CardDescription>Sorted by what needs a supervisor on site soonest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {reviews.isLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No active homes yet. Add properties and they'll join the quarterly cycle automatically.
            </p>
          ) : (
            rows.map((row) => {
              const meta = QUARTERLY_LABELS[row.status];
              return (
                <div
                  key={row.propertyId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.market ? `${row.market} · ` : ""}
                      {row.inspector ?? "No regional manager set"} ·{" "}
                      {row.location || "No address on file"} ·{" "}
                      {row.lastReviewedAt
                        ? `Last reviewed ${new Date(row.lastReviewedAt).toLocaleDateString()}`
                        : "Never reviewed in Resolve"}{" "}
                      · {dueText(row)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={meta.tone}>
                      {meta.label}
                    </Badge>
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
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
