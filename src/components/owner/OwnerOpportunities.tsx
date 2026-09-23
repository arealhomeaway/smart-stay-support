/**
 * The homeowner's one Opportunities section.
 *
 * "Suggested for you" are the Active Owner Opportunities from the shared Work
 * Item engine. "More ways to participate" are the standing, self-directed
 * ideas (never assigned, nobody waiting). Both render through the same card.
 * Owner-facing language only: Opportunities, never tasks or requirements.
 * Completing one never changes ARHA's internal work.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { completeMyOpportunity, listMyCollaboration, markOpportunityViewed, opportunityResourceUrl, respondToOpportunity, type OwnerResponse, type ResponseType } from "@/lib/v2-workflow.functions";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Link2 } from "lucide-react";
import { OwnerUploadDialog, type OwnerHome } from "@/components/owner/OwnerUploadDialog";
import { OwnerFileRow, useOwnerDocuments } from "@/components/OwnerFilesPanel";
import { buildParticipationPrompts } from "@/lib/owner-participation-prompts";

/** What to capture for each standing idea. Descriptive only — never an amount of time. */
const EVIDENCE_HINT: Record<string, string> = {
  "mood-board": "Screenshots, saved listings or photos of the pieces you liked.",
  guidebook: "Your written list of places, or a photo of your notes.",
  "guidebook-refresh": "The updated list, or a photo of anywhere new you visited.",
  "house-notes": "The notes or instructions you wrote, or photos of what they describe.",
  "house-notes-refresh": "Your rewritten notes, welcome message or instructions.",
  supplies: "Photos of what is missing, plus any receipts if you bought supplies.",
  "supplies-ongoing": "Photos of the wear or shortage you found, plus any receipts.",
  "amenity-ideas": "Your list of ideas, product links, or photos of what inspired them.",
  "market-inspiration": "Screenshots of the listings you studied and what you noted.",
  planning: "Your notes on pricing, blocked dates or the upgrades you considered.",
};

type Filter = "all" | "suggested" | "more" | "completed";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "suggested", label: "Suggested for You" },
  { key: "more", label: "More Ways to Participate" },
  { key: "completed", label: "Completed" },
];

type Card = {
  key: string;
  workItemId: string | null;
  title: string;
  propertyId: string | null;
  propertyName: string;
  due?: string | null | undefined;
  what?: string | null | undefined;
  why?: string | null | undefined;
  how?: string | null | undefined;
  document?: string | null | undefined;
  resources: { id: string; kind: "file" | "link"; label: string; url: string | null }[];
  responseTypes: ResponseType[];
  responses: OwnerResponse[];
  viewed: boolean;
  finished: boolean;
};

