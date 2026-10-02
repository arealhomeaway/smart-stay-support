import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { RATED_QUESTIONS, repeatIssues, repeatIssueText, type SurveyAnswers } from "@/lib/guest-feedback";
import { usDate as formatDate } from "@/lib/dates";

export type FeedbackRow = {
  id: string;
  feedback_type: string;
  property_id: string | null;
  ownerrez_booking_id: string | null;
  reservation_match: string;
  guest_name: string | null;
  reviewer_display_name?: string | null;
  reservation_guest_name?: string | null;
  reservation_confirmation?: string | null;
  rating: number | null;
  summary: string | null;
  response_text: string | null;
  source_url: string | null;
  submitted_at: string;
  stay_start: string | null;
  stay_end: string | null;
  booking_platform: string | null;
  issue_categories: string[];
  follow_up_status: string;
  ticket_id: string | null;
  contact_outcome: string | null;
  contact_notes: string | null;
  followup_outcome: string | null;
  followup_completed_at: string | null;
  updated_at: string;
};

export function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground">No rating</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-3.5 w-3.5 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
      ))}
    </span>
  );
}

export function followUpLabel(s: string) {
  return s === "open" ? "Follow-up open" : s === "completed" ? "Follow-up complete" : "No follow-up needed";
}

export function stayText(f: Pick<FeedbackRow, "stay_start" | "stay_end" | "reservation_match">) {
  if (f.reservation_match === "unmatched") return "Reservation not matched";
  if (!f.stay_end) return "Stay unknown";
  return f.stay_start ? `${formatDate(f.stay_start)} – ${formatDate(f.stay_end)}` : `Checked out ${formatDate(f.stay_end)}`;
}

/** Property feedback used for repeat-issue counts. */
export function usePropertyFeedback(propertyId: string | null | undefined) {
  return useQuery({
    queryKey: ["guest-feedback", "property", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_feedback")
        .select("*")
        .eq("property_id", propertyId!)
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });
}

export function RepeatIssueNotes({ current, all }: { current: FeedbackRow; all: FeedbackRow[] }) {
  const reps = repeatIssues(current, all);
  if (reps.length === 0) return null;
  return (
    <ul className="space-y-1">
      {reps.map((r) => (
        <li key={r.category} className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
          {repeatIssueText(r)}
        </li>
      ))}
    </ul>
  );
}

const SEVERITY: Record<string, string> = { minor: "Minor", moderate: "Moderate", major: "Major" };
const YN: Record<string, string> = { yes: "Yes", no: "No", partly: "Partly" };

/** Read-only survey answers, laid out the way the guest answered them. */
export function SurveyAnswersView({ feedbackId }: { feedbackId: string }) {
  const q = useQuery({
    queryKey: ["guest-survey-answers", feedbackId],
    queryFn: async () => {
      const { data } = await supabase.from("guest_survey_responses").select("*").eq("feedback_id", feedbackId).maybeSingle();
      return data;
    },
  });
  const a = q.data?.answers as SurveyAnswers | undefined;
  if (!a) return null;
  const row = (l: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1 text-sm last:border-0">
      <span className="text-muted-foreground">{l}</span>
      <span className="text-right">{v}</span>
    </div>
  );
  return (
    <div>
      {row("Overall", <RatingStars rating={a.overall} />)}
      {row("Likely to stay again", `${a.stay_again} / 5`)}
      {RATED_QUESTIONS.map((rq) => (a[rq.key] ? <div key={rq.key}>{row(rq.label, <RatingStars rating={a[rq.key]!} />)}</div> : null))}
      {row("Issues during stay", a.had_issues ? "Yes" : "No")}
      {a.had_issues && a.severity && row("Severity", SEVERITY[a.severity])}
      {a.had_issues && a.issue_categories?.length ? row("Categories", a.issue_categories.join(", ")) : null}
      {a.had_issues && a.reported_during_stay && row("Told us during the stay", YN[a.reported_during_stay])}
      {a.resolved_satisfactorily && row("Resolved to their satisfaction", YN[a.resolved_satisfactorily])}
      {a.issue_description && <Quote label="What happened">{a.issue_description}</Quote>}
      {a.improve_before_checkout && <Quote label="What we could have done before checkout">{a.improve_before_checkout}</Quote>}
      {a.comments && <Quote label="Other comments">{a.comments}</Quote>}
      {row("OK to contact them", a.follow_up_ok ? "Yes" : <Badge variant="outline">No — do not contact</Badge>)}
    </div>
  );
}

function Quote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{children}</p>
    </div>
  );
}
