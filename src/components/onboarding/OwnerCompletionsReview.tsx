import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState, LoadingRows } from "@/components/ui/page";
import { usDate } from "@/lib/dates";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OpportunityDetail, useOwnerCollaboration } from "@/components/onboarding/OwnerCollaboration";

export type CompletionRow = {
  work_item_id: string;
  property_id: string;
  property_name: string | null;
  title: string;
  owner_name: string;
  completed_at: string | null;
  responsible_id: string | null;
  responsible_name: string | null;
  assignment_exception: boolean;
  evidence_count: number;
  latest_feedback: string | null;
  latest_feedback_at: string | null;
  review_status: "needs_review" | "follow_up_needed" | "reviewed";
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  latest_internal_note: string | null;
  follow_up_task_id: string | null;
  new_owner_activity: boolean;
  source_task_id: string | null;
};

export const REVIEW_LABEL: Record<CompletionRow["review_status"], string> = {
  needs_review: "Needs review",
  follow_up_needed: "Follow-up needed",
  reviewed: "Reviewed",
};

export function useOwnerCompletions(demoMode: boolean, propertyId?: string) {
  return useQuery({
    queryKey: ["owner-completions", demoMode, propertyId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_completions_for_review", {
        _demo: demoMode,
        ...(propertyId ? { _property: propertyId } : {}),
      });
      if (error) throw error;
      return (data ?? []) as CompletionRow[];
    },
  });
}

/** Rows that need staff attention: not yet reviewed, follow-up open, or new owner activity since review. */
export function needsAttention(r: CompletionRow) {
  return r.review_status !== "reviewed" || r.new_owner_activity;
}

export function OwnerCompletionsReview({ demoMode, propertyId }: { demoMode: boolean; propertyId?: string }) {
  const q = useOwnerCompletions(demoMode, propertyId);
  const [filter, setFilter] = useState<"open" | "all">("open");
  if (q.isLoading) return <LoadingRows />;
  if (q.error) return <p className="text-sm text-destructive">Owner completions could not be loaded.</p>;
  const all = q.data ?? [];
  const rows = filter === "open" ? all.filter(needsAttention) : all;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>
          To review ({all.filter(needsAttention).length})
        </Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All completions ({all.length})
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Staff follow-through only. The owner's completion stays recorded and participation counts immediately; ARHA does not approve owner hours or participation, and review never blocks handoff.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Nothing to review" hint="Owner-completed Opportunities appear here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <CompletionCard key={r.work_item_id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CompletionCard({ row: r }: { row: CompletionRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [taskId, setTaskId] = useState("");
  const tasks = useQuery({
    queryKey: ["onb-tasks-lite", r.property_id],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_tasks").select("id, title").eq("property_id", r.property_id).is("archived_at", null).order("title");
      return data ?? [];
    },
  });
  const save = useMutation({
    mutationFn: async (status: CompletionRow["review_status"]) => {
      const { error } = await supabase.rpc("record_owner_completion_review", {
        _id: r.work_item_id,
        _status: status,
        _internal_note: note || undefined,
        _follow_up_task_id: taskId || undefined,
        _owner_feedback: feedback || undefined,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review recorded.");
      setNote(""); setFeedback(""); setTaskId(""); setOpen(false);
      void qc.invalidateQueries({ queryKey: ["owner-completions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="font-medium">{r.title}</p>
          <p className="text-muted-foreground">
            <Link to="/onboarding/$propertyId" params={{ propertyId: r.property_id }} search={{ tab: "work" } as never} className="hover:underline">
              {r.property_name ?? "Home"}
            </Link>
            {" · "}{r.owner_name} completed {r.completed_at ? usDate(r.completed_at) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Responsible: {r.assignment_exception ? <span className="text-destructive">No Primary PM — Onboarding Director to assign</span> : r.responsible_name ?? "—"}
            {" · "}Evidence: {r.evidence_count} item{r.evidence_count === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">{REVIEW_LABEL[r.review_status]}</span>
          {r.new_owner_activity ? <span className="text-xs font-medium text-primary">New owner activity since review</span> : null}
        </div>
      </div>
      <p className="mt-2 rounded bg-muted/50 p-2 text-xs">
        <span className="font-medium">Latest owner feedback: </span>
        {r.latest_feedback ? `“${r.latest_feedback}”` : "None given."}
        {r.latest_feedback_at ? <span className="text-muted-foreground"> · {usDate(r.latest_feedback_at)}</span> : null}
      </p>
      {r.reviewed_at ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Last review: {REVIEW_LABEL[r.review_status]} by {r.reviewed_by_name ?? "staff"} on {usDate(r.reviewed_at)}
          {r.latest_internal_note ? ` · Internal note: ${r.latest_internal_note}` : ""}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setViewing(true)}>
          Open evidence and thread
        </button>
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Record review"}
        </button>
      </div>
      {open ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div>
            <Label htmlFor={`note-${r.work_item_id}`}>Internal note (staff only — never shown to the owner)</Label>
            <Textarea id={`note-${r.work_item_id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`task-${r.work_item_id}`}>Follow-up Task (only if action is needed)</Label>
            <select id={`task-${r.work_item_id}`} className="h-9 w-full rounded-md border border-input bg-background px-2" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">No linked Task</option>
              {(tasks.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor={`fb-${r.work_item_id}`}>Feedback to the owner (optional — the owner will see this)</Label>
            <Textarea id={`fb-${r.work_item_id}`} rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate("reviewed")}>Mark reviewed</Button>
            <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate("follow_up_needed")}>Follow-up needed</Button>
            {r.review_status !== "needs_review" ? (
              <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => save.mutate("needs_review")}>Return to needs review</Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <EvidenceDialog open={viewing} onClose={() => setViewing(false)} propertyId={r.property_id} workItemId={r.work_item_id} title={r.title} />
    </li>
  );
}

/**
 * Read-only view of one owner Opportunity: conversation and attachments.
 * Opening it never reopens the Opportunity, changes hours or records a review;
 * closing it leaves the review list exactly where it was.
 */
function EvidenceDialog({ open, onClose, propertyId, workItemId, title }: { open: boolean; onClose: () => void; propertyId: string; workItemId: string; title: string }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Owner conversation and evidence. Viewing does not change the Opportunity or your review.</DialogDescription>
        </DialogHeader>
        {open ? <EvidenceBody propertyId={propertyId} workItemId={workItemId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EvidenceBody({ propertyId, workItemId }: { propertyId: string; workItemId: string }) {
  const q = useOwnerCollaboration(propertyId);
  if (q.isLoading) return <LoadingRows />;
  if (q.error) return <p className="text-sm text-destructive">This Opportunity could not be loaded.</p>;
  const o = q.data?.opportunities.find((x) => x.id === workItemId);
  if (!o) return <p className="text-sm text-muted-foreground">This Opportunity is not available to you.</p>;
  const files = q.data?.files ?? [];
  return (
    <div className="space-y-2">
      {files.some((f) => f.workItemId === o.id) ? null : <p className="text-xs text-muted-foreground">No files attached.</p>}
      <OpportunityDetail o={o} files={files} readOnly />
    </div>
  );
}
