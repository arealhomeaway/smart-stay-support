/**
 * The homeowner's one Opportunities page (approved board "Owner portal: one
 * Opportunities page"). Every owner item shows here as one Opportunities card:
 * staff-sent items (Opportunities, Send to the homeowner, older onboarding
 * approvals and decisions), automatic plan cards and optional library cards.
 *
 * Groups, chips, order and home tabs come only from src/lib/owner-opportunity-board.ts.
 * Each source keeps its own canonical record and actions; opening a card opens
 * that source's own side panel. Instructions and form fields live only in the panel.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouteContext } from "@tanstack/react-router";
import { ChevronDown, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { OpportunityDetail, StartDialog, arhaStatus, useOwnerOpportunityData, type Live, type OpportunityHome } from "@/components/owner/OwnerOpportunities";
import { OwnerSidePanel, PanelSection } from "@/components/owner/OwnerSidePanel";
import { PlanCardForm } from "@/components/owner/OwnerPlanCards";
import { OwnerItemConversation } from "@/components/owner/OwnerItemConversation";
import { OwnerApprovalPanel } from "@/components/OwnerApprovalPanel";
import { OnboardingActions } from "@/components/owner/OnboardingActions";
import { LibraryVideoPlayer, useLibraryVideoIndex } from "@/components/owner/LibraryVideoPlayer";
import { loadOwnerItemLastSpeakers, loadOwnerPortalPlan, loadOwnerOutsideLines, type OwnerPortalPlanRow } from "@/lib/ao-data";
import { portalCardView } from "@/lib/ao-ui";
import { inQueue } from "@/lib/owner-opportunity-filters";
import { ownerApprovals } from "@/lib/owner-portal.functions";
import { ownerOnboardingActions } from "@/lib/owner-onboarding.functions";
import { ownerReviewPresentation } from "@/lib/owner-review-presentation";
import { startOptionalOpportunity, type LibraryTemplate } from "@/lib/opportunity-library.functions";
import { arhaCover, imageFor } from "@/lib/opportunity-images";
import {
  HOME_READY_VISIBLE,
  READY_VISIBLE,
  answerChip,
  boardGroup,
  boardView,
  cardLine,
  centralToday,
  isArhaSetupStep,
  streetOnly,
  mergeOncePerOwner,
  mostUrgentHome,
  needYouCount,
  needYouLabel,
  planCardOptional,
  shortDate,
  sourceLine,
  type BoardItem,
} from "@/lib/owner-opportunity-board";

/** The owner item fields the board reads; owner.tsx passes its full rows. */
export type BoardReview = {
  id: string;
  title: string;
  status: string;
  phase: string;
  auto_ticket?: boolean;
  owner_request?: { ownerActionRequired?: boolean | null } | null;
  responded_at?: string | null;
  updated_at?: string;
  available_from?: string | null;
  business_question: string | null;
  recommendation: string | null;
  respond_by: string | null;
  propertyIds: string[];
};

type Item = BoardItem & { cardCode?: string | null; oncePerOwner?: boolean; status: string };

const DONE_REVIEW = new Set(["answered", "closed", "acknowledged", "complete", "completed", "cancelled", "archived", "resolved"]);

