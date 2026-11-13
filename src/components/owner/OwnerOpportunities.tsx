/**
 * Homeowner Opportunity data and the Opportunity side panel.
 *
 * Two work-item sources keep their provenance: ARHA-shared Opportunities and
 * Optional Library ones. A library template only becomes a live Opportunity
 * when the homeowner starts it, on exactly one home. The one Opportunities page
 * that shows them with every other owner item is OwnerOpportunityBoard.
 * Owner-facing language only: "Opportunity", never task, ticket or requirement.
 */
import { LoadError } from "@/components/ui/page";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { OwnerConversation } from "@/components/OwnerConversation";
import { Clock, FileText, Link2 } from "lucide-react";
import { inQueue, queueCounts, type QueueInput } from "@/lib/owner-opportunity-filters";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  completeMyOpportunity,
  listMyCollaboration,
  compareArhaPriority,
  markOpportunityViewed,
  opportunityResourceUrl,
  respondToOpportunity,
  type OwnerResponse,
  type ResponseType,
} from "@/lib/v2-workflow.functions";
import { listOptionalLibrary, type LibraryTemplate } from "@/lib/opportunity-library.functions";
import { arhaCover, duplicatesArha, imageFor } from "@/lib/opportunity-images";
import { OwnerUploadDialog } from "@/components/owner/OwnerUploadDialog";
import { LibraryVideoIndexError, LibraryVideoPlayer, useLibraryVideoIndex } from "@/components/owner/LibraryVideoPlayer";
import { videoForOpportunity } from "@/lib/library-video";
import { OwnerFileRow, useOwnerDocuments } from "@/components/OwnerFilesPanel";
import { OwnerSidePanel, PanelSection } from "@/components/owner/OwnerSidePanel";

export type OpportunityHome = { propertyId: string; name: string; address?: string | null; photoUrl?: string | null };

export type Live = {
  id: string;
  createdAt: string | null;
  source: "arha" | "optional";
  title: string;
  propertyId: string | null;
  propertyName: string;
  team: string | null;
  summary: string;
  cover: string;
  what?: string | null;
  why?: string | null;
  how?: string | null;
  document?: string | null;
  suggestedMinutes?: number | null;
  resources: { id: string; kind: "file" | "link"; label: string; url: string | null; note?: string | null }[];
  templateLink: { label: string; url: string } | null;
  responseTypes: ResponseType[];
  responses: OwnerResponse[];
  viewed: boolean;
  responded: boolean;
  finished: boolean;
  dueOn?: string | null;
  templateId: string | null;
  queue: QueueInput;
};

type Content = {
  what?: string; why?: string; how?: string; ways_to_document?: string; summary?: string;
  suggested_minutes?: number | null; image_key?: string; resource_label?: string | null; resource_url?: string | null;
};

function oneLine(text: string | null | undefined) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > 150 ? `${t.slice(0, 147)}…` : t;
}

const EMPTY_TITLES = new Map<string, string[]>();

export function arhaStatus(o: Pick<Live, "finished" | "queue">) {
  if (o.finished) return "Completed";
  if (inQueue(o.queue, "new")) return "New";
  if (inQueue(o.queue, "feedback")) return "Feedback Sent";
  if (inQueue(o.queue, "awaiting")) return "Awaiting Your Response";
  return "Open";
}

// Build 18 item 3: no suggested time is shown to homeowners; the stored minutes stay untouched.

