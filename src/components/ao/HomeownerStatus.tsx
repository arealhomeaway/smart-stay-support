/**
 * Homeowner status on the team's own screens (approved by the Admin, Nov 16): "My homeowners" on
 * My Tasks and the homeowner rows in Operations Needs you now. Read only; the rules live in
 * src/lib/homeowner-status.ts over the "What the homeowner has" reading.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, MessageSquareReply } from "lucide-react";
import { Chip } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { moduleChip, stateChip } from "@/lib/semantic";
import { loadHandedOffProgramHomes, loadHomeownerStatus } from "@/lib/homeowner-status.data";
import { loadAnswerReviews, markAnswerReviewed, type AnswerReviewData } from "@/lib/homeowner-answer-review.data";
import { ANSWER_REVIEW_COPY, answerRows, reviewedLine, splitAnswers, type AnswerRow } from "@/lib/homeowner-answer-review";
import {
  STATUS_COPY,
  answeredRows,
  needsRows,
  waitingRows,
  type HomeownerChip,
  type HomeownerStatusData,
  type StatusRow,
} from "@/lib/homeowner-status";

export function useHomeownerStatus(propertyIds: string[], demo: boolean, enabled = true, allAnswers = false) {
  const key = [...new Set(propertyIds)].sort();
  return useQuery({
    queryKey: ["homeowner-status", demo, key, allAnswers],
    enabled: enabled && key.length > 0,
    staleTime: 60_000,
    queryFn: () => loadHomeownerStatus({ propertyIds: key, demo, allAnswers }),
  });
}

const CHIP_TONE: Record<HomeownerChip["kind"], string> = {
  overdue: stateChip("blocked"),
  waiting: stateChip("waiting"),
  answered: stateChip("done"),
  opened: moduleChip("owner"),
};

/** The small chip on a Task row. Part of the row, so a tap opens the Task's drawer. */
export function HomeownerTaskChip({ chip }: { chip: HomeownerChip }) {
  return (
    <span className="mt-1 block" data-homeowner-chip={chip.kind}>
      <Chip className={cn("font-medium", CHIP_TONE[chip.kind])}>{chip.text}</Chip>
    </span>
  );
}

/** Rows shown before "Show all", so a long list never pushes the Tasks off the screen. */
const FIRST_ROWS = 8;

function RowList({
  rows,
  onOpen,
  empty,
}: {
  rows: StatusRow[];
  onOpen: (r: StatusRow) => void;
  empty: string;
}) {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return <p className="px-1 text-sm text-muted-foreground">{empty}</p>;
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  return (
    <div className="space-y-1.5">
      <ul className="divide-y divide-border rounded-md border border-border">
        {shown.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => onOpen(r)}
              data-homeowner-row={r.key}
              className="flex min-h-11 w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.title}</span>
                <span className="block text-xs text-muted-foreground">{r.home}</span>
                <span
                  className={cn(
                    "block text-xs",
                    r.overdue ? "font-medium text-state-blocked" : "text-foreground",
                  )}
                >
                  {r.line}
                </span>
                {r.files?.length ? (
                  <span className="block text-xs text-muted-foreground">Files: {r.files.map((f) => f.name).join(", ")}</span>
                ) : null}
              </span>
              <ArrowRight
                className="mt-1 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
      {rows.length > FIRST_ROWS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => setAll((v) => !v)}
        >
          {all ? "Show fewer" : `Show all (${rows.length})`}
        </Button>
      ) : null}
    </div>
  );
}

/** Homeowner answers to review (Nov 22): the reviews on these homes, or "not available" before the staged change. */
export function useAnswerReviews(propertyIds: string[], enabled = true) {
  const key = [...new Set(propertyIds)].sort();
  return useQuery({
    queryKey: ["homeowner-answer-reviews", key],
    enabled: enabled && key.length > 0,
    staleTime: 30_000,
    queryFn: () => loadAnswerReviews(key),
  });
}

export type AnswerReviewProps = {
  data: AnswerReviewData | undefined;
  /** The home's assigned Project Manager (the Director of Onboarding and Admin cover). */
  canReview: (propertyId: string) => boolean;
  /** The onboarding Task an answer belongs to, by id. */
  taskTitle: (taskId: string | null) => string | null;
};

