/**
 * Review status inside the Task drawer: reviewers, due time, Approve / Send back / Edit,
 * and history. Steps without review settings render nothing and keep the normal Complete button.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { useRole } from "@/hooks/useRole";
import { roleLabel } from "@/lib/v2-workflow.functions";
import { decideTaskReview, readTaskReviewState, recordReviewEdit, submitTaskReview } from "@/lib/onboarding-reviews.functions";
import { REVIEW_EVENT_LABEL, REVIEW_STATUS_LABEL, reviewAction, waitingLabel } from "@/lib/onboarding-reviews";
import { usDateTime } from "@/lib/dates";
import { canDecideStepReview } from "@/lib/home-context";
import { supabase } from "@/integrations/supabase/client";

const key = (taskId: string) => ["task-review", taskId];

/** Staged file 06: an Admin decides any step review once the database allows it (missing function = not yet). */
function useAdminChecksOn(isAdmin: boolean) {
  const q = useQuery({
    queryKey: ["admin-passes-role-checks"],
    enabled: isAdmin,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (name: string) => Promise<{ data: boolean | null; error: unknown }>)("admin_passes_role_checks");
      return !error && data === true;
    },
  });
  return isAdmin && q.data === true;
}

export function useTaskReview(taskId: string) {
  const read = useServerFn(readTaskReviewState);
  return useQuery({ queryKey: key(taskId), queryFn: () => read({ data: { taskId } }), retry: false });
}

function useRefresh(taskId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: key(taskId) });
    void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
    void qc.invalidateQueries({ queryKey: ["my-reviews"] });
    void qc.invalidateQueries();
  };
}

/** Replaces Complete with Submit for review on reviewed steps; shows held-back steps. */
export function ReviewAwareComplete({ taskId, disabled, children }: { taskId: string; disabled: boolean; children: ReactNode }) {
  const q = useTaskReview(taskId);
  const refresh = useRefresh(taskId);
  const submit = useServerFn(submitTaskReview);
  const m = useMutation({
    mutationFn: () => submit({ data: { taskId } }),
    onSuccess: (r) => {
      toast.success(r.status === "skipped" ? "Done. No second look needed." : "Submitted for review.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const waiting = waitingLabel(q.data?.blocked_by);
  const action = reviewAction(q.data);
  if (waiting) {
    return (
      <div className="flex flex-1 flex-col gap-1">
        <Button className="w-full" disabled>Complete</Button>
        <p className="text-xs text-muted-foreground">{waiting}</p>
      </div>
    );
  }
  if (action === "complete" || action === "done") return <>{children}</>;
  return (
    <div className="flex flex-1 flex-col gap-1">
      <Button className="w-full" disabled={disabled || m.isPending || action === "waiting"} onClick={() => m.mutate()}>
        {action === "waiting" ? "Waiting for review" : q.data?.review?.status === "changes_requested" ? "Resubmit for review" : "Submit for review"}
      </Button>
    </div>
  );
}

export function TaskReviewPanel({ taskId }: { taskId: string }) {
  const q = useTaskReview(taskId);
  const { userId, isAdmin } = useRole();
  const adminChecksOn = useAdminChecksOn(isAdmin);
  const refresh = useRefresh(taskId);
  const decide = useServerFn(decideTaskReview);
  const edit = useServerFn(recordReviewEdit);
  const [mode, setMode] = useState<"none" | "back" | "edit">("none");
  const [note, setNote] = useState("");
  const done = (msg: string) => {
    toast.success(msg);
    setMode("none");
    setNote("");
    refresh();
  };
  const onError = (e: Error) => toast.error(e.message);
  const approve = useMutation({ mutationFn: (id: string) => decide({ data: { reviewId: id, decision: "approved" } }), onSuccess: () => done("Approved."), onError });
  const back = useMutation({ mutationFn: (id: string) => decide({ data: { reviewId: id, decision: "sent_back", note } }), onSuccess: () => done("Sent back to the step owner."), onError });
  const edited = useMutation({ mutationFn: (id: string) => edit({ data: { reviewId: id, note } }), onSuccess: () => done("Edit recorded."), onError });

  const s = q.data;
  if (!s || (!s.enabled && !s.review)) return null;
  const rv = s.review;
  const pending = rv?.status === "pending";
  const mine = pending && canDecideStepReview(userId, s.reviewers, isAdmin, adminChecksOn);

  return (
    <section className="space-y-2 rounded-md border border-border p-3" aria-label="Review">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Review</p>
        <Chip>{rv ? REVIEW_STATUS_LABEL[rv.status] : "Not submitted yet"}</Chip>
        {pending && rv?.due_at ? <span className="text-xs text-muted-foreground">Due {usDateTime(rv.due_at)}</span> : null}
      </div>
      <ul className="space-y-0.5 text-sm">
        {s.reviewers.map((r) => (
          <li key={r.role}>
            {roleLabel(r.role)}: {r.name ?? "Nobody assigned"}
            {r.decision ? <span className="text-muted-foreground"> ({r.decision === "approved" ? "approved" : "sent back"})</span> : null}
          </li>
        ))}
      </ul>
      {mine && rv ? (
        mode === "none" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setMode("back")}>Send back</Button>
            <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate(rv.id)}>Approve</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("edit")}>Edit directly</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={mode === "back" ? "What needs to change?" : "What did you change?"} />
            <div className="flex gap-2">
              {mode === "back" ? (
                <Button size="sm" disabled={note.trim().length < 3 || back.isPending} onClick={() => back.mutate(rv.id)}>Send back</Button>
              ) : (
                <Button size="sm" disabled={note.trim().length < 3 || edited.isPending} onClick={() => edited.mutate(rv.id)}>Record edit</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setMode("none")}>Cancel</Button>
            </div>
            {mode === "edit" ? <p className="text-xs text-muted-foreground">Make your changes on the Task or its files, then record what you changed. You can still approve afterward.</p> : null}
          </div>
        )
      ) : null}
      {s.history.length ? (
        <ol className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
          {s.history.map((h, i) => (
            <li key={i}>
              {usDateTime(h.at)}: {h.kind === "skipped" && h.note ? h.note : `${REVIEW_EVENT_LABEL[h.kind] ?? h.kind} by ${h.by}`}
              {h.role ? ` (${roleLabel(h.role)})` : ""}
              {h.note && h.kind !== "skipped" ? `: ${h.note}` : ""}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
