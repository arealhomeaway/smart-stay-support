/**
 * What a generated routine is about: the Breezeway work order behind a
 * Maintenance Review, or the survey answers behind a Survey Review. Read-only
 * views of data already in Resolve. Nothing here writes back to Breezeway.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usDate } from "@/lib/dates";
import { breezewayTaskLink } from "@/lib/breezeway-bridge";
import {
  maintenanceReviewWorkOrderId,
  surveyReviewFeedbackId,
} from "@/lib/routine-controls";

export function RoutineSourceDetails({
  row,
}: {
  row: { id: string; kind: string; status: string; event_key?: string | null; draft?: unknown };
}) {
  if (row.kind === "maintenance_review") return <MaintenanceDetails row={row} />;
  if (row.kind === "survey_review") return <SurveyDetails eventKey={row.event_key ?? null} />;
  return null;
}

function MaintenanceDetails({
  row,
}: {
  row: { id: string; status: string; event_key?: string | null; draft?: unknown };
}) {
  const qc = useQueryClient();
  const woId = maintenanceReviewWorkOrderId(row.event_key);
  const [again, setAgain] = useState("");
  const { data } = useQuery({
    queryKey: ["maintenance-review-source", woId],
    enabled: Boolean(woId),
    queryFn: async () => {
      const [wo, comments, photos] = await Promise.all([
        supabase
          .from("breezeway_work_orders")
          .select("name, description, status, scheduled_date, finished_at, assignees, last_synced_at, breezeway_task_id, report_url")
          .eq("id", woId!)
          .maybeSingle(),
        supabase
          .from("breezeway_work_order_comments")
          .select("id, author, body, commented_at")
          .eq("work_order_id", woId!)
          .order("commented_at", { ascending: true })
          .limit(50),
        supabase
          .from("breezeway_work_order_photos")
          .select("id, url, caption")
          .eq("work_order_id", woId!)
          .limit(40),
      ]);
      return { wo: wo.data, comments: comments.data ?? [], photos: photos.data ?? [] };
    },
  });

  const reschedule = useMutation({
    mutationFn: async () => {
      if (!again) throw new Error("Pick a date first.");
      const { error } = await supabase
        .from("routine_controls")
        .update({ due_at: new Date(`${again}T09:00:00`).toISOString(), status: "in_progress" })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routine-controls"] });
      toast.success("We will bring this back on that date.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!woId) return null;
  const wo = data?.wo;
  const assignees = Array.isArray(wo?.assignees)
    ? (wo!.assignees as Array<{ name?: string }>).map((a) => a?.name).filter(Boolean).join(", ")
    : "";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <p className="font-semibold">Breezeway work order</p>
      {wo ? (
        <>
          <p>{wo.name}</p>
          {wo.description && <p className="whitespace-pre-line text-muted-foreground">{wo.description}</p>}
          <p className="text-xs text-muted-foreground">
            Breezeway status: {wo.status}
            {wo.finished_at ? ` · Finished ${usDate(wo.finished_at)}` : ""}
            {assignees ? ` · ${assignees}` : ""}
          </p>
          {/* One warning only: the check's own notice says Finished is not our review (Build 16 D). */}
          {wo.breezeway_task_id ? (
            <Button asChild variant="outline" className="min-h-11">
              <a
                href={breezewayTaskLink(wo.breezeway_task_id, (wo as { report_url?: string | null }).report_url ?? null)}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open in Breezeway
              </a>
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground">Loading the work order…</p>
      )}
      <div className="space-y-1">
        <p className="font-medium">Vendor notes</p>
        {data?.comments.length ? (
          data.comments.map((c) => (
            <p key={c.id} className="whitespace-pre-line">
              {/* The vendor's name shows once: in the status line, not again on each of their notes. */}
              {c.author && assignees.split(", ").includes(c.author) ? null : (
                <span className="text-muted-foreground">{c.author ?? "Note"}: </span>
              )}
              {c.body}
            </p>
          ))
        ) : (
          <p className="text-muted-foreground">No notes were left on this work order.</p>
        )}
      </div>
      <div className="space-y-1">
        <p className="font-medium">Completion photos</p>
        {data?.photos.length ? (
          <div className="grid grid-cols-3 gap-2">
            {data.photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                <img src={p.url} alt={p.caption ?? "Completion photo"} className="aspect-square w-full rounded object-cover" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No photos are in Resolve for this work order.</p>
        )}
      </div>
      {row.status !== "completed" && !row.draft && (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="space-y-1">
            <Label htmlFor="review-again">Review again on</Label>
            <Input id="review-again" type="date" value={again} onChange={(e) => setAgain(e.target.value)} className="h-9 w-44" />
          </div>
          <Button variant="outline" className="h-9" disabled={reschedule.isPending} onClick={() => reschedule.mutate()}>
            Set review date
          </Button>
        </div>
      )}
    </div>
  );
}

function SurveyDetails({ eventKey }: { eventKey: string | null }) {
  const feedbackId = surveyReviewFeedbackId(eventKey);
  const { data } = useQuery({
    queryKey: ["survey-review-source", feedbackId],
    enabled: Boolean(feedbackId),
    queryFn: async () => {
      const { data } = await supabase
        .from("guest_survey_responses")
        .select("answers, had_issues, follow_up_permission")
        .eq("feedback_id", feedbackId!)
        .maybeSingle();
      return data;
    },
  });
  if (!feedbackId) return null;
  const answers =
    data?.answers && typeof data.answers === "object" && !Array.isArray(data.answers)
      ? Object.entries(data.answers as Record<string, unknown>)
      : [];
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <p className="font-semibold">Survey answers</p>
      {data?.had_issues != null && <p>Guest reported a problem: {data.had_issues ? "Yes" : "No"}</p>}
      {data?.follow_up_permission != null && (
        <p>OK to contact the guest: {data.follow_up_permission ? "Yes" : "No"}</p>
      )}
      {answers.length === 0 ? (
        <p className="text-muted-foreground">No written answers.</p>
      ) : (
        answers.map(([q, a]) => (
          <p key={q}>
            <span className="text-muted-foreground">{q}: </span>
            {typeof a === "string" || typeof a === "number" || typeof a === "boolean" ? String(a) : JSON.stringify(a)}
          </p>
        ))
      )}
    </div>
  );
}