export function OwnerOpportunityBoard({
  variant,
  programId,
  homes,
  reviews,
  readOnly,
  preview,
  homeTab,
  onHomeTab,
  focusId = null,
  onCloseDetail,
  onViewAll,
  renderReview,
  onLogHours,
  blockedReason = null,
}: {
  /** "full" = the Opportunities page; "home" = the portal home page preview. */
  variant: "full" | "home";
  programId: string;
  homes: OpportunityHome[];
  reviews: BoardReview[];
  readOnly: boolean;
  /** Staff preview of a program (reads that program's onboarding items). */
  preview: boolean;
  /** Full page: the home tab from the link ("all", a home id, or none). Home page: the selected home or none. */
  homeTab: string | null;
  onHomeTab?: (tab: string) => void;
  focusId?: string | null;
  onCloseDetail?: () => void;
  onViewAll?: () => void;
  renderReview: (review: BoardReview, open: boolean, onOpenChange: (next: boolean) => void) => ReactNode;
  onLogHours?: (activity: string, propertyId: string | null) => void;
  blockedReason?: string | null;
}) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const today = centralToday();
  const multi = homes.length > 1;

  // Plan cards (automatic), with the owner item each one created.
  const plan = useQuery({ queryKey: ["ao-owner-plan", programId, "portal"], queryFn: () => loadOwnerPortalPlan(programId), retry: false });
  const planRows: OwnerPortalPlanRow[] = plan.data?.available ? plan.data.data : [];
  // Item 2: cards for work done outside Resolve say where to look instead of asking for an upload.
  const outside = useOutsideLines(programId);
  const planTitles = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of planRows) if (c.property_id) m.set(c.property_id, [...(m.get(c.property_id) ?? []), c.title]);
    return m;
  }, [planRows]);

  const opp = useOwnerOpportunityData(homes, null, planTitles);
  const loadApprovals = useServerFn(ownerApprovals);
  const approvals = useQuery({ queryKey: ["owner-approvals", user.id], queryFn: () => loadApprovals() });
  const loadOnboarding = useServerFn(ownerOnboardingActions);
  const onboarding = useQuery({
    queryKey: ["owner-onboarding", preview ? programId : null, preview],
    queryFn: () => loadOnboarding({ data: { programId: preview ? programId : null, preview } }),
  });
  const reviewIds = useMemo(() => reviews.map((r) => r.id).sort(), [reviews]);
  const speakers = useQuery({
    queryKey: ["owner-item-speakers", reviewIds],
    queryFn: () => loadOwnerItemLastSpeakers(reviewIds),
    retry: false,
  });

  // Fix 3: the street address only.
  // The home's name here is already its street label (formatPropertyLabel primary, unit included);
  // its address field is the city and state, so it is only a fallback.
  const homeName = (id: string) => homes.find((h) => h.propertyId === id)?.name || streetOnly(homes.find((h) => h.propertyId === id)?.address) || null;
  const photo = (id: string | null | undefined) => homes.find((h) => h.propertyId === id)?.photoUrl ?? null;

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const planReviews = new Set(planRows.map((c) => c.owner_review_id).filter(Boolean) as string[]);
    const reviewSet = new Set(reviews.map((r) => r.id));

    for (const c of planRows) {
      const view = portalCardView(c);
      out.push({
        key: `plan:${c.plan_card_id}`,
        source: "plan",
        id: c.plan_card_id,
        title: c.title,
        propertyIds: c.property_id ? [c.property_id] : [],
        from: "Your homeowner plan",
        summary: oneLine(view.kind === "locked" ? "" : outside.get(`plan:${c.plan_card_id}`) ?? c.what_text),
        cover: arhaCover(c.title, [], photo(c.property_id)),
        sentAt: c.unlocked_at,
        answerBy: null,
        deadline: c.deadline_at ?? null,
        needsAnswer: false,
        newReply: Boolean(c.owner_review_id && speakers.data?.get(c.owner_review_id) === "staff" && view.kind === "open"),
        optional: planCardOptional(c),
        locked: view.kind === "locked",
        finished: view.kind === "done" || view.kind === "closed",
        opensText: c.opens_text,
        cardCode: c.code ?? null,
        oncePerOwner: Boolean(c.once_per_owner),
        status: view.kind,
      });
    }

    for (const r of reviews) {
      if (planReviews.has(r.id)) continue;
      const p = ownerReviewPresentation(r as never);
      const speaker = speakers.data?.get(r.id) ?? null;
      const newReply = speaker === "staff";
      const finished = !p.attention && DONE_REVIEW.has(r.status) && !newReply;
      out.push({
        key: `review:${r.id}`,
        source: "review",
        id: r.id,
        title: r.title,
        propertyIds: r.propertyIds,
        from: r.auto_ticket ? "Operations Team" : "Onboarding Team",
        summary: oneLine(outside.get(`review:${r.id}`) ?? r.business_question ?? r.recommendation),
        cover: arhaCover(r.title, [], photo(r.propertyIds[0])),
        sentAt: r.available_from ?? r.updated_at ?? null,
        answerBy: r.respond_by,
        deadline: r.respond_by,
        needsAnswer: p.attention && speaker !== "homeowner",
        newReply,
        withArha: !finished && speaker === "homeowner",
        optional: false,
        locked: false,
        finished,
        // Fix 25: after the owner's reply the item reads With ARHA until staff reply.
        status: !finished && speaker === "homeowner" ? "With ARHA" : p.label,
      });
    }

    for (const a of [...(onboarding.data?.pending ?? []), ...(onboarding.data?.decided ?? [])]) {
      if (a.participation?.reviewId && reviewSet.has(a.participation.reviewId)) continue;
      const pending = a.status === "pending";
      out.push({
        key: `action:${a.approvalId}`,
        source: "action",
        id: a.approvalId,
        title: a.title,
        propertyIds: a.propertyId ? [a.propertyId] : [],
        from: "Onboarding Team",
        summary: oneLine(a.detail),
        cover: arhaCover(a.title, a.files.map((f) => f.title), photo(a.propertyId)),
        sentAt: a.createdAt,
        answerBy: a.dueOn,
        deadline: a.dueOn,
        needsAnswer: pending,
        newReply: false,
        optional: false,
        locked: false,
        finished: !pending,
        status: pending ? "Waiting on you" : a.status === "approved" ? "Approved" : "Changes requested",
      });
    }

    for (const a of approvals.data?.approvals ?? []) {
      if (a.entity_type === "onboarding_task") continue;
      if (homes.length && a.property_id && !homes.some((h) => h.propertyId === a.property_id)) continue;
      const pending = a.status === "pending";
      out.push({
        key: `approval:${a.id}`,
        source: "approval",
        id: a.id,
        title: a.title,
        propertyIds: a.property_id ? [a.property_id] : [],
        from: "Operations Team",
        summary: oneLine(a.detail),
        cover: arhaCover(a.title, [], photo(a.property_id)),
        sentAt: a.created_at,
        answerBy: a.due_on,
        deadline: a.due_on,
        needsAnswer: pending,
        newReply: false,
        optional: false,
        locked: false,
        finished: !pending,
        status: pending ? "Waiting on you" : a.status === "approved" ? "Approved" : "Changes requested",
      });
    }

    for (const o of [...opp.arha, ...opp.optional]) {
      const arha = o.source === "arha";
      out.push({
        key: `work:${o.id}`,
        source: "work",
        id: o.id,
        title: o.title,
        propertyIds: o.propertyId ? [o.propertyId] : [],
        from: arha ? (o.team?.includes("Operations") ? "Operations Team" : "Onboarding Team") : "Optional",
        summary: oneLine(outside.get(`work:${o.id}`) ?? o.summary),
        cover: o.cover,
        sentAt: o.createdAt,
        answerBy: o.dueOn ?? null,
        deadline: o.dueOn ?? null,
        needsAnswer: inQueue(o.queue, "awaiting"),
        newReply: !o.finished && o.queue.lastSpeaker === "staff",
        withArha: !o.finished && o.queue.lastSpeaker === "homeowner",
        optional: !arha,
        locked: false,
        finished: o.finished,
        status: arha ? arhaStatus(o) : o.finished ? "Completed" : "In progress",
      });
    }

    for (const t of opp.templates) {
      const startable = opp.startableHomes(t).map((h) => h.propertyId);
      out.push({
        key: `template:${t.id}`,
        source: "template",
        id: t.id,
        title: t.title,
        propertyIds: startable,
        from: "Optional",
        summary: oneLine(t.summary),
        cover: imageFor(t.image_key),
        sentAt: null,
        answerBy: null,
        deadline: null,
        needsAnswer: false,
        newReply: false,
        optional: true,
        locked: false,
        finished: false,
        status: "Optional",
      });
    }
    // Fix 5: ARHA's setup step never shows as owner work.
    return mergeOncePerOwner(out.filter((i) => !isArhaSetupStep(i.title)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planRows, reviews, onboarding.data, approvals.data, opp, speakers.data, homes, outside]);

  // Which tab is showing.
  const homeIds = homes.map((h) => h.propertyId);
  const tab: string | null =
    variant === "home"
      ? homeTab && homeIds.includes(homeTab) ? homeTab : null
      : !multi
        ? null
        : homeTab === "all" || (homeTab && homeIds.includes(homeTab))
          ? homeTab
          : mostUrgentHome(items, homeIds, today);
  const view = boardView(items, tab);

  // Which panel is open.
  const [openKey, setOpenKey] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    const hit = items.find((i) => i.id === focusId);
    if (hit) setOpenKey(hit.key);
  }, [focusId, items]);
  const close = () => {
    setOpenKey(null);
    onCloseDetail?.();
  };
  const opened = items.find((i) => i.key === openKey) ?? null;

  const [moreReady, setMoreReady] = useState(false);
  const [soonOpen, setSoonOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [startFor, setStartFor] = useState<LibraryTemplate | null>(null);

  const qc = useQueryClient();
  const start = useServerFn(startOptionalOpportunity);
  const starting = useMutation({
    mutationFn: (v: { templateId: string; propertyId: string }) => start({ data: v }),
    onSuccess: async (r) => {
      setStartFor(null);
      await qc.invalidateQueries({ queryKey: ["owner-opportunities"] });
      toast.success("Opportunity started.");
      setOpenKey(`work:${r.id}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start this Opportunity."),
  });
  const beginStart = (t: LibraryTemplate) => {
    if (readOnly || starting.isPending) return;
    const homesFor = opp.startableHomes(t);
    const pick = tab && tab !== "all" ? tab : homesFor.length === 1 ? homesFor[0]!.propertyId : null;
    if (pick) starting.mutate({ templateId: t.id, propertyId: pick });
    else setStartFor(t);
  };

  const loading = plan.isLoading || opp.loading || onboarding.isLoading || approvals.isLoading;
  const home = variant === "home";
  const readyShown = home ? view.ready.slice(0, HOME_READY_VISIBLE) : moreReady ? view.ready : view.ready.slice(0, READY_VISIBLE);
  const readyHidden = view.ready.length - readyShown.length;

  const card = (i: Item) => (
    <OppCard
      key={i.key}
      item={i}
      line={sourceLine(i, homeName, multi)}
      today={today}
      onOpen={() => {
        if (i.source === "template") {
          const t = opp.templates.find((x) => x.id === i.id);
          if (t) setOpenKey(i.key);
        } else setOpenKey(i.key);
      }}
    />
  );

  return (
    <section aria-labelledby="owner-opps-heading" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="owner-opps-heading" className="text-lg font-semibold">Opportunities</h2>
      </div>

      {!home && multi ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Your homes">
          {homes.map((h) => (
            <Button
              key={h.propertyId}
              role="tab"
              aria-selected={tab === h.propertyId}
              variant={tab === h.propertyId ? "default" : "outline"}
              className="min-h-11 shrink-0"
              onClick={() => onHomeTab?.(h.propertyId)}
            >
              {homeName(h.propertyId)} · {needYouLabel(needYouCount(items, h.propertyId))}
            </Button>
          ))}
          <Button
            role="tab"
            aria-selected={tab === "all"}
            variant={tab === "all" ? "default" : "outline"}
            className="min-h-11 shrink-0"
            onClick={() => onHomeTab?.("all")}
          >
            All homes: just what needs you
          </Button>
        </div>
      ) : null}

      {blockedReason ? (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{blockedReason}</p>
      ) : null}

      <Group
        title="Needs your answer"
        count={view.answer.length}
        countTone="answer"
        note="Waiting on you."
        empty={loading ? "Loading…" : "Nothing is waiting on you right now."}
      >
        {view.answer.map(card)}
      </Group>

      {!home && tab !== "all" && view.with_arha.length > 0 ? (
        <Group title="With ARHA" count={view.with_arha.length} note="You answered. ARHA replies next." empty="">
          {view.with_arha.map(card)}
        </Group>
      ) : null}

      {tab === "all" ? null : (
        <Group
          title="Ready for you"
          count={view.ready.length}
          note={`Setup and live-home work, showing the ${home ? HOME_READY_VISIBLE : READY_VISIBLE} closest to their deadline.`}
          empty={loading ? "Loading…" : "Nothing else is ready right now."}
        >
          {readyShown.map(card)}
          {!home && readyHidden > 0 ? (
            <li className="min-[900px]:col-span-2">
              <Button variant="outline" className="min-h-11 w-full" onClick={() => setMoreReady(true)}>
                Show {readyHidden} more here
              </Button>
            </li>
          ) : null}
        </Group>
      )}

      {home ? (
        onViewAll ? (
          <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={onViewAll}>
            View all opportunities
          </Button>
        ) : null
      ) : tab === "all" ? null : (
        <>
          <Group
            title="Optional ways to participate"
            count={view.optional.length}
            note="Anytime, at your own pace. Market ones show once for all your homes."
            empty={loading ? "Loading…" : "No optional activities right now."}
          >
            {view.optional.map(card)}
          </Group>

          {view.done.length > 0 ? (
            <Folded label={`Completed (${view.done.length})`} open={doneOpen} onToggle={() => setDoneOpen((v) => !v)}>
              {view.done.map(card)}
            </Folded>
          ) : null}

          {view.soon.length > 0 ? (
            <Folded
              label={`Coming soon (${view.soon.length}) · Opens when ARHA finishes the step before it`}
              open={soonOpen}
              onToggle={() => setSoonOpen((v) => !v)}
            >
              {view.soon.map(card)}
            </Folded>
          ) : null}
        </>
      )}

      {opened ? (
        <ItemPanel
          item={opened}
          programId={programId}
          homes={homes}
          homeName={homeName}
          multi={multi}
          readOnly={readOnly}
          preview={preview}
          reviews={reviews}
          live={[...opp.arha, ...opp.optional]}
          templates={opp.templates}
          renderReview={renderReview}
          onClose={close}
          onStart={beginStart}
          starting={starting.isPending}
          blockedReason={blockedReason}
          {...(onLogHours ? { onLogHours } : {})}
        />
      ) : null}

      <Dialog open={startFor !== null} onOpenChange={(v) => !v && setStartFor(null)}>
        {startFor ? (
          <StartDialog
            template={startFor}
            homes={opp.startableHomes(startFor)}
            busy={starting.isPending}
            onStart={(propertyId) => starting.mutate({ templateId: startFor.id, propertyId })}
          />
        ) : null}
      </Dialog>
    </section>
  );
}

// Fix 2: the first sentence, cut at 90 characters.
const oneLine = cardLine;

function Group({
  title, count, countTone = "plain", note, empty, children,
}: {
  title: string;
  count: number;
  countTone?: "answer" | "plain";
  note: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <span
            className={
              countTone === "answer"
                ? "numeric rounded-full bg-answer-chip px-2 py-0.5 text-xs font-semibold text-answer-chip-foreground"
                : "numeric rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            }
          >
            {count}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="grid gap-3 min-[900px]:grid-cols-2">{children}</ul>}
    </section>
  );
}

function Folded({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-4 text-left text-sm font-medium"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{label}</span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? <ul className="grid gap-3 min-[900px]:grid-cols-2">{children}</ul> : null}
    </section>
  );
}

function OppCard({ item, line, today, onOpen }: { item: Item; line: string; today: string; onOpen: () => void }) {
  const group = boardGroup(item);
  const chip = group === "answer" ? answerChip(item, today) : null;
  const overdue = Boolean(chip?.overdue);
  const shell =
    group === "answer"
      ? overdue
        ? "border-2 border-overdue-border bg-overdue"
        : "border-2 border-answer-border bg-answer"
      : "border border-border bg-card";
  const corner =
    chip ? (
      <span
        className={
          overdue
            ? "numeric rounded-full bg-overdue-border px-2 py-0.5 text-xs font-semibold text-overdue-foreground"
            : "numeric rounded-full bg-answer-chip px-2 py-0.5 text-xs font-semibold text-answer-chip-foreground"
        }
      >
        {chip.text}
      </span>
    ) : (
      <span className="text-xs font-medium text-muted-foreground">{cornerText(item)}</span>
    );
  const button =
    group === "answer" ? (
      <Button size="sm" className="min-h-11 bg-answer-action text-answer-action-foreground hover:bg-answer-action/90" onClick={onOpen}>
        Answer now
      </Button>
    ) : group === "soon" ? (
      <Button size="sm" variant="outline" className="min-h-11" disabled>
        <Lock className="size-4" aria-hidden="true" /> Not open yet
      </Button>
    ) : item.source === "template" ? (
      <Button size="sm" variant="outline" className="min-h-11" onClick={onOpen}>Start</Button>
    ) : (
      <Button size="sm" variant={group === "done" ? "ghost" : "outline"} className="min-h-11" onClick={onOpen}>Open</Button>
    );
  return (
    <li className={`flex gap-3 overflow-hidden rounded-xl p-3 shadow-sm sm:gap-4 ${shell}`}>
      <img src={item.cover} alt="" loading="lazy" width={1024} height={640} className="h-20 w-24 shrink-0 rounded-lg object-cover sm:h-24 sm:w-32" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <p className="font-semibold leading-snug">{item.title}</p>
          {corner}
        </div>
        {line ? <p className="text-xs text-muted-foreground">{line}</p> : null}
        {group === "soon" ? (
          <p className="text-sm text-muted-foreground">Opens when {opensLine(item.opensText)}</p>
        ) : item.summary ? (
          <p className="line-clamp-1 text-sm text-muted-foreground">{item.summary}</p>
        ) : null}
        <div className="mt-1">{button}</div>
      </div>
    </li>
  );
}

function opensLine(text: string | null | undefined) {
  const t = (text ?? "").trim().replace(/[.\s]+$/, "");
  if (!t) return "ARHA finishes the step before it";
  return /^(arha|we|the|your)\b/i.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : `ARHA ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

function cornerText(i: Item): string {
  if (i.finished) return "Completed";
  // Fix 4: optional (anytime) cards show no due date.
  if (i.optional) return "Optional";
  if (i.source === "plan") return i.deadline ? `Due ${shortDate(i.deadline)}` : "Open";
  if (i.source === "template") return "Optional";
  return i.status;
}

/** Opens the item's own panel: each source keeps its own record and actions. */
function ItemPanel({
  item, programId, homes, homeName, multi, readOnly, preview, reviews, live, templates, renderReview, onClose, onStart, starting, blockedReason, onLogHours,
}: {
  item: Item;
  programId: string;
  homes: OpportunityHome[];
  homeName: (id: string) => string | null;
  multi: boolean;
  readOnly: boolean;
  preview: boolean;
  reviews: BoardReview[];
  live: Live[];
  templates: LibraryTemplate[];
  renderReview: (review: BoardReview, open: boolean, onOpenChange: (next: boolean) => void) => ReactNode;
  onClose: () => void;
  onStart: (t: LibraryTemplate) => void;
  starting: boolean;
  blockedReason: string | null;
  onLogHours?: (activity: string, propertyId: string | null) => void;
}) {
  const home = sourceLine({ ...item, from: "" }, homeName, multi);
  const outsideLines = useOutsideLines(programId);
  const onOpenChange = (next: boolean) => { if (!next) onClose(); };
  const logFooter =
    onLogHours && !blockedReason && !readOnly ? (
      <Button className="min-h-11" size="sm" variant="outline" onClick={() => { onClose(); onLogHours(item.title, item.propertyIds[0] ?? null); }}>
        <Clock className="size-4" aria-hidden="true" /> Log hours for this
      </Button>
    ) : null;
  if (item.source === "review") {
    const r = reviews.find((x) => x.id === item.id);
    return r ? <>{renderReview(r, true, onOpenChange)}</> : null;
  }
  if (item.source === "work") {
    const w = live.find((x) => x.id === item.id) ?? null;
    return (
      <OpportunityDetail
        item={w}
        onClose={onClose}
        readOnly={readOnly}
        homes={homes}
        blockedReason={blockedReason}
        statusLabel={item.status}
        outsideLine={outsideLines.get(`work:${item.id}`) ?? null}
        {...(onLogHours ? { onLogHours } : {})}
      />
    );
  }
  if (item.source === "plan") return <PlanCardPanel item={item} programId={programId} home={home} readOnly={readOnly} onOpenChange={onOpenChange} footer={logFooter} />;
  if (item.source === "approval" || item.source === "action") {
    return (
      <OwnerSidePanel open onOpenChange={onOpenChange} status={item.status} title={item.title} home={[home, item.from].filter(Boolean).join(" · ")} sentAt={item.sentAt} answerBy={item.answerBy} footer={logFooter}>
        {item.source === "approval" ? (
          <OwnerApprovalPanel readOnly={readOnly} onlyId={item.id} />
        ) : (
          <OnboardingActions readOnly={readOnly} programId={preview ? programId : null} onlyId={item.id} />
        )}
      </OwnerSidePanel>
    );
  }
  const t = templates.find((x) => x.id === item.id);
  return t ? <TemplatePanel template={t} home={home} readOnly={readOnly} starting={starting} onStart={() => onStart(t)} onOpenChange={onOpenChange} /> : null;
}

function PlanCardPanel({
  item, programId, home, readOnly, onOpenChange, footer,
}: {
  item: Item;
  programId: string;
  home: string;
  readOnly: boolean;
  onOpenChange: (next: boolean) => void;
  footer: ReactNode;
}) {
  const q = useQuery({ queryKey: ["ao-owner-plan", programId, "portal"], queryFn: () => loadOwnerPortalPlan(programId), retry: false });
  const row = q.data?.available ? q.data.data.find((c) => c.plan_card_id === item.id) : undefined;
  const outsideLine = useOutsideLines(programId).get(`plan:${item.id}`) ?? null;
  if (!row) return null;
  const view = portalCardView(row);
  return (
    <OwnerSidePanel
      open
      onOpenChange={onOpenChange}
      cover={item.cover}
      status={item.allHomes ? "All your homes" : view.kind === "done" ? "Completed" : view.kind === "closed" ? "Closed" : !item.optional && row.deadline_at ? `Due ${shortDate(row.deadline_at)}` : item.optional ? "Optional" : "Open"}
      title={row.title}
      home={[home, "Your homeowner plan"].filter(Boolean).join(" · ")}
      sentAt={row.unlocked_at}
      answerBy={item.optional ? null : row.deadline_at ?? null}
      footer={footer}
    >
      {outsideLine || row.what_text ? <PanelSection label="What we're asking"><p className="whitespace-pre-wrap text-muted-foreground">{outsideLine ?? row.what_text}</p></PanelSection> : null}
      {item.allHomes ? <p className="text-sm text-muted-foreground">Answer once and it counts for every one of your homes.</p> : null}
      {view.kind === "open" ? (
        <PanelSection label="Your answer">
          <PlanCardForm planCardId={row.plan_card_id} programId={programId} fields={view.fields} readOnly={readOnly} />
        </PanelSection>
      ) : view.kind === "done" ? (
        <p className="text-sm text-muted-foreground">Done. Thank you.</p>
      ) : view.kind === "closed" ? (
        <p className="text-sm text-muted-foreground">This item has closed. ARHA is taking care of it.</p>
      ) : (
        <p className="text-sm text-muted-foreground">{view.text}</p>
      )}
      {row.owner_review_id ? <OwnerItemConversation reviewId={row.owner_review_id} side="owner" readOnly={readOnly} /> : null}
    </OwnerSidePanel>
  );
}

function TemplatePanel({
  template, home, readOnly, starting, onStart, onOpenChange,
}: {
  template: LibraryTemplate;
  home: string;
  readOnly: boolean;
  starting: boolean;
  onStart: () => void;
  onOpenChange: (next: boolean) => void;
}) {
  const videos = useLibraryVideoIndex();
  const video = videos.get(template.id);
  return (
    <OwnerSidePanel
      open
      onOpenChange={onOpenChange}
      cover={imageFor(template.image_key)}
      status="Optional"
      title={template.title}
      home={[home, "Optional"].filter(Boolean).join(" · ")}
      footer={
        readOnly ? null : (
          <Button className="min-h-11" size="sm" disabled={starting} onClick={onStart}>
            {starting ? "Starting…" : "Start"}
          </Button>
        )
      }
    >
      {video ? <LibraryVideoPlayer libraryId={template.id} poster={imageFor(template.image_key)} label={video.label} /> : null}
      {template.what || template.summary ? (
        <PanelSection label="What we're asking"><p className="whitespace-pre-wrap text-muted-foreground">{template.what || template.summary}</p></PanelSection>
      ) : null}
      {template.why ? <PanelSection label="Why it matters"><p className="whitespace-pre-wrap text-muted-foreground">{template.why}</p></PanelSection> : null}
      {template.how ? <PanelSection label="How to complete it remotely"><p className="whitespace-pre-wrap text-muted-foreground">{template.how}</p></PanelSection> : null}
      {template.resource_url ? (
        <PanelSection label="Files">
          <a href={template.resource_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{template.resource_label || "Learn more"}</a>
        </PanelSection>
      ) : null}
    </OwnerSidePanel>
  );
}


/** Item 2: the outside-Resolve owner lines for this program (shared cache). */
export function useOutsideLines(programId: string): Map<string, string> {
  const q = useQuery({ queryKey: ["owner-outside-lines", programId], queryFn: () => loadOwnerOutsideLines(programId), retry: false, staleTime: 60_000 });
  return q.data ?? EMPTY_LINES;
}
const EMPTY_LINES = new Map<string, string>();