/** My Tasks, near the top: what waits on this person's homeowners and what they answered. */
export function MyHomeownersSection({
  data,
  homes,
  loading,
  failed,
  onRetry,
  onOpen,
  review,
}: {
  data: HomeownerStatusData | undefined;
  homes: ReadonlySet<string>;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onOpen: (row: StatusRow) => void;
  review?: AnswerReviewProps | undefined;
}) {
  const now = useMemo(() => new Date(), [data]);
  const waiting = data ? waitingRows(data, homes, now) : [];
  const reviewOn = Boolean(review?.data?.available);
  // Before the review record exists, the answered list stays the 7-day list it was.
  const answered = data && !reviewOn ? answeredRows(data, homes, now) : [];
  const split = data && reviewOn ? splitAnswers(answerRows(data, homes, now), review!.data!.reviews) : null;
  return (
    <section aria-label={STATUS_COPY.myHomeowners} className="surface space-y-3 p-3">
      <h2 className="text-base font-semibold">{STATUS_COPY.myHomeowners}</h2>
      {failed ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {STATUS_COPY.failed}
          <Button size="sm" variant="outline" className="min-h-11" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : loading && homes.size > 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : waiting.length === 0 && answered.length === 0 && (!split || split.toReview.length + split.reviewed.length === 0) ? (
        <p className="text-sm text-muted-foreground">{STATUS_COPY.empty}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">
              {STATUS_COPY.waiting}{" "}
              <span className="numeric text-muted-foreground">({waiting.length})</span>
            </h3>
            <RowList rows={waiting} onOpen={onOpen} empty={STATUS_COPY.empty} />
          </div>
          {split && review ? (
            <AnswerReviewColumn split={split} review={review} onOpen={onOpen} />
          ) : (
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">
                {STATUS_COPY.answered}{" "}
                <span className="numeric text-muted-foreground">({answered.length})</span>
              </h3>
              <RowList rows={answered} onOpen={onOpen} empty={STATUS_COPY.noneAnswered} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AnswerText({ row, taskTitle }: { row: AnswerRow; taskTitle: AnswerReviewProps["taskTitle"] }) {
  const task = taskTitle(row.taskId);
  return (
    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
      <span className="block font-medium">{task ?? row.title}</span>
      {task && task !== row.title ? <span className="block text-xs text-muted-foreground">{row.title}</span> : null}
      <span className="block text-xs text-muted-foreground">{row.home}</span>
      <span className="block whitespace-pre-wrap text-sm text-foreground">{row.line}</span>
      {row.files?.length ? (
        <span className="block text-xs text-muted-foreground">Files: {row.files.map((f) => f.name).join(", ")}</span>
      ) : null}
    </span>
  );
}

/** My homeowners, right column (Nov 22): answers not reviewed yet, each with Reviewed; reviewed ones folded. */
function AnswerReviewColumn({
  split,
  review,
  onOpen,
}: {
  split: ReturnType<typeof splitAnswers>;
  review: AnswerReviewProps;
  onOpen: (row: StatusRow) => void;
}) {
  const qc = useQueryClient();
  const mark = useMutation({
    mutationFn: (row: AnswerRow) => markAnswerReviewed({ propertyId: row.propertyId, itemKey: row.itemKey, answerAt: row.answerAt }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["homeowner-answer-reviews"] }),
    onError: (e: Error) => toast.error(e.message || ANSWER_REVIEW_COPY.failed),
  });
  const names = review.data?.names ?? {};
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium">
        {ANSWER_REVIEW_COPY.toReview} <span className="numeric text-muted-foreground">({split.toReview.length})</span>
      </h3>
      {split.toReview.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{ANSWER_REVIEW_COPY.none}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border" aria-label={ANSWER_REVIEW_COPY.toReview}>
          {split.toReview.map((r) => {
            const saving = mark.isPending && mark.variables?.itemKey === r.itemKey;
            return (
              <li key={r.itemKey} className="flex flex-wrap items-start gap-2 px-3 py-2 text-sm" data-answer-row={r.itemKey}>
                <button
                  type="button"
                  onClick={() => onOpen(r)}
                  className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-left hover:opacity-80"
                >
                  <AnswerText row={r} taskTitle={review.taskTitle} />
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
                {review.canReview(r.propertyId) ? (
                  <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={mark.isPending} onClick={() => mark.mutate(r)}>
                    {saving ? ANSWER_REVIEW_COPY.saving : ANSWER_REVIEW_COPY.button}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {split.reviewed.length > 0 ? (
        <details className="min-w-0 overflow-hidden rounded-md border border-border">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
            {ANSWER_REVIEW_COPY.reviewed} <span className="numeric ml-1 text-muted-foreground">({split.reviewed.length})</span>
          </summary>
          <ul className="divide-y divide-border border-t border-border" aria-label={ANSWER_REVIEW_COPY.reviewed}>
            {split.reviewed.map((r) => (
              <li key={r.itemKey}>
                <button
                  type="button"
                  onClick={() => onOpen(r)}
                  className="flex min-h-11 w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1">
                    <AnswerText row={r} taskTitle={review.taskTitle} />
                    <span className="block text-xs text-muted-foreground">
                      {reviewedLine(r.review.reviewedBy ? names[r.review.reviewedBy] : null, r.review.reviewedAt)}
                    </span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Operations Home, Needs you now: "Homeowner overdue" and "Homeowner answered" for handed-off
 * homes. Shown only to the Operations Supervisor and the Director of Operations.
 */
export function HomeownerNeedsRows({ demo, allowed }: { demo: boolean; allowed: boolean }) {
  const homesQ = useQuery({
    queryKey: ["homeowner-status-handed-off", demo],
    enabled: allowed,
    staleTime: 5 * 60_000,
    queryFn: () => loadHandedOffProgramHomes(demo),
  });
  const homes = homesQ.data ?? [];
  const status = useHomeownerStatus(homes, demo, allowed);
  const rows = useMemo(
    () => (status.data ? needsRows(status.data, new Set(homes), new Date()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status.data, homes.join(",")],
  );
  if (!allowed || rows.length === 0) return null;
  return (
    <>
      {rows.map((r) => (
        <Link
          key={`${r.kind}:${r.key}`}
          to="/property/$propertyId"
          params={{ propertyId: r.propertyId }}
          search={{ tab: "owner" } as never}
          data-needs-row={`homeowner-${r.kind}`}
          className="surface-row flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
        >
          {r.kind === "overdue" ? (
            <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden="true" />
          ) : (
            <MessageSquareReply className="size-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">
            <span className={cn("block font-medium", r.kind === "overdue" && "text-danger")}>
              {r.kind === "overdue" ? STATUS_COPY.needsOverdue : STATUS_COPY.needsAnswered}:{" "}
              {r.title}
            </span>
            <span className="block text-sm text-muted-foreground">
              {r.home} · {r.line}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </>
  );
}
