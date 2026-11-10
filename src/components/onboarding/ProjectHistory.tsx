/**
 * Project History — what actually happened to this onboarding project.
 *
 * History is an audit story, not a notes page: recorded lifecycle events from
 * `onboarding_project_events` merged with the events other records already
 * prove (task completions and reopens, homeowner decisions, handoff reviews).
 * Read-only. Internal notes live beside it, clearly separated.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Chip } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
import { getPropertyProject } from "@/lib/onboarding.functions";
import type { WorkflowTask } from "@/lib/onboarding-workflow";
import { usDateTime } from "@/lib/dates";

type Person = { id: string; full_name: string | null; email: string | null };

export type HistoryApproval = {
  id: string;
  entity_id: string | null;
  title: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
};

export type HistoryReview = {
  id: string;
  handoff_id: string;
  gate_step?: string | null;
  decision: string;
  notes: string | null;
  created_at: string;
  reviewer_id?: string | null;
};

type Entry = {
  at: string;
  kind: string;
  summary: string;
  detail: string | null;
  actor: string | null;
};

const KIND_LABEL: Record<string, string> = {
  project_started: "Onboarding started",
  scope_changed: "Scope changed",
  task_completed: "Task completed",
  task_reopened: "Task reopened",
  owner_approval_requested: "Owner approval requested",
  owner_decision: "Owner decision",
  fact_decision: "Permanent fact reviewed",
  correction: "Correction",
  handoff_submitted: "Handoff submitted",
  handoff_review: "Handoff review",
  handoff_accepted: "Operations accepted",
  live_confirmed: "Live confirmed",
  project_detail_changed: "Status change",
  committed_handoff_corrected: "Date corrected",
  comment: "Comment",
  upload: "Upload",
};

/** A note or comment on the home (Activity tab). */
export type HistoryNote = { id: string; body: string; created_at: string; author_id?: string | null; task_id?: string | null };
/** A file added to the home (Activity tab). */
export type HistoryUpload = { id: string; title: string; created_at: string; uploaded_by_name?: string | null; category_label?: string | null };

export function ProjectHistory({
  propertyId,
  tasks,
  approvals,
  reviews,
  people,
  notes = [],
  uploads = [],
  title = "History",
  description = "Every lifecycle event on this project, newest first. History is a record. It cannot be edited.",
}: {
  propertyId: string;
  tasks: WorkflowTask[];
  approvals: HistoryApproval[];
  reviews: HistoryReview[];
  people: Person[];
  /** Comments and uploads join the same newest-first list when given. */
  notes?: HistoryNote[] | undefined;
  uploads?: HistoryUpload[] | undefined;
  title?: string | undefined;
  description?: string | undefined;
}) {
  const load = useServerFn(getPropertyProject);
  const { data } = useQuery({
    queryKey: ["onboarding-project", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });

  const nameOf = (id: string | null | undefined) => {
    if (!id) return null;
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Teammate";
  };

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];

    for (const e of (data?.events ?? []) as {
      id: string;
      kind: string;
      summary: string;
      detail: string | null;
      prior_value?: string | null;
      new_value?: string | null;
      actor?: string | null;
      created_at: string;
    }[]) {
      out.push({
        at: e.created_at,
        kind: e.kind,
        summary: e.summary,
        detail:
          e.detail ??
          (e.prior_value || e.new_value ? `${e.prior_value ?? "Not set"} to ${e.new_value ?? "Not set"}` : null),
        actor: nameOf(e.actor ?? null),
      });
    }

    for (const t of tasks) {
      if (t.completed_at && t.status === "complete")
        out.push({
          at: t.completed_at,
          kind: "task_completed",
          summary: `Completed "${t.title}"`,
          detail: t.evidence_note ? `Evidence: ${t.evidence_note}` : null,
          actor: nameOf(t.assigned_to),
        });
    }

    for (const a of approvals) {
      out.push({
        at: a.created_at,
        kind: "owner_approval_requested",
        summary: `Owner approval requested: ${a.title}`,
        detail: null,
        actor: null,
      });
      if (a.decided_at)
        out.push({
          at: a.decided_at,
          kind: "owner_decision",
          summary: `Homeowner ${a.status === "approved" ? "approved" : "requested changes"} · ${a.title}`,
          detail: a.decision_note,
          actor: "Homeowner",
        });
    }

    for (const r of reviews) {
      out.push({
        at: r.created_at,
        kind:
          r.decision === "accepted"
            ? "handoff_accepted"
            : r.decision === "live"
              ? "live_confirmed"
              : "handoff_review",
        summary: `Handoff review: ${r.decision.replace(/_/g, " ")}`,
        detail: r.notes,
        actor: nameOf(r.reviewer_id ?? null),
      });
    }

    for (const n of notes) {
      out.push({ at: n.created_at, kind: "comment", summary: n.body, detail: null, actor: nameOf(n.author_id ?? null) });
    }

    for (const u of uploads) {
      out.push({
        at: u.created_at,
        kind: "upload",
        summary: `Added "${u.title}"`,
        detail: u.category_label ?? null,
        actor: u.uploaded_by_name ?? null,
      });
    }

    return out.sort((a, b) => b.at.localeCompare(a.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tasks, approvals, reviews, people, notes, uploads]);

  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-border bg-muted/40 px-3 py-2">
        <p className="text-sm font-semibold">
          {title} <span className="numeric text-muted-foreground">({entries.length})</span>
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {entries.length === 0 && (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          Nothing has happened on this project yet.
        </p>
      )}
      {entries.map((e, i) => (
        <div key={`${e.at}-${i}`} className="border-b border-border/60 px-3 py-2 last:border-b-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={stateChip("info")}>
              {KIND_LABEL[e.kind] ?? e.kind.replace(/_/g, " ")}
            </Chip>
            <span className="min-w-0 flex-1 text-sm font-medium">{e.summary}</span>
            <span className="numeric text-xs text-muted-foreground">{usDateTime(e.at)}</span>
          </div>
          {e.detail && <p className="pt-1 text-xs text-muted-foreground">{e.detail}</p>}
          {e.actor && <p className="text-xs text-muted-foreground">by {e.actor}</p>}
        </div>
      ))}
    </section>
  );
}
