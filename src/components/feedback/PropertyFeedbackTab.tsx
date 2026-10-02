import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTicketDrawer } from "@/components/nav/TicketDrawer";
import { addTestReview, createTestSurveyLink, syncOwnerRezReviews } from "@/lib/guest-feedback.functions";
import { usDate as formatDate } from "@/lib/dates";
import {
  RatingStars,
  RepeatIssueNotes,
  SurveyAnswersView,
  followUpLabel,
  stayText,
  usePropertyFeedback,
  type FeedbackRow,
} from "./FeedbackShared";

/**
 * Property history for one kind of guest feedback. Surveys (private, from the
 * Resolve survey) and Reviews (public, from OwnerRez) are never mixed.
 */
export function PropertyFeedbackTab({
  propertyId,
  kind,
  isDemo,
  isSupervisor,
}: {
  propertyId: string;
  kind: "internal_survey" | "external_review";
  isDemo: boolean;
  isSupervisor: boolean;
}) {
  const q = usePropertyFeedback(propertyId);
  const rows = (q.data ?? []).filter((f) => f.feedback_type === kind);
  const [open, setOpen] = useState<FeedbackRow | null>(null);
  const drawer = useTicketDrawer();
  const isSurvey = kind === "internal_survey";

  return (
    <div className="space-y-4">
      {isSurvey ? <SurveyLinkCard propertyId={propertyId} isDemo={isDemo} /> : <ReviewToolsCard propertyId={propertyId} isDemo={isDemo} isSupervisor={isSupervisor} />}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{isSurvey ? "Guest Surveys" : "Reviews"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isSurvey
              ? "Private feedback guests sent through the A Real Home Away survey. These are not public reviews."
              : "Public reviews from Airbnb, Vrbo and other channels, imported from OwnerRez."}
          </p>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isSurvey ? "No guest surveys yet." : "No reviews imported yet."}</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => setOpen(f)} className="w-full py-3 text-left hover:bg-muted/40">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{formatDate(f.submitted_at)}</span>
                      <RatingStars rating={f.rating} />
                      {!isSurvey && <Badge variant="outline">{f.booking_platform ?? "Unknown source"}</Badge>}
                      <span className="font-medium">{f.guest_name ?? "Guest not provided"}</span>
                      <span className="text-muted-foreground">· {stayText(f)}</span>
                      <Badge variant={f.follow_up_status === "open" ? "default" : "secondary"} className="ml-auto">
                        {followUpLabel(f.follow_up_status)}
                      </Badge>
                    </div>
                    {f.summary && <p className="mt-1 line-clamp-2 text-sm">{f.summary}</p>}
                    {f.issue_categories.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.issue_categories.map((c) => (
                          <Badge key={c} variant="outline" className="text-[11px]">{c}</Badge>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()} className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {isSurvey ? "Guest Survey" : `${open.booking_platform ?? "External"} Review`}
                  <RatingStars rating={open.rating} />
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {open.guest_name ?? "Guest not provided"} · {stayText(open)} · {formatDate(open.submitted_at)}
              </p>
              {isSurvey ? (
                <SurveyAnswersView feedbackId={open.id} />
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="whitespace-pre-wrap">{open.summary ?? "No review text."}</p>
                  {open.response_text && <p className="text-muted-foreground">Our public reply: {open.response_text}</p>}
                  {open.source_url && (
                    <a href={open.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                      View on {open.booking_platform ?? "source"} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
              <RepeatIssueNotes current={open} all={q.data ?? []} />
              {open.ticket_id ? (
                <Link to="/tickets/$ticketId" params={{ ticketId: open.ticket_id }} onClick={(e) => {
                    const id = open.ticket_id!;
                    setOpen(null);
                    if (drawer && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                      e.preventDefault();
                      // Let the survey popup finish closing before layering the Ticket.
                      window.setTimeout(() => drawer.openTicket(id), 350);
                    }
                  }} data-full-page="" className="text-sm text-primary hover:underline">
                  Open the follow-up Ticket
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">No follow-up work — 5-star feedback is kept for history only.</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SurveyLinkCard({ propertyId, isDemo }: { propertyId: string; isDemo: boolean }) {
  const makeTest = useServerFn(createTestSurveyLink);
  const [testLink, setTestLink] = useState<string | null>(null);
  const link = typeof window === "undefined" ? "/guest-feedback" : `${window.location.origin}/guest-feedback`;
  return (
    <Card>
      <CardContent className="space-y-2 pt-4 text-sm">
        <p>
          <span className="font-medium">Survey link for the checkout email:</span>{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">{link}</code>{" "}
          <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Survey link copied"); }}>Copy</Button>
        </p>
        <p className="text-muted-foreground">
          One link for every home. Guests confirm their last name and checkout date. It stays open 14 days after checkout.
        </p>
        {isDemo && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
            <Button size="sm" variant="outline" onClick={async () => { const r = await makeTest({ data: { propertyId } }); setTestLink(`${window.location.origin}/guest-feedback/${r.token}`); }}>
              Create a test survey (demo home)
            </Button>
            {testLink && <a href={testLink} target="_blank" rel="noreferrer" className="break-all text-primary underline">Open test survey</a>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewToolsCard({ propertyId, isDemo, isSupervisor }: { propertyId: string; isDemo: boolean; isSupervisor: boolean }) {
  const qc = useQueryClient();
  const sync = useServerFn(syncOwnerRezReviews);
  const addTest = useServerFn(addTestReview);
  const [busy, setBusy] = useState(false);
  if (!isSupervisor && !isDemo) return null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["guest-feedback"] });
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 pt-4 text-sm">
        {isSupervisor && !isDemo && (
          <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
            setBusy(true);
            try { const r = await sync(); toast.success(`${r.imported} new reviews, ${r.duplicates} already imported, ${r.ticketsCreated} follow-ups created`); await refresh(); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
            setBusy(false);
          }}>
            Import recent reviews from OwnerRez
          </Button>
        )}
        {isDemo && (
          <>
            <span className="text-muted-foreground">Test reviews (demo home):</span>
            {[5, 3].map((stars) => (
              <Button key={stars} size="sm" variant="outline" disabled={busy} onClick={async () => {
                setBusy(true);
                const id = crypto.randomUUID().slice(0, 8);
                const r = await addTest({ data: { propertyId, reviewId: id, stars, body: stars === 5 ? "Test review: lovely stay, spotless home." : "Test review: the kitchen was not clean on arrival.", withBooking: stars !== 5 } });
                toast.success(`${r.imported} imported, ${r.ticketsCreated} follow-up created`);
                await refresh();
                setBusy(false);
              }}>
                Add {stars}★ test review
              </Button>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
