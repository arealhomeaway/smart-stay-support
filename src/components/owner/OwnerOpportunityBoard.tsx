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
import { LoadError } from "@/components/ui/page";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouteContext } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { OpportunityDetail, StartDialog, arhaStatus, useOwnerOpportunityData, type Live, type OpportunityHome } from "@/components/owner/OwnerOpportunities";
import { OwnerSidePanel, PanelSection } from "@/components/owner/OwnerSidePanel";
import { PlanCardForm } from "@/components/owner/OwnerPlanCards";
import { OwnerItemConversation } from "@/components/owner/OwnerItemConversation";
import { OwnerApprovalPanel } from "@/components/OwnerApprovalPanel";
import { OnboardingActions } from "@/components/owner/OnboardingActions";
import { LibraryVideoIndexError, LibraryVideoPlayer, useLibraryVideoIndex } from "@/components/owner/LibraryVideoPlayer";
import { loadOwnerItemLastSpeakers, loadOwnerPortalPlan, loadOwnerOutsideLines, type OwnerPortalPlanRow } from "@/lib/ao-data";
import { portalCardView } from "@/lib/ao-ui";
import { inQueue } from "@/lib/owner-opportunity-filters";
import { ownerApprovals } from "@/lib/owner-portal.functions";
import { ownerOnboardingActions } from "@/lib/owner-onboarding.functions";
import { ownerReviewPresentation } from "@/lib/owner-review-presentation";
import { startOptionalOpportunity, type LibraryTemplate } from "@/lib/opportunity-library.functions";
import { arhaCover, imageFor } from "@/lib/opportunity-images";
import { cardPhoto } from "@/lib/owner-card-photos";
import { CompletedCardPanel } from "@/components/owner/CompletedCardPanel";
import {
  HOME_OPPORTUNITIES_VISIBLE,
  PORTAL_GROUPS,
  PORTAL_GROUP_TONE,
  completedLine,
  entriesForCard,
  newestCompletedFirst,
  newestOpenedFirst,
  portalGroupFor,
  portalGroupLabel,
  portalOpensWhen,
  type HourEntry,
  type PortalGroupId,
} from "@/lib/owner-portal-look";
import {
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

type Item = BoardItem & {
  cardCode?: string | null; oncePerOwner?: boolean; status: string;
  /** When the owner finished it (plan cards: owner_completed_at; owner items: responded_at). */
  completedAt?: string | null;
  /** A plan card's owner item (its conversation and anchored hours). */
  reviewId?: string | null;
  outputFields?: unknown;
};

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
  programLive = false,
  hourEntries = NO_ENTRIES,
  onSeeComing,
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
  /** The viewed program is live (not closed or archived): the outside wording's log time sentence. */
  programLive?: boolean;
  /** The owner's logged hours, for "[hours] hrs logged" on completed cards. */
  hourEntries?: HourEntry[];
  /** Home page: "See what's coming" opens Opportunities at Coming soon. */
  onSeeComing?: () => void;
}) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const today = centralToday();
  const multi = homes.length > 1;

  // Plan cards (automatic), with the owner item each one created.
  const plan = useQuery({ queryKey: ["ao-owner-plan", programId, "portal"], queryFn: () => loadOwnerPortalPlan(programId), retry: false });
  const planRows: OwnerPortalPlanRow[] = plan.data?.available ? plan.data.data : [];
  // Item 2: cards for work done outside Resolve say where to look instead of asking for an upload.
  const outside = useOutsideLines(programId, programLive);
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
    queryKey: ["owner-item-speakers", reviewIds, !preview],
    queryFn: () => loadOwnerItemLastSpeakers(reviewIds, !preview),
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
        // Approved mockup item 5: every card its own photo, by card code.
        cover: cardPhoto(c.code) ?? arhaCover(c.title, [], photo(c.property_id)),
        sentAt: c.unlocked_at,
        // Things onboarding needs from the owner carry a deadline (owner_needed cards only): Needs your answer.
        answerBy: view.kind === "open" && !planCardOptional(c) && c.deadline_at ? c.deadline_at : null,
        deadline: c.deadline_at ?? null,
        needsAnswer: view.kind === "open" && !planCardOptional(c) && Boolean(c.deadline_at),
        newReply: Boolean(c.owner_review_id && speakers.data?.get(c.owner_review_id) === "staff" && view.kind === "open"),
        optional: planCardOptional(c),
        locked: view.kind === "locked",
        finished: view.kind === "done" || view.kind === "closed",
        opensText: c.opens_text,
        cardCode: c.code ?? null,
        oncePerOwner: Boolean(c.once_per_owner),
        status: view.kind,
        completedAt: c.owner_completed_at ?? null,
        reviewId: c.owner_review_id ?? null,
        outputFields: c.output_fields,
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
        completedAt: r.responded_at ?? null,
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
        from: arha ? (o.team?.includes("Operations") ? "Operations Team" : "Onboarding Team") : "",
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
        completedAt: o.finished ? o.responses.map((x) => x.at).filter(Boolean).sort().at(-1) ?? null : null,
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
        from: "",
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
        status: "Open",
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

  const [startFor, setStartFor] = useState<LibraryTemplate | null>(null);
  const [filter, setFilter] = useState<PortalGroupId | "all">("all");

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
  // Approved mockup (Nov 16): every open item that is not waiting on an answer is an Opportunity for you, new ones first.
  const forYou = newestOpenedFirst([...view.with_arha, ...view.ready, ...view.optional]);
  const grouped = PORTAL_GROUPS.map((g) => ({ ...g, items: forYou.filter((i) => portalGroupFor(i.cardCode) === g.id) }));
  // Open items with no card group (an Opportunity started from the older Library): still shown under All, with no heading,
  // so open work never disappears. Waiting on the Admin's choice of group.
  const ungrouped = forYou.filter((i) => portalGroupFor(i.cardCode) === null);
  const done = newestCompletedFirst(view.done);

  const openItem = (i: Item) => setOpenKey(i.key);
  const card = (i: Item, kind: "open" | "done" = "open") => (
    <OppCard
      key={i.key}
      item={i}
      kind={kind}
      homeLine={multi ? sourceLine({ ...i, from: "" }, homeName, multi) : ""}
      today={today}
      minutes={kind === "done" ? cardMinutes(i, hourEntries) : 0}
      onOpen={() => openItem(i)}
    />
  );

  const answerNote = home ? "Things onboarding needs from you, with their due dates." : "Things onboarding needs from you so your home stays on schedule. These show a due date.";

  return (
    <section aria-label="Opportunities" className={home ? "space-y-9" : "space-y-9"}>
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
        <p className="rounded-[14px] border border-portal-border bg-card p-3 text-xs text-portal-muted">{blockedReason}</p>
      ) : null}

      <Group title="Needs your answer" count={view.answer.length} note={answerNote} empty={loading ? "Loading…" : "Nothing is waiting on you right now."}>
        {view.answer.map((i) => card(i))}
      </Group>

      {tab === "all" ? (
        view.with_arha.length > 0 ? (
          <Group title="Opportunities for you" count={view.with_arha.length} note="You answered. ARHA replies next." empty="">
            {view.with_arha.map((i) => card(i))}
          </Group>
        ) : null
      ) : home ? (
        <>
          <Group
            title="Opportunities for you"
            count={forYou.length}
            note="All open now. Pick any that interest you, at your own pace. New ones first."
            empty={loading ? "Loading…" : "Nothing else is open right now."}
            right={onViewAll && forYou.length > 0 ? (
              <button type="button" className="min-h-11 text-sm font-medium text-portal-primary underline-offset-4 hover:underline" onClick={onViewAll}>
                View all {forYou.length}
              </button>
            ) : null}
          >
            {forYou.slice(0, HOME_OPPORTUNITIES_VISIBLE).map((i) => card(i))}
          </Group>
          {view.soon.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-dashed border-portal-border bg-card px-5 py-4">
              <p className="text-sm text-portal-ink">
                <span className="font-semibold">Coming soon ({view.soon.length})</span>{" "}
                <span className="text-portal-muted">Opens on its own when our team finishes its part.</span>
              </p>
              {onSeeComing ? (
                <button type="button" className="min-h-11 text-sm font-medium text-portal-primary underline-offset-4 hover:underline" onClick={onSeeComing}>
                  See what's coming
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <section className="space-y-4" aria-label="Opportunities for you">
            <GroupHead title="Opportunities for you" count={forYou.length} />
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Opportunity groups">
              <Pill active={filter === "all"} onClick={() => setFilter("all")}>All ({forYou.length})</Pill>
              {grouped.map((g) => (
                <Pill key={g.id} active={filter === g.id} onClick={() => setFilter(g.id)}>{g.label} ({g.items.length})</Pill>
              ))}
            </div>
            {loading && forYou.length === 0 ? <p className="text-sm text-portal-muted">Loading…</p> : null}
            {grouped.filter((g) => filter === "all" || filter === g.id).map((g) => (
              <SubGroup key={g.id} title={`${g.label} (${g.items.length})`}>
                {g.items.map((i) => card(i))}
              </SubGroup>
            ))}
            {filter === "all" && ungrouped.length > 0 ? (
              <ul className="grid gap-3 md:grid-cols-2">{ungrouped.map((i) => card(i))}</ul>
            ) : null}
          </section>

          <section id="coming-soon" className="scroll-mt-48 space-y-3" aria-label="Coming soon">
            <GroupHead title={loading ? "Coming soon" : `Coming soon (${view.soon.length})`} />
            <p className="text-sm text-portal-muted">These open on their own when our team finishes its part. Nothing to do yet.</p>
            {view.soon.length === 0 ? null : (
              <ul className="grid gap-3 min-[900px]:grid-cols-2">
                {view.soon.map((i) => (
                  <li key={i.key} className="rounded-[14px] border border-dashed border-portal-border bg-card/60 p-4">
                    <p className="text-[15px] font-bold text-portal-ink">{i.title}</p>
                    <p className="mt-1 text-sm text-portal-muted">Opens when {portalOpensWhen(i.opensText)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3" aria-label="Completed">
            <GroupHead title={loading ? "Completed" : `Completed (${done.length})`} />
            <p className="text-sm text-portal-muted">Everything you've finished, newest first. Open one to see what you sent, or to change it.</p>
            {loading ? <p className="text-sm text-portal-muted">Loading…</p> : done.length === 0 ? null : <ul className="grid gap-3 min-[900px]:grid-cols-2">{done.map((i) => card(i, "done"))}</ul>}
          </section>
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
          programLive={programLive}
          entries={hourEntries}
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

function cardMinutes(i: Item, entries: HourEntry[]): number {
  return entriesForCard(entries, { title: i.title, reviewId: i.reviewId ?? (i.source === "review" ? i.id : null), propertyIds: i.propertyIds })
    .reduce((n, e) => n + (Number(e.minutes) || 0), 0);
}

function GroupHead({ title, count, right }: { title: string; count?: number; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-2xl text-portal-ink">{title}</h2>
        {count !== undefined ? (
          <span className="numeric rounded-full bg-portal-homecare px-2.5 py-0.5 text-xs font-semibold text-portal-homecare-ink">{count}</span>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function Group({
  title, count, note, empty, children, right,
}: {
  title: string;
  count: number;
  note: string;
  empty: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div>
        <GroupHead title={title} count={count} right={right} />
        <p className="text-sm text-portal-muted">{note}</p>
      </div>
      {count === 0 ? (empty ? <p className="text-sm text-portal-muted">{empty}</p> : null) : <ul className="grid gap-3 min-[900px]:grid-cols-2">{children}</ul>}
    </section>
  );
}

function SubGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h3 className="text-base font-semibold text-portal-ink">{title}</h3>
      <ul className="grid gap-3 min-[900px]:grid-cols-2">{children}</ul>
    </section>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "min-h-11 shrink-0 rounded-full border border-portal-primary bg-portal-primary px-4 text-sm font-medium text-portal-primary-foreground"
          : "min-h-11 shrink-0 rounded-full border border-portal-border bg-card px-4 text-sm text-portal-ink hover:border-portal-primary"
      }
    >
      {children}
    </button>
  );
}

function OppCard({
  item, kind, homeLine, today, minutes, onOpen,
}: { item: Item; kind: "open" | "done"; homeLine: string; today: string; minutes: number; onOpen: () => void }) {
  const group = portalGroupFor(item.cardCode);
  const answer = boardGroup(item) === "answer";
  const chip = answer ? answerChip(item, today) : null;
  return (
    <li className="flex gap-4 rounded-[14px] border border-portal-border bg-card p-3">
      <img src={item.cover} alt="" loading="lazy" width={128} height={96} className="h-24 w-32 shrink-0 rounded-[10px] object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {group ? (
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${PORTAL_GROUP_TONE[group]}`}>{portalGroupLabel(group)}</span>
          ) : null}
          {chip ? (
            <span
              className={
                chip.overdue
                  ? "numeric rounded-md bg-overdue-border px-2 py-0.5 text-[11px] font-semibold text-overdue-foreground"
                  : "numeric rounded-md bg-answer-chip px-2 py-0.5 text-[11px] font-semibold text-answer-chip-foreground"
              }
            >
              {chip.text}
            </span>
          ) : null}
          {homeLine ? <span className="text-xs text-portal-muted">{homeLine}</span> : null}
        </div>
        <p className="text-[15px] font-bold leading-snug text-portal-ink">{item.title}</p>
        {kind === "done" ? (
          <p className="numeric text-sm text-portal-muted">{completedLine(item.completedAt ?? null, minutes)}</p>
        ) : item.summary ? (
          <p className="line-clamp-1 text-sm text-portal-muted">{item.summary}</p>
        ) : null}
        <div className="mt-auto pt-1">
          <Button size="sm" variant="outline" className="min-h-11 border-portal-primary text-portal-primary hover:bg-portal-primary/10 hover:text-portal-primary" onClick={onOpen}>
            {kind === "done" ? "View or edit" : "Open"}
          </Button>
        </div>
      </div>
    </li>
  );
}


/** Opens the item's own panel: each source keeps its own record and actions. */
function ItemPanel({
  item, programId, homes, homeName, multi, readOnly, preview, reviews, live, templates, renderReview, onClose, onStart, starting, blockedReason, onLogHours, programLive, entries,
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
  programLive: boolean;
  entries: HourEntry[];
}) {
  const home = sourceLine({ ...item, from: "" }, homeName, multi);
  const outsideLines = useOutsideLines(programId, programLive);
  const outsideState = useOutsideLinesFailed(programId, programLive);
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
        {...(outsideState.failed ? { outsideFailed: outsideState } : {})}
        {...(onLogHours ? { onLogHours } : {})}
      />
    );
  }
  if (item.source === "plan" && item.status === "done") {
    const group = portalGroupFor(item.cardCode);
    const log = !blockedReason && !readOnly ? onLogHours : undefined;
    return (
      <CompletedCardPanel
        planCardId={item.id}
        programId={programId}
        propertyId={item.propertyIds[0] ?? null}
        title={item.title}
        home={home || (homes[0]?.name ?? "")}
        typeLabel={group ? portalGroupLabel(group) : null}
        cover={item.cover}
        completedAt={item.completedAt ?? null}
        outputFields={item.outputFields}
        reviewId={item.reviewId ?? null}
        entries={entries}
        readOnly={readOnly}
        onClose={onClose}
        onChangeHours={log ? () => { onClose(); log(item.title, item.propertyIds[0] ?? null); } : undefined}
      />
    );
  }
  if (item.source === "plan") return <PlanCardPanel item={item} programId={programId} programLive={programLive} home={home} readOnly={readOnly} onOpenChange={onOpenChange} footer={logFooter} />;
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
  item, programId, programLive, home, readOnly, onOpenChange, footer,
}: {
  item: Item;
  programId: string;
  programLive: boolean;
  home: string;
  readOnly: boolean;
  onOpenChange: (next: boolean) => void;
  footer: ReactNode;
}) {
  const q = useQuery({ queryKey: ["ao-owner-plan", programId, "portal"], queryFn: () => loadOwnerPortalPlan(programId), retry: false });
  const row = q.data?.available ? q.data.data.find((c) => c.plan_card_id === item.id) : undefined;
  const outsideLine = useOutsideLines(programId, programLive).get(`plan:${item.id}`) ?? null;
  const outsideState = useOutsideLinesFailed(programId, programLive);
  if (q.isError) {
    return (
      <OwnerSidePanel open onOpenChange={onOpenChange} cover={item.cover} status="Open" title={item.title} home={home} footer={null}>
        <LoadError what="This card" onRetry={() => void q.refetch()} />
      </OwnerSidePanel>
    );
  }
  if (!row) return null;
  const view = portalCardView(row);
  return (
    <OwnerSidePanel
      open
      onOpenChange={onOpenChange}
      cover={item.cover}
      status={item.allHomes ? "All your homes" : view.kind === "done" ? "Completed" : view.kind === "closed" ? "Closed" : !item.optional && row.deadline_at ? `Due ${shortDate(row.deadline_at)}` : "Open"}
      title={row.title}
      home={[home, "Your homeowner plan"].filter(Boolean).join(" · ")}
      sentAt={row.unlocked_at}
      answerBy={item.optional ? null : row.deadline_at ?? null}
      footer={footer}
    >
      {outsideState.failed && !outsideLine ? (
        <LoadError what="The instructions" onRetry={outsideState.retry} />
      ) : outsideLine || row.what_text ? <PanelSection label="What we're asking"><p className="whitespace-pre-wrap text-muted-foreground">{outsideLine ?? row.what_text}</p></PanelSection> : null}
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
      status="Open"
      title={template.title}
      home={home}
      footer={
        readOnly ? null : (
          <Button className="min-h-11" size="sm" disabled={starting} onClick={onStart}>
            {starting ? "Starting…" : "Start"}
          </Button>
        )
      }
    >
      {video ? <LibraryVideoPlayer libraryId={template.id} poster={imageFor(template.image_key)} label={video.label} /> : <LibraryVideoIndexError />}
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


/** The Done outside Resolve owner wording for this program (shared cache). */
export function useOutsideLines(programId: string, programLive: boolean): Map<string, string> {
  const q = useQuery({ queryKey: ["owner-outside-lines", programId, programLive], queryFn: () => loadOwnerOutsideLines(programId, programLive), retry: false, staleTime: 60_000 });
  return q.data ?? EMPTY_LINES;
}
const EMPTY_LINES = new Map<string, string>();
const NO_ENTRIES: HourEntry[] = [];

/** Whether the outside-Resolve instructions failed to load, with a retry. Same read as useOutsideLines. */
export function useOutsideLinesFailed(programId: string, programLive: boolean): { failed: boolean; retry: () => void } {
  const q = useQuery({ queryKey: ["owner-outside-lines", programId, programLive], queryFn: () => loadOwnerOutsideLines(programId, programLive), retry: false, staleTime: 60_000 });
  return { failed: q.isError, retry: () => void q.refetch() };
}