/** Shared data hook: live Opportunities + library templates, scoped to the portal filter. */
export function useOwnerOpportunityData(
  homes: OpportunityHome[],
  selectedHomeId: string | null,
  /** Plan card titles per home: a library card the home's plan already carries is never offered twice. */
  planTitles: Map<string, string[]> = EMPTY_TITLES,
) {
  const list = useServerFn(listMyCollaboration);
  const lib = useServerFn(listOptionalLibrary);
  const live = useQuery({ queryKey: ["owner-opportunities"], queryFn: () => list() });
  const library = useQuery({ queryKey: ["owner-opportunity-library"], queryFn: () => lib() });

  return useMemo(() => {
    const name = (id: string | null) => homes.find((h) => h.propertyId === id)?.name ?? "Your home";
    const photo = (id: string | null) => homes.find((h) => h.propertyId === id)?.photoUrl ?? null;
    // Explicit provenance only: ARHA or Optional Library. Unknown/legacy is neither.
    const rows: Live[] = (live.data ?? [])
      .filter((o) => o.source === "arha" || o.source === "optional_library")
      .filter((o) => !selectedHomeId || o.property_id === selectedHomeId)
      // Only this portal's homes (keeps a staff preview scoped to the previewed program).
      .filter((o) => homes.length === 0 || homes.some((h) => h.propertyId === o.property_id))
      .map((o) => {
        const c = (o.owner_content ?? {}) as Content;
        const arha = o.source === "arha";
        return {
          id: o.id,
          createdAt: (o as { created_at?: string | null }).created_at ?? null,
          source: arha ? "arha" : "optional",
          title: o.title,
          propertyId: o.property_id,
          propertyName: name(o.property_id),
          team: arha
            ? o.source_department === "operations"
              ? "From your ARHA Operations Team"
              : "From your ARHA Onboarding Team"
            : null,
          summary: oneLine(c.summary || c.what),
          cover: arha
            ? arhaCover(o.title, o.resources.map((r) => r.label), photo(o.property_id))
            : imageFor(c.image_key ?? null),
          what: c.what ?? null,
          why: c.why ?? null,
          how: c.how ?? null,
          document: c.ways_to_document ?? null,
          suggestedMinutes: c.suggested_minutes ?? null,
          resources: o.resources,
          templateLink: c.resource_url ? { label: c.resource_label || "Learn more", url: c.resource_url } : null,
          responseTypes: o.response_types,
          responses: o.owner_response,
          viewed: Boolean(o.viewed_at),
          responded: Boolean(o.responded_at) || o.owner_response.length > 0,
          finished: o.status === "complete" || o.status === "completed",
          dueOn: o.due_on,
          templateId: o.library_template_id,
          queue: {
            status: o.status,
            viewed: Boolean(o.viewed_at),
            needsOwnerAttention: Boolean(o.needs_owner_attention),
            lastSpeaker: o.last_speaker,
            freshRequest: Boolean(o.open_request),
            responseTypes: o.response_types,
            answered: Boolean(o.responded_at) || o.owner_response.length > 0,
          },
        } satisfies Live;
      });
    // Each home keeps its own ARHA order (set by staff); All Homes keeps homes grouped.
    const raw = new Map((live.data ?? []).map((o) => [o.id, o]));
    const homeIndex = (id: string | null) => { const i = homes.findIndex((h) => h.propertyId === id); return i < 0 ? homes.length : i; };
    const arha = rows
      .filter((r) => r.source === "arha")
      .sort((a, b) => homeIndex(a.propertyId) - homeIndex(b.propertyId) || compareArhaPriority(raw.get(a.id)!, raw.get(b.id)!));
    const optional = rows.filter((r) => r.source === "optional");
    // Templates the owner could still start in this view.
    const scopeHomes = selectedHomeId ? [selectedHomeId] : homes.map((h) => h.propertyId);
    const allLive = live.data ?? [];
    const norm = (t: string) => t.trim().toLowerCase();
    const onPlan = (title: string, home: string) => (planTitles.get(home) ?? []).some((p) => norm(p) === norm(title));
    const templates = (library.data ?? []).filter((t) => {
      const openHomes = scopeHomes.filter((h) => {
        const started = allLive.some((o) => o.library_template_id === t.id && o.property_id === h);
        const arhaTitles = allLive.filter((o) => o.source === "arha" && o.property_id === h && o.status !== "complete").map((o) => o.title);
        return !started && !duplicatesArha(t.category, t.title, arhaTitles) && !onPlan(t.title, h);
      });
      return openHomes.length > 0;
    });
    const startableHomes = (t: LibraryTemplate) =>
      homes.filter((h) => {
        const started = allLive.some((o) => o.library_template_id === t.id && o.property_id === h.propertyId);
        const arhaTitles = allLive.filter((o) => o.source === "arha" && o.property_id === h.propertyId && o.status !== "complete").map((o) => o.title);
        return !started && !duplicatesArha(t.category, t.title, arhaTitles) && !onPlan(t.title, h.propertyId);
      });
    return {
      loading: live.isLoading || library.isLoading,
      arha,
      optional,
      templates,
      startableHomes,
      needsAttention: arha.filter((a) => inQueue(a.queue, "attention")),
      counts: queueCounts(arha.map((a) => a.queue)),
    };
  }, [live.data, library.data, homes, selectedHomeId, live.isLoading, library.isLoading, planTitles]);
}