export function OwnerOpportunities({
  onLogHours,
  readOnly = false,
  homes = [],
  selectedHomeId = null,
  phase,
  blockedReason = null,
  extra,
  focusId = null,
}: {
  focusId?: string | null;
  onLogHours?: (activity: string) => void;
  readOnly?: boolean;
  homes?: OwnerHome[];
  /** Portal-wide property filter; null = All Homes. */
  selectedHomeId?: string | null;
  phase?: string | null;
  blockedReason?: string | null;
  /** Property work the homeowner may review, shown with "More ways". */
  extra?: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [uploadFor, setUploadFor] = useState<{ id: string | null; title: string; propertyId: string | null } | null>(null);
  const docs = useOwnerDocuments();
  const qc = useQueryClient();
  const list = useServerFn(listMyCollaboration);
  const complete = useServerFn(completeMyOpportunity);
  const q = useQuery({ queryKey: ["owner-opportunities"], queryFn: () => list() });
  const done = useMutation({
    mutationFn: (id: string) => complete({ data: { id } }),
    onSuccess: () => { toast.success("Marked done. Thank you!"); void qc.invalidateQueries({ queryKey: ["owner-opportunities"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update."),
  });

  const selectedName = homes.find((h) => h.propertyId === selectedHomeId)?.name ?? null;
  const assigned: Card[] = (q.data ?? [])
    .filter((o) => !selectedHomeId || o.property_id === selectedHomeId)
    .map((o) => ({
      key: o.id,
      workItemId: o.id,
      title: o.title,
      propertyId: o.property_id,
      propertyName: homes.find((h) => h.propertyId === o.property_id)?.name ?? "Your home",
      due: o.due_on,
      what: o.owner_content?.what,
      why: o.owner_content?.why,
      how: o.owner_content?.how,
      document: o.owner_content?.ways_to_document,
      resources: o.resources,
      responseTypes: o.response_types,
      responses: o.owner_response,
      viewed: Boolean(o.viewed_at),
      finished: o.status === "complete",
    }));
  const standing: Card[] = buildParticipationPrompts({ phase }).map((p) => ({
    key: `idea-${p.id}`,
    workItemId: null,
    title: p.title,
    propertyId: selectedHomeId,
    propertyName: selectedName ?? (homes.length > 1 ? "Any of your homes" : homes[0]?.name ?? "Your home"),
    what: p.description,
    why: p.relevance,
    how: "Do it on your own schedule, then log the time you actually spent.",
    document: EVIDENCE_HINT[p.id] ?? null,
    resources: [],
    responseTypes: [],
    responses: [],
    viewed: true,
    finished: false,
  }));

  const suggested = assigned.filter((c) => !c.finished);
  const completed = assigned.filter((c) => c.finished);
  const shown =
    filter === "suggested" ? suggested : filter === "more" ? standing : filter === "completed" ? completed : [...suggested, ...standing];
  const showExtra = Boolean(extra) && (filter === "all" || filter === "more");

  return (
    <SectionCard
      title="Opportunities"
      description="Ways you can participate in work related to your properties and record the time you spend."
    >
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter Opportunities">
        {FILTERS.map((f) => {
          const count = f.key === "suggested" ? suggested.length : f.key === "more" ? standing.length : f.key === "completed" ? completed.length : suggested.length + standing.length;
          return (
            <Button key={f.key} size="sm" role="tab" aria-selected={filter === f.key} variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
              {f.label} <span className="numeric ml-1 opacity-70">{count}</span>
            </Button>
          );
        })}
      </div>
      {blockedReason ? (
        <p className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{blockedReason}</p>
      ) : null}
      {shown.length === 0 && !showExtra ? (
        <p className="text-sm text-muted-foreground">Nothing here right now.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => {
            const linked = c.workItemId ? (docs.data?.files ?? []).filter((f) => f.work_item_id === c.workItemId) : [];
            return (
              <OpportunityCard key={c.key} card={c} focus={c.workItemId === focusId} readOnly={readOnly}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.propertyName}{c.due ? ` · suggested by ${c.due}` : ""}</p>
                  </div>
                  {c.finished ? <span className="flex items-center gap-1 text-sm text-state-done"><CheckCircle2 className="size-4" /> Done</span> : null}
                </div>
                <dl className="mt-3 grid gap-2 text-sm">
                  {c.what ? <div><dt className="font-medium">What you'll do</dt><dd className="text-muted-foreground">{c.what}</dd></div> : null}
                  {c.why ? <div><dt className="font-medium">Why this matters</dt><dd className="text-muted-foreground">{c.why}</dd></div> : null}
                  {c.how ? <div><dt className="font-medium">How to complete it</dt><dd className="text-muted-foreground">{c.how}</dd></div> : null}
                  {c.document ? <div><dt className="font-medium">Ways to Document Your Participation</dt><dd className="text-muted-foreground">{c.document}</dd></div> : null}
                  {c.resources.length ? (
                    <div>
                      <dt className="font-medium">Resources</dt>
                      <dd className="space-y-0.5"><ResourceLinks items={c.resources} /></dd>
                    </div>
                  ) : null}
                </dl>
                {linked.length ? (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-medium">Your documentation</p>
                    <ul className="space-y-2">{linked.map((f) => <OwnerFileRow key={f.id} f={f} showHome={false} />)}</ul>
                  </div>
                ) : null}
                {!readOnly ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {homes.length ? <Button size="sm" variant="outline" onClick={() => setUploadFor({ id: c.workItemId, title: c.title, propertyId: c.propertyId })}>Upload documentation</Button> : null}
                    {onLogHours && !blockedReason ? <Button size="sm" onClick={() => onLogHours(c.title)}>Log time</Button> : null}
                    {c.workItemId && !c.finished ? <Button size="sm" variant="outline" disabled={done.isPending} onClick={() => done.mutate(c.workItemId!)}>Mark done</Button> : null}
                  </div>
                ) : null}
              </OpportunityCard>
            );
          })}
        </ul>
      )}
      {showExtra ? <div className="mt-4 space-y-2"><p className="text-sm font-semibold">Property work you can review</p>{extra}</div> : null}
      <OwnerUploadDialog
        open={uploadFor !== null}
        onOpenChange={(v) => !v && setUploadFor(null)}
        homes={homes}
        fixedPropertyId={uploadFor?.propertyId ?? null}
        opportunity={uploadFor?.id ? { id: uploadFor.id, title: uploadFor.title } : null}
        defaultCategory="participation"
      />
    </SectionCard>
  );
}

function ResourceLinks({ items }: { items: Card["resources"] }) {
  const open = useServerFn(opportunityResourceUrl);
  return (
    <>
      {items.map((r) =>
        r.kind === "file" ? (
          <button
            key={r.id}
            type="button"
            className="flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            onClick={async () => {
              try { window.open((await open({ data: { resourceId: r.id } })).url, "_blank", "noopener"); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Could not open the file."); }
            }}
          >
            <FileText className="size-3.5" /> {r.label}
          </button>
        ) : (
          <a key={r.id} href={r.url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-primary underline-offset-2 hover:underline">
            <Link2 className="size-3.5" /> {r.label}
          </a>
        ),
      )}
    </>
  );
}

/** One card. Marks the Opportunity viewed once it is actually on screen, and takes the owner's response. */
function OpportunityCard({ card, focus, readOnly, children }: { card: Card; focus: boolean; readOnly: boolean; children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  const qc = useQueryClient();
  const markViewed = useServerFn(markOpportunityViewed);
  const respond = useServerFn(respondToOpportunity);
  const [text, setText] = useState("");
  const [sentOnce, setSentOnce] = useState(false);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);
  useEffect(() => {
    if (readOnly || card.viewed || !card.workItemId || sentOnce || !ref.current) return;
    const id = card.workItemId;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSentOnce(true);
        obs.disconnect();
        void markViewed({ data: { id } }).catch(() => undefined);
      }
    }, { threshold: 0.5 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [card.viewed, card.workItemId, readOnly, sentOnce, markViewed]);

  const send = useMutation({
    mutationFn: (v: { kind: "acknowledge" | "feedback" | "decision"; decision?: "authorize" | "changes" }) =>
      respond({ data: { id: card.workItemId!, kind: v.kind, decision: v.decision ?? null, text } }),
    onSuccess: () => { setText(""); toast.success("Sent to your ARHA team."); void qc.invalidateQueries({ queryKey: ["owner-opportunities"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send."),
  });

  const t = card.responseTypes;
  const canRespond = !readOnly && card.workItemId && !card.finished && (t.includes("acknowledge") || t.includes("feedback") || t.includes("decision"));
  return (
    <li ref={ref} className={`rounded-lg border p-4 ${focus ? "border-primary" : "border-border"}`}>
      {children}
      {card.responses.length ? (
        <div className="mt-3 space-y-1">
          <p className="text-sm font-medium">Your responses</p>
          {card.responses.map((r, i) => (
            <p key={i} className="rounded-md bg-muted/50 p-2 text-sm">
              <span className="text-xs text-muted-foreground">
                {r.kind === "decision" ? (r.decision === "authorize" ? "You authorized this" : "You requested changes") : r.kind === "acknowledge" ? "You acknowledged this" : "Your feedback"} · {new Date(r.at).toLocaleDateString()}
              </span>
              {r.text ? <span className="block whitespace-pre-wrap">{r.text}</span> : null}
            </p>
          ))}
        </div>
      ) : null}
      {canRespond ? (
        <div className="mt-3 space-y-2">
          {t.includes("feedback") || t.includes("decision") ? (
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share your thoughts or the changes you'd like…" aria-label="Your response" />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {t.includes("acknowledge") ? <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => send.mutate({ kind: "acknowledge" })}>I&apos;ve reviewed this</Button> : null}
            {t.includes("feedback") ? <Button size="sm" disabled={send.isPending || !text.trim()} onClick={() => send.mutate({ kind: "feedback" })}>Send feedback</Button> : null}
            {t.includes("decision") ? (
              <>
                <Button size="sm" disabled={send.isPending} onClick={() => send.mutate({ kind: "decision", decision: "authorize" })}>Authorize</Button>
                <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => send.mutate({ kind: "decision", decision: "changes" })}>Request changes</Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
