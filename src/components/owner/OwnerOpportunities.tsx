/**
 * The homeowner's Opportunities: two sources, never blended.
 *
 *  FROM YOUR ARHA TEAM — Opportunities ARHA intentionally shared (structured
 *  ARHA source). They always carry the home of the ARHA work they came from.
 *
 *  MORE WAYS TO PARTICIPATE — optional, remote ideas from the Optional
 *  Opportunity Library. A template only becomes a live Opportunity when the
 *  homeowner starts it, on exactly one home.
 *
 * Cards stay compact; opening one shows everything. Owner-facing language
 * only: "Opportunity", never task, ticket or requirement.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { OwnerConversation } from "@/components/OwnerConversation";
import { AlertCircle, CheckCircle2, Clock, FileText, Link2 } from "lucide-react";
import { OWNER_QUEUES, inQueue, queueCounts, type OwnerQueue, type QueueInput } from "@/lib/owner-opportunity-filters";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
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
import { listOptionalLibrary, startOptionalOpportunity, type LibraryTemplate } from "@/lib/opportunity-library.functions";
import { arhaCover, duplicatesArha, imageFor } from "@/lib/opportunity-images";
import { OwnerUploadDialog } from "@/components/owner/OwnerUploadDialog";
import { OwnerFileRow, useOwnerDocuments } from "@/components/OwnerFilesPanel";

export type OpportunityHome = { propertyId: string; name: string; address?: string | null; photoUrl?: string | null };

type Live = {
  id: string;
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

export function arhaStatus(o: Pick<Live, "finished" | "queue">) {
  if (o.finished) return "Completed";
  if (inQueue(o.queue, "new")) return "New";
  if (inQueue(o.queue, "feedback")) return "Feedback Sent";
  if (inQueue(o.queue, "awaiting")) return "Awaiting Your Response";
  return "Open";
}

function minutesLabel(m: number | null | undefined) {
  if (!m) return null;
  return m >= 60 ? `About ${Math.round((m / 60) * 10) / 10} hr` : `About ${m} min`;
}

/** Shared data hook: live Opportunities + library templates, scoped to the portal filter. */
export function useOwnerOpportunityData(homes: OpportunityHome[], selectedHomeId: string | null) {
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
          finished: o.status === "complete",
          templateId: o.library_template_id,
          queue: {
            status: o.status,
            viewed: Boolean(o.viewed_at),
            needsOwnerAttention: Boolean(o.needs_owner_attention),
            lastSpeaker: o.last_speaker,
            responseTypes: o.response_types,
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
    const templates = (library.data ?? []).filter((t) => {
      const openHomes = scopeHomes.filter((h) => {
        const started = allLive.some((o) => o.library_template_id === t.id && o.property_id === h);
        const arhaTitles = allLive.filter((o) => o.source === "arha" && o.property_id === h && o.status !== "complete").map((o) => o.title);
        return !started && !duplicatesArha(t.category, t.title, arhaTitles);
      });
      return openHomes.length > 0;
    });
    const startableHomes = (t: LibraryTemplate) =>
      homes.filter((h) => {
        const started = allLive.some((o) => o.library_template_id === t.id && o.property_id === h.propertyId);
        const arhaTitles = allLive.filter((o) => o.source === "arha" && o.property_id === h.propertyId && o.status !== "complete").map((o) => o.title);
        return !started && !duplicatesArha(t.category, t.title, arhaTitles);
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
  }, [live.data, library.data, homes, selectedHomeId, live.isLoading, library.isLoading]);
}

export function OwnerOpportunities({
  onLogHours,
  readOnly = false,
  homes = [],
  selectedHomeId = null,
  blockedReason = null,
  focusId = null,
  variant = "full",
  onViewAll,
  arhaExtra,
  queue = null,
  onQueueChange,
  onBackToDashboard,
}: {
  /** Dashboard card filter applied to the ARHA Opportunities (full page only). */
  queue?: OwnerQueue | null;
  onQueueChange?: (q: OwnerQueue | null) => void;
  onBackToDashboard?: () => void;
  focusId?: string | null;
  onLogHours?: (activity: string, propertyId: string | null) => void;
  readOnly?: boolean;
  homes?: OpportunityHome[];
  /** Portal-wide property filter; null = All Homes (a view, never a home). */
  selectedHomeId?: string | null;
  blockedReason?: string | null;
  variant?: "preview" | "full";
  onViewAll?: () => void;
  /** Ticket-based property items the homeowner may review (ARHA column, full page). */
  arhaExtra?: ReactNode;
}) {
  const data = useOwnerOpportunityData(homes, selectedHomeId);
  const [statusFilter, setStatusFilter] = useState<"open" | "completed">("open");
  const [openId, setOpenId] = useState<string | null>(focusId);
  const [startFor, setStartFor] = useState<LibraryTemplate | null>(null);
  useEffect(() => { if (focusId) setOpenId(focusId); }, [focusId]);

  const preview = variant === "preview";
  const limit = preview ? 3 : Infinity;
  const pick = (rows: Live[]) =>
    preview ? rows.filter((r) => !r.finished) : rows.filter((r) => (statusFilter === "open" ? !r.finished : r.finished));
  const queued = !preview && queue;
  const arha = queued ? data.arha.filter((r) => inQueue(r.queue, queue)) : pick(data.arha);
  const optionalLive = queued ? [] : pick(data.optional);
  const templates = queued ? [] : statusFilter === "open" || preview ? data.templates : [];
  const queueLabel = queue ? OWNER_QUEUES.find((q) => q.key === queue)?.label ?? null : null;
  const all = [...data.arha, ...data.optional];
  const opened = all.find((o) => o.id === openId) ?? null;
  const multi = homes.length > 1;
  const showProperty = multi;

  const qc = useQueryClient();
  const start = useServerFn(startOptionalOpportunity);
  const starting = useMutation({
    mutationFn: (v: { templateId: string; propertyId: string }) => start({ data: v }),
    onSuccess: async (r) => {
      setStartFor(null);
      await qc.invalidateQueries({ queryKey: ["owner-opportunities"] });
      toast.success("Opportunity started.");
      setOpenId(r.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start this Opportunity."),
  });
  const beginStart = (t: LibraryTemplate) => {
    if (readOnly || starting.isPending) return;
    if (selectedHomeId) starting.mutate({ templateId: t.id, propertyId: selectedHomeId });
    else if (homes.length === 1 && homes[0]) starting.mutate({ templateId: t.id, propertyId: homes[0].propertyId });
    else setStartFor(t);
  };

  return (
    <section aria-labelledby="owner-opps-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="owner-opps-heading" className="text-lg font-semibold">Opportunities</h2>
          <p className="text-sm text-muted-foreground">
            Your participation can help move certain parts of your property's setup forward. ARHA will continue
            managing the property according to its approved scope, timeline, design approach, and property-readiness
            standards.
          </p>
        </div>
        {preview ? (
          onViewAll ? <Button variant="outline" size="sm" onClick={onViewAll}>View all Opportunities</Button> : null
        ) : queue ? null : (
          <div className="flex gap-1.5" role="tablist" aria-label="Show">
            {(["open", "completed"] as const).map((k) => (
              <Button key={k} size="sm" role="tab" aria-selected={statusFilter === k} variant={statusFilter === k ? "default" : "outline"} onClick={() => setStatusFilter(k)}>
                {k === "open" ? "Open" : "Completed"}
              </Button>
            ))}
          </div>
        )}
      </div>
      {!preview ? (
        <div className="space-y-2">
          {queueLabel ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-sm">Showing: <span className="font-semibold">{queueLabel}</span></p>
              <div className="flex flex-wrap gap-2">
                {onBackToDashboard ? <Button size="sm" variant="outline" onClick={onBackToDashboard}>Back to Dashboard</Button> : null}
                <Button size="sm" variant="outline" onClick={() => onQueueChange?.(null)}>View All Opportunities</Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter Opportunities">
            <Button size="sm" role="tab" aria-selected={!queue} variant={!queue ? "default" : "outline"} onClick={() => onQueueChange?.(null)}>All</Button>
            {OWNER_QUEUES.map((q) => (
              <Button key={q.key} size="sm" role="tab" aria-selected={queue === q.key} variant={queue === q.key ? "default" : "outline"} onClick={() => onQueueChange?.(q.key)}>
                {q.label} <span className="numeric ml-1 opacity-70">{data.counts[q.key]}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {blockedReason ? (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{blockedReason}</p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* FROM YOUR ARHA TEAM */}
        <div className="rounded-2xl border border-info/20 bg-info/5 p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-info">From your ARHA team</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Opportunities shared by your ARHA team as part of your property's setup and ongoing care.
          </p>
          <ul className="mt-4 space-y-3">
            {arha.slice(0, limit).map((o) => (
              <OppCard
                key={o.id}
                tone="arha"
                cover={o.cover}
                title={o.title}
                property={showProperty || !selectedHomeId ? o.propertyName : null}
                label={o.team}
                summary={o.summary}
                status={arhaStatus(o)}
                priority={inQueue(o.queue, "attention")}
                action={<Button size="sm" onClick={() => setOpenId(o.id)}>Open Opportunity</Button>}
              />
            ))}
          </ul>
          {arha.length === 0 && !data.loading ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {statusFilter === "completed" && !preview
                ? "No completed Opportunities from your ARHA team yet."
                : queueLabel
                  ? `Nothing in ${queueLabel} right now.`
                  : "Nothing needs your attention from the ARHA team right now."}
            </p>
          ) : null}
          {preview && arha.length > limit ? (
            <p className="mt-3 text-xs text-muted-foreground">+{arha.length - limit} more on the Opportunities page</p>
          ) : null}
          {!preview && arhaExtra ? <div className="mt-4 space-y-2"><p className="text-sm font-semibold">Property items you can review</p>{arhaExtra}</div> : null}
        </div>

        {/* MORE WAYS TO PARTICIPATE */}
        <div className="rounded-2xl border border-sage/25 bg-sage/5 p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">More ways to participate</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Additional, optional ways to participate remotely in work related to your properties.
          </p>
          <ul className="mt-4 space-y-3">
            {optionalLive.slice(0, limit).map((o) => (
              <OppCard
                key={o.id}
                tone="optional"
                cover={o.cover}
                title={o.title}
                property={o.propertyName}
                label="Optional"
                summary={o.summary}
                status={o.finished ? "Completed" : "In Progress"}
                meta={minutesLabel(o.suggestedMinutes)}
                action={<Button size="sm" variant="outline" onClick={() => setOpenId(o.id)}>Open</Button>}
              />
            ))}
            {templates.slice(0, preview ? Math.max(0, limit - Math.min(optionalLive.length, limit)) : Infinity).map((t) => (
              <OppCard
                key={t.id}
                tone="optional"
                cover={imageFor(t.image_key)}
                title={t.title}
                property={selectedHomeId ? homes.find((h) => h.propertyId === selectedHomeId)?.name ?? null : homes.length === 1 ? homes[0]?.name ?? null : null}
                propertyHint={!selectedHomeId && homes.length > 1 ? "Choose a property when you start" : null}
                label="Optional"
                summary={t.summary}
                meta={minutesLabel(t.suggested_minutes)}
                action={
                  readOnly ? null : (
                    <Button size="sm" className="bg-sage text-success-foreground hover:bg-sage/90" disabled={starting.isPending} onClick={() => beginStart(t)}>
                      Start Opportunity
                    </Button>
                  )
                }
              />
            ))}
          </ul>
          {optionalLive.length === 0 && templates.length === 0 && !data.loading ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {statusFilter === "completed" && !preview ? "No completed optional Opportunities yet." : "Explore optional ways to participate remotely in your property."}
            </p>
          ) : null}
        </div>
      </div>

      <OpportunityDetail
        item={opened}
        onClose={() => setOpenId(null)}
        readOnly={readOnly}
        homes={homes}
        blockedReason={blockedReason}
        {...(onLogHours ? { onLogHours } : {})}
      />

      <Dialog open={startFor !== null} onOpenChange={(v) => !v && setStartFor(null)}>
        {startFor ? (
          <StartDialog
            template={startFor}
            homes={data.startableHomes(startFor)}
            busy={starting.isPending}
            onStart={(propertyId) => starting.mutate({ templateId: startFor.id, propertyId })}
          />
        ) : null}
      </Dialog>
      {multi ? null : null}
    </section>
  );
}

function OppCard({
  tone, cover, title, property, propertyHint = null, label, summary, status = null, meta = null, action, priority = false,
}: {
  priority?: boolean;
  tone: "arha" | "optional";
  cover: string;
  title: string;
  property: string | null;
  propertyHint?: string | null;
  label: string | null;
  summary: string;
  status?: string | null;
  meta?: string | null;
  action: ReactNode;
}) {
  const statusClass =
    status === "Completed" ? "text-state-done" : status === "New" || status === "Awaiting Your Response" ? "text-info" : "text-muted-foreground";
  return (
    <li className="flex gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm sm:gap-4">
      <img
        src={cover}
        alt=""
        loading="lazy"
        width={1024}
        height={640}
        className="h-20 w-24 shrink-0 rounded-lg object-cover sm:h-24 sm:w-32"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-x-2">
          <p className="font-semibold leading-snug">{title}</p>
          {priority ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              <AlertCircle className="size-3.5" aria-hidden="true" /> Needs your attention
            </span>
          ) : null}
          {status ? (
            <span className={`flex items-center gap-1 text-xs font-medium ${statusClass}`}>
              {status === "Completed" ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : null}
              {status}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {[property ?? propertyHint, label, meta].filter(Boolean).map((part, i) => (
            <span key={i}>
              {i > 0 ? " · " : ""}
              <span className={i === 0 && property ? "font-medium text-foreground" : tone === "optional" && part === "Optional" ? "font-medium text-sage" : ""}>{part}</span>
            </span>
          ))}
        </p>
        {summary ? <p className="line-clamp-2 text-sm text-muted-foreground">{summary}</p> : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </li>
  );
}

function StartDialog({
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
            <Link2 className="size-3.5" /> {r.label}{r.note ? <span className="text-muted-foreground"> — {r.note}</span> : null}
          </a>
        ),
      )}
    </>
  );
}

/** The full Opportunity. Opening an ARHA Opportunity is what records it as viewed. */
function OpportunityDetail({
  item, onClose, readOnly, homes, blockedReason, onLogHours,
}: {
  item: Live | null;
  onClose: () => void;
  readOnly: boolean;
  homes: OpportunityHome[];
  blockedReason: string | null;
  onLogHours?: (activity: string, propertyId: string | null) => void;
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

  return (
    <Dialog open={item !== null} onOpenChange={(v) => !v && onClose()}>
      {item ? (
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <img src={item.cover} alt="" width={1024} height={640} className="-mx-6 -mt-6 h-40 w-[calc(100%+3rem)] max-w-none rounded-t-lg object-cover" />
          <DialogHeader>
            <DialogTitle>{item.title}</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{item.propertyName}</span>
              {" · "}
              {arha ? item.team ?? "From your ARHA team" : <span className="text-sage">Optional participation</span>}
              {item.finished ? " · Completed" : ""}
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3 text-sm">
            {item.what ? <div><dt className="font-medium">What you'll do</dt><dd className="whitespace-pre-wrap text-muted-foreground">{item.what}</dd></div> : null}
            {item.why ? <div><dt className="font-medium">{arha ? "Why this matters" : "Why it matters"}</dt><dd className="whitespace-pre-wrap text-muted-foreground">{item.why}</dd></div> : null}
            {item.how ? <div><dt className="font-medium">{arha ? "How to complete it" : "How to complete it remotely"}</dt><dd className="whitespace-pre-wrap text-muted-foreground">{item.how}</dd></div> : null}
            {item.resources.length ? (
              <div><dt className="font-medium">Resources from your ARHA team</dt><dd className="space-y-0.5"><ResourceLinks items={item.resources} /></dd></div>
            ) : null}
            {item.templateLink ? (
              <div><dt className="font-medium">Helpful link</dt><dd><a href={item.templateLink.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Link2 className="size-3.5" /> {item.templateLink.label}</a></dd></div>
            ) : null}
            {item.document ? <div><dt className="font-medium">Ways to document your participation</dt><dd className="whitespace-pre-wrap text-muted-foreground">{item.document}</dd></div> : null}
            {item.suggestedMinutes ? <div><dt className="font-medium">Suggested time</dt><dd className="text-muted-foreground">{minutesLabel(item.suggestedMinutes)} — log the time you actually spend.</dd></div> : null}
          </dl>

          {linked.length ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">Your documentation</p>
              <ul className="space-y-2">{linked.map((f) => <OwnerFileRow key={f.id} f={f} showHome={false} />)}</ul>
            </div>
          ) : null}

          {arha && (item.responses.length || item.finished) ? (
            <OwnerConversation
              workItemId={item.id}
              status={item.finished ? "complete" : "open"}
              legacy={item.responses}
              viewer="homeowner"
              readOnly={readOnly}
              refreshKeys={[["owner-opportunities"]]}
            />
          ) : null}

          {canRespond ? (
            <div className="space-y-2">
              {(t.includes("feedback") || t.includes("decision")) && !item.responses.length ? (
                <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share your thoughts or the changes you'd like…" aria-label="Your response" />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {t.includes("acknowledge") && !item.responses.length ? <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => send.mutate({ kind: "acknowledge" })}>I&apos;ve reviewed this</Button> : null}
                {t.includes("feedback") && !item.responses.length ? <Button size="sm" disabled={send.isPending || !text.trim()} onClick={() => send.mutate({ kind: "feedback" })}>Send feedback</Button> : null}
                {t.includes("decision") ? (
                  <>
                    <Button size="sm" disabled={send.isPending} onClick={() => send.mutate({ kind: "decision", decision: "authorize" })}>Authorize</Button>
                    <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => send.mutate({ kind: "decision", decision: "changes" })}>Request changes</Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {!readOnly ? (
            <DialogFooter className="flex-wrap gap-2 sm:justify-start">
              {homes.length ? <Button size="sm" variant="outline" onClick={() => setUpload(true)}>Upload documentation</Button> : null}
              {onLogHours && !blockedReason ? (
                <Button size="sm" variant="outline" onClick={() => { const p = item.propertyId; const a = item.title; onClose(); onLogHours(a, p); }}>
                  <Clock className="size-4" aria-hidden="true" /> Log time
                </Button>
              ) : null}
              {!item.finished ? <Button size="sm" disabled={done.isPending} onClick={() => done.mutate()}>Mark complete</Button> : null}
            </DialogFooter>
          ) : null}

          <OwnerUploadDialog
            open={upload}
            onOpenChange={setUpload}
            homes={homes}
            fixedPropertyId={item.propertyId}
            opportunity={{ id: item.id, title: item.title }}
            defaultCategory="participation"
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