export function StartDialog({
  template, homes, busy, onStart,
}: {
  template: LibraryTemplate;
  homes: OpportunityHome[];
  busy: boolean;
  onStart: (propertyId: string) => void;
}) {
  const [home, setHome] = useState<string>("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{template.title}</DialogTitle>
        <DialogDescription>{template.summary}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="start-home">Which property would you like to work on?</Label>
        <Select value={home} onValueChange={setHome}>
          <SelectTrigger id="start-home"><SelectValue placeholder="Choose a property" /></SelectTrigger>
          <SelectContent>
            {homes.map((h) => <SelectItem key={h.propertyId} value={h.propertyId}>{h.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {homes.length === 0 ? <p className="text-xs text-muted-foreground">You've already started this for each of your homes.</p> : null}
      </div>
      <DialogFooter>
        <Button disabled={!home || busy} onClick={() => onStart(home)}>{busy ? "Starting…" : "Start Opportunity"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ResourceLinks({ items }: { items: Live["resources"] }) {
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
            <Link2 className="size-3.5" /> {r.label}{r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}
          </a>
        ),
      )}
    </>
  );
}

/** The full Opportunity, in the side panel. Opening an ARHA Opportunity is what records it as viewed. */
export function OpportunityDetail({
  item, onClose, readOnly, homes, blockedReason, onLogHours, statusLabel, outsideLine = null, outsideFailed,
}: {
  item: Live | null;
  onClose: () => void;
  readOnly: boolean;
  homes: OpportunityHome[];
  blockedReason: string | null;
  onLogHours?: (activity: string, propertyId: string | null) => void;
  /** The chip text the card showed, repeated at the top of the panel. */
  statusLabel?: string | null;
  /** Item 2: work done outside Resolve; shown instead of an upload request. */
  outsideLine?: string | null;
  /** The outside-Resolve instructions failed to load: show that, never the ordinary ones. */
  outsideFailed?: { retry: () => void };
}) {
  const qc = useQueryClient();
  const docs = useOwnerDocuments();
  const markViewed = useServerFn(markOpportunityViewed);
  const respond = useServerFn(respondToOpportunity);
  const complete = useServerFn(completeMyOpportunity);
  const [text, setText] = useState("");
  const [upload, setUpload] = useState(false);

  useEffect(() => {
    setText("");
    if (item && !readOnly && !item.viewed) void markViewed({ data: { id: item.id } }).then(() => qc.invalidateQueries({ queryKey: ["owner-opportunities"] })).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["owner-opportunities"] });
  const send = useMutation({
    mutationFn: (v: { kind: "acknowledge" | "feedback" | "decision"; decision?: "authorize" | "changes" }) =>
      respond({ data: { id: item!.id, kind: v.kind, decision: v.decision ?? null, text } }),
    onSuccess: () => { setText(""); toast.success("Sent to your ARHA team."); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send."),
  });
  const done = useMutation({
    mutationFn: () => complete({ data: { id: item!.id } }),
    onSuccess: () => { toast.success("Marked complete. Thank you!"); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update."),
  });

  const t = item?.responseTypes ?? [];
  const arha = item?.source === "arha";
  const canRespond = !readOnly && item && arha && !item.finished && (t.includes("acknowledge") || t.includes("feedback") || t.includes("decision"));
  const linked = item ? (docs.data?.files ?? []).filter((f) => f.work_item_id === item.id) : [];
  // Live from the current library item, so a replaced video reaches Opportunities already started.
  const videoIndex = useLibraryVideoIndex();
  const video = item ? videoForOpportunity(item.templateId, videoIndex) : null;
  if (!item) return null;

  return (
    <OwnerSidePanel
      open
      onOpenChange={(v) => !v && onClose()}
      cover={item.cover}
      status={statusLabel ?? (arha ? arhaStatus(item) : item.finished ? "Completed" : "Optional")}
      title={item.title}
      home={[item.propertyName, arha ? item.team ?? "From your ARHA team" : "Optional"].filter(Boolean).join(" · ")}
      sentAt={item.createdAt}
      answerBy={item.dueOn ?? null}
      footer={
        readOnly ? null : (
          <>
            {onLogHours && !blockedReason ? (
              <Button className="min-h-11" size="sm" variant="outline" onClick={() => { const p = item.propertyId; const a = item.title; onClose(); onLogHours(a, p); }}>
                <Clock className="size-4" aria-hidden="true" /> Log hours for this
              </Button>
            ) : null}
            {/* Fix 24: an approval item has only Approve and Ask a question. */}
            {homes.length && !outsideLine && !outsideFailed && !(arha && t.includes("decision")) ? <Button className="min-h-11" size="sm" variant="outline" onClick={() => setUpload(true)}>Upload documentation</Button> : null}
            {!item.finished && !(arha && t.includes("decision")) ? <Button className="min-h-11" size="sm" disabled={done.isPending} onClick={() => done.mutate()}>Mark complete</Button> : null}
          </>
        )
      }
    >
      {video && item.templateId ? <LibraryVideoPlayer libraryId={item.templateId} poster={item.cover} label={video.label} /> : item.templateId ? <LibraryVideoIndexError /> : null}
      {outsideFailed && !outsideLine ? <LoadError what="The instructions" onRetry={outsideFailed.retry} /> : null}
      {outsideFailed && !outsideLine ? null : outsideLine || item.what ? <PanelSection label="What we're asking"><p className="whitespace-pre-wrap text-muted-foreground">{outsideLine ?? item.what}</p></PanelSection> : null}
      {item.why ? <PanelSection label={arha ? "Why this matters" : "Why it matters"}><p className="whitespace-pre-wrap text-muted-foreground">{item.why}</p></PanelSection> : null}
      {item.how ? <PanelSection label={arha ? "How to complete it" : "How to complete it remotely"}><p className="whitespace-pre-wrap text-muted-foreground">{item.how}</p></PanelSection> : null}
      {item.resources.length || item.templateLink || linked.length ? (
        <PanelSection label="Files">
          <div className="space-y-1">
            <ResourceLinks items={item.resources} />
            {item.templateLink ? (
              <a href={item.templateLink.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Link2 className="size-3.5" /> {item.templateLink.label}</a>
            ) : null}
            {linked.length ? <ul className="space-y-2 pt-1">{linked.map((f) => <OwnerFileRow key={f.id} f={f} showHome={false} />)}</ul> : null}
          </div>
        </PanelSection>
      ) : null}
      {item.document && !outsideLine && !outsideFailed ? <PanelSection label="Ways to document your participation"><p className="whitespace-pre-wrap text-muted-foreground">{item.document}</p></PanelSection> : null}

      {/* Build 17 finding 2: every Opportunity carries the conversation, so a staff message is seen
          and answered from the moment the thread exists, whoever leads the item. */}
      {canRespond && t.includes("decision") ? (
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" disabled={send.isPending} onClick={() => send.mutate({ kind: "decision", decision: "authorize" })}>Approve</Button>
          <Button
            className="min-h-11"
            variant="outline"
            onClick={() => document.querySelector<HTMLTextAreaElement>(`#owner-conv-${item.id} textarea`)?.focus()}
          >
            Ask a question
          </Button>
        </div>
      ) : null}
      <div id={`owner-conv-${item.id}`}>
      <OwnerConversation
        workItemId={item.id}
        status={item.finished ? "complete" : "open"}
        legacy={item.responses}
        viewer="homeowner"
        readOnly={readOnly}
        refreshKeys={[["owner-opportunities"]]}
      />
      </div>

      {canRespond ? (
        <div className="space-y-2">
          {t.includes("feedback") && !t.includes("decision") && !item.responses.length ? (
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share your thoughts or the changes you'd like…" aria-label="Your reply" />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {t.includes("acknowledge") && !item.responses.length ? <Button className="min-h-11" size="sm" variant="outline" disabled={send.isPending} onClick={() => send.mutate({ kind: "acknowledge" })}>I&apos;ve reviewed this</Button> : null}
            {t.includes("feedback") && !t.includes("decision") && !item.responses.length ? <Button className="min-h-11" size="sm" disabled={send.isPending || !text.trim()} onClick={() => send.mutate({ kind: "feedback" })}>Send to ARHA</Button> : null}

          </div>
        </div>
      ) : null}

      <OwnerUploadDialog
        open={upload}
        onOpenChange={setUpload}
        homes={homes}
        fixedPropertyId={item.propertyId}
        opportunity={{ id: item.id, title: item.title }}
        defaultCategory="participation"
      />
    </OwnerSidePanel>
  );
}
