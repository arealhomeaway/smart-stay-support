import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useTicketDrawer } from "@/components/nav/TicketDrawer";
import {
  CONTACT_OUTCOMES,
  FOLLOWUP_OUTCOMES,
  ISSUE_CATEGORIES,
  outcomeNeedsLinkedWork,
} from "@/lib/guest-feedback";
import { usDate as formatDate } from "@/lib/dates";
import {
  RatingStars,
  RepeatIssueNotes,
  SurveyAnswersView,
  stayText,
  usePropertyFeedback,
  type FeedbackRow,
} from "./FeedbackShared";

/**
 * Shown on a Guest Feedback Follow-Up Ticket. The Survey/Review stays its own
 * record; this panel guides the prior-guest follow-up and links any new work.
 */
export function GuestFeedbackFollowUpPanel({ feedbackId, readOnly }: { feedbackId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const drawer = useTicketDrawer();
  const fbq = useQuery({
    queryKey: ["guest-feedback", feedbackId],
    queryFn: async () => {
      const [{ data: fb, error }, { data: linked }] = await Promise.all([
        supabase.from("guest_feedback").select("*").eq("id", feedbackId).maybeSingle(),
        supabase.from("tickets").select("id, ref, title, status, entry_kind").eq("linked_feedback_id", feedbackId).is("archived_at", null).order("created_at"),
      ]);
      if (error) throw error;
      return { fb: fb as FeedbackRow | null, linked: linked ?? [] };
    },
  });
  const fb = fbq.data?.fb ?? null;
  const all = usePropertyFeedback(fb?.property_id);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!fb) return;
    setOutcome(fb.contact_outcome);
    setNotes(fb.contact_notes ?? "");
    setCats(fb.issue_categories ?? []);
    setResult(fb.followup_outcome);
  }, [fb?.id, fb?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fb) return null;
  const done = !!fb.followup_completed_at;
  const isSurvey = fb.feedback_type === "internal_survey";
  const locked = readOnly || done;

  const save = async (patch: Record<string, unknown>, msg: string) => {
    setSaving(true);
    const { error } = await supabase.from("guest_feedback").update(patch as never).eq("id", fb.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(msg);
    await qc.invalidateQueries({ queryKey: ["guest-feedback"] });
  };

  const linkedNeeded = outcomeNeedsLinkedWork(result);
  const canComplete = !!outcome && !!result && (!linkedNeeded || (fbq.data?.linked.length ?? 0) > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {isSurvey ? "Guest Survey" : `${fb.booking_platform ?? "External"} Review`}
          <RatingStars rating={fb.rating} />
          {done ? <Badge>Follow-up complete</Badge> : <Badge variant="outline">Follow-up open</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Prior guest: {fb.guest_name ?? "Not provided"} · {stayText(fb)}
          {fb.ownerrez_booking_id && fb.reservation_match === "matched" && !fb.ownerrez_booking_id.startsWith("demo") ? ` · Reservation ${fb.ownerrez_booking_id}` : ""}
          {" · "}Submitted {formatDate(fb.submitted_at)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSurvey ? (
          <SurveyAnswersView feedbackId={fb.id} />
        ) : (
          <div className="space-y-2 text-sm">
            {fb.summary ? <p className="whitespace-pre-wrap">{fb.summary}</p> : <p className="text-muted-foreground">No review text.</p>}
            {fb.response_text && <p className="text-muted-foreground">Our public reply: {fb.response_text}</p>}
          </div>
        )}
        <RepeatIssueNotes current={fb} all={all.data ?? []} />

        <ol className="space-y-4 border-t border-border pt-4">
          <li className="space-y-2">
            <Label>1–2. Contact the prior guest, then record the outcome</Label>
            <div className="flex flex-wrap gap-2">
              {CONTACT_OUTCOMES.map((o) => (
                <Button key={o.value} size="sm" type="button" disabled={locked} variant={outcome === o.value ? "default" : "outline"} onClick={() => setOutcome(o.value)}>
                  {o.label}
                </Button>
              ))}
            </div>
          </li>
          <li className="space-y-2">
            <Label htmlFor="fb-notes">3. What the guest said</Label>
            <Textarea id="fb-notes" value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} placeholder="Conversation notes" />
          </li>
          <li className="space-y-2">
            <Label>4. Issue categories</Label>
            <div className="flex flex-wrap gap-2">
              {ISSUE_CATEGORIES.map((c) => {
                const on = cats.includes(c);
                return (
                  <Button key={c} size="sm" type="button" aria-pressed={on} disabled={locked} variant={on ? "default" : "outline"} onClick={() => setCats(on ? cats.filter((x) => x !== c) : [...cats, c])}>
                    {c}
                  </Button>
                );
              })}
            </div>
          </li>
          {!locked && (
            <Button
              size="sm"
              variant="secondary"
              disabled={saving}
              onClick={() => save({ contact_outcome: outcome, contact_notes: notes.trim() || null, issue_categories: cats }, "Follow-up notes saved")}
            >
              Save contact notes
            </Button>
          )}
          <li className="space-y-2">
            <Label>5. Outcome</Label>
            <div className="flex flex-wrap gap-2">
              {FOLLOWUP_OUTCOMES.map((o) => (
                <Button key={o.value} size="sm" type="button" disabled={locked} variant={result === o.value ? "default" : "outline"} onClick={() => setResult(o.value)}>
                  {o.label}
                </Button>
              ))}
            </div>
          </li>
          {(linkedNeeded || (fbq.data?.linked.length ?? 0) > 0) && (
            <li className="space-y-2">
              <Label>6. Linked operational work</Label>
              {(fbq.data?.linked ?? []).map((t) => (
                <div key={t.id} className="text-sm">
                  <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="text-primary hover:underline">
                    #{t.ref} {t.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">({t.entry_kind === "maintenance" ? "Maintenance" : "Ops Ticket"} · {t.status})</span>
                </div>
              ))}
              {!locked && fb.property_id && (
                <div className="flex flex-wrap gap-2">
                  {(["ops", "maintenance"] as const).map((kind) => {
                    const existing = (fbq.data?.linked ?? []).find((t) => (t.entry_kind ?? "ops") === kind);
                    if (existing) return null; // one linked Ticket per kind; open it from the list above
                    return (
                      <Button key={kind} size="sm" variant="outline" onClick={() => drawer?.openNewTicket({ property: fb.property_id!, kind, feedback: fb.id })}>
                        {kind === "ops" ? "Create linked Ops Ticket" : "Report linked Maintenance"}
                      </Button>
                    );
                  })}
                </div>
              )}
            </li>
          )}
          <li className="space-y-2">
            <Label>7. Complete feedback follow-up</Label>
            {done ? (
              <p className="text-sm text-muted-foreground">Completed {formatDate(fb.followup_completed_at!)}. Resolve and close this Ticket as usual.</p>
            ) : (
              <>
                {!canComplete && (
                  <p className="text-xs text-muted-foreground">
                    {linkedNeeded ? "Record the contact outcome and create the linked work first." : "Record the contact outcome and the outcome first."}
                  </p>
                )}
                <Button
                  size="sm"
                  disabled={readOnly || saving || !canComplete}
                  onClick={async () => {
                    const { data: u } = await supabase.auth.getUser();
                    await save(
                      {
                        contact_outcome: outcome,
                        contact_notes: notes.trim() || null,
                        issue_categories: cats,
                        followup_outcome: result,
                        followup_completed_at: new Date().toISOString(),
                        followup_completed_by: u.user?.id ?? null,
                        follow_up_status: "completed",
                      },
                      "Feedback follow-up completed",
                    );
                  }}
                >
                  Complete feedback follow-up
                </Button>
              </>
            )}
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}
