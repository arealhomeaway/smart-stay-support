import { ownerRezBookingUrl } from "@/lib/ownerrez-links";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTicketDrawer } from "@/components/nav/TicketDrawer";
import { addTestReview, createTestSurveyLink, getReviewFollowUpStart, previewOwnerRezReviews, setReviewFollowUpStart } from "@/lib/guest-feedback.functions";
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
  const navigate = useNavigate();
  // The Ticket layers on top only after the survey popup has fully closed.
  const [pendingTicket, setPendingTicket] = useState<string | null>(null);
  useEffect(() => {
    if (open || !pendingTicket || !drawer) return;
    const t = window.setTimeout(() => {
      drawer.openTicket(pendingTicket);
      setPendingTicket(null);
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, pendingTicket, drawer]);
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
                      <span className="font-medium">{isSurvey ? (f.guest_name ?? "Guest not provided") : (f.reviewer_display_name ?? (f.reservation_guest_name ? `Reservation guest: ${f.reservation_guest_name}` : "Reviewer name unavailable"))}</span>
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
                {isSurvey ? (open.guest_name ?? "Guest not provided") : (open.reviewer_display_name ? `Reviewer: ${open.reviewer_display_name}` : "Reviewer name unavailable")} · {stayText(open)} · {formatDate(open.submitted_at)}
              </p>
              {isSurvey ? (
                <SurveyAnswersView feedbackId={open.id} />
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="rounded-md border border-border p-3" aria-label="Reservation context">
                    <p className="mb-1 font-medium">Reservation Context</p>
                    <dl className="grid grid-cols-[8rem_1fr] gap-x-2 gap-y-1">
                      <dt className="text-muted-foreground">Guest</dt>
                      <dd>{open.reservation_guest_name ? `Reservation guest: ${open.reservation_guest_name}` : "—"}</dd>
                      <dt className="text-muted-foreground">Stay dates</dt>
                      <dd>{stayText(open)}</dd>
                      <dt className="text-muted-foreground">Reservation</dt>
                      <dd>{open.reservation_confirmation ?? open.ownerrez_booking_id ?? "—"}</dd>
                      <dt className="text-muted-foreground">Booking source</dt>
                      <dd>{open.booking_platform ?? "—"}</dd>
                    </dl>
                    {open.reservation_match === "matched" && /^\d+$/.test(open.ownerrez_booking_id ?? "") && (
                      <a href={ownerRezBookingUrl(open.ownerrez_booking_id) ?? undefined} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary">
                        Open in OwnerRez <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{open.summary?.trim() ? open.summary : "No written review provided."}</p>
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
                <button
                  type="button"
                  onClick={() => {
                    const id = open.ticket_id!;
                    setOpen(null);
                    if (drawer) setPendingTicket(id);
                    else void navigate({ to: "/tickets/$ticketId", params: { ticketId: id } });
                  }}
                  className="text-left text-sm text-primary hover:underline"
                >
                  Open the follow-up Ticket
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">{open.rating === 5 ? "No follow-up work — 5-star feedback is kept for history only." : "No follow-up Ticket — this review is kept for history only."}</p>
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

type PreviewResult = Awaited<ReturnType<typeof previewOwnerRezReviews>>;

const PREVIEW_LABELS: Record<PreviewResult["rows"][number]["outcome"], string> = {
  historical: "Historical import only",
  no_follow_up: "New review — no follow-up",
  follow_up: "New review — follow-up Ticket will be created",
  duplicate: "Already imported — skipped",
  unmatched_property: "No matching home — skipped",
};

function ReviewToolsCard({ propertyId, isDemo, isSupervisor }: { propertyId: string; isDemo: boolean; isSupervisor: boolean }) {
  const qc = useQueryClient();
  const preview = useServerFn(previewOwnerRezReviews);
  const addTest = useServerFn(addTestReview);
  const getStart = useServerFn(getReviewFollowUpStart);
  const setStart = useServerFn(setReviewFollowUpStart);
  const startQ = useQuery({ queryKey: ["review-followup-start"], queryFn: () => getStart(), enabled: isSupervisor || isDemo });
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  if (!isSupervisor && !isDemo) return null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["guest-feedback"] });
  const start = startQ.data?.date ?? null;
  return (
    <Card>
      <CardContent className="space-y-3 pt-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Review follow-up automation starts:</span>
          <span>{start ?? "Not set — every imported review is history only"}</span>
          {startQ.data?.canEdit && (
            <>
              <Input type="date" aria-label="Review follow-up automation start date" className="h-8 w-40" value={draft || start || ""} onChange={(e) => setDraft(e.target.value)} />
              <Button size="sm" variant="outline" disabled={busy || !draft || draft === start} onClick={async () => {
                setBusy(true);
                try { await setStart({ data: { date: draft } }); toast.success("Start date saved"); setDraft(""); setResult(null); await startQ.refetch(); }
                catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
                setBusy(false);
              }}>Save date</Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Reviews published before this date (Central time) are imported for history and reporting only. From this date on, reviews under 5 stars open a follow-up Ticket in the Team Queue.</p>
        <div className="flex flex-wrap items-center gap-2">
        {isSupervisor && !isDemo && (
          <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
            setBusy(true);
            try { setResult(await preview()); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Preview failed"); }
            setBusy(false);
          }}>
            Preview OwnerRez review import (no changes)
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
                toast.success(`${r.imported} imported, ${r.ticketsCreated} follow-up created${r.historical ? " (historical — before the follow-up start date)" : ""}`);
                await refresh();
                setBusy(false);
              }}>
                Add {stars}★ test review
              </Button>
            ))}
          </>
        )}
        </div>
        {result && (
          <div className="space-y-2 rounded-md border p-3" data-testid="review-import-preview">
            <p className="font-medium">Preview only — nothing saved, no Tickets created. {result.available} reviews from the last 60 days.</p>
            <ul className="space-y-0.5">
              {(["historical", "no_follow_up", "follow_up", "duplicate", "unmatched_property"] as const).map((o) => (
                <li key={o}>{PREVIEW_LABELS[o]}: <strong>{result.rows.filter((r) => r.outcome === o).length}</strong></li>
              ))}
            </ul>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1">Published</th><th>Home</th><th>Stars</th><th>Site</th><th>Result</th></tr></thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.source_review_id} className="border-t">
                      <td className="py-1">{r.date ? r.date.slice(0, 10) : "—"}</td>
                      <td>{r.property_name ?? "—"}</td>
                      <td>{r.rating ?? "—"}</td>
                      <td>{r.platform ?? "—"}</td>
                      <td>{PREVIEW_LABELS[r.outcome]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
