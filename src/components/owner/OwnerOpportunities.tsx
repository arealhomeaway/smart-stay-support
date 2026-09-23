/**
 * The homeowner's one Opportunities section.
 *
 * "Suggested for you" are the Active Owner Opportunities from the shared Work
 * Item engine. "More ways to participate" are the standing, self-directed
 * ideas (never assigned, nobody waiting). Both render through the same card.
 * Owner-facing language only: Opportunities, never tasks or requirements.
 * Completing one never changes ARHA's internal work.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { completeMyOpportunity, listMyOpportunities } from "@/lib/v2-workflow.functions";
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
  resources: string[];
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
}: {
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
  const list = useServerFn(listMyOpportunities);
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
      propertyName: homes.find((h) => h.propertyId === o.property_id)?.name ?? o.propertyName,
      due: o.due_on,
      what: o.owner_content?.what,
      why: o.owner_content?.why,
      how: o.owner_content?.how,
      document: o.owner_content?.ways_to_document,
      resources: o.owner_content?.resources ?? [],
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
              <li key={c.key} className="rounded-lg border border-border p-4">
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
                      <dd className="space-y-0.5">
                        {c.resources.map((r) => (
                          <a key={r} href={r} target="_blank" rel="noreferrer" className="block truncate text-primary underline-offset-2 hover:underline">{r}</a>
                        ))}
                      </dd>
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
              </li>
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
