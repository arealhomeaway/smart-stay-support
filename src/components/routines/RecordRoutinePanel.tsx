/**
 * Record routine work: one panel for the daily checks, opened from the top
 * bar on Home, from Home's routine section and from the Routine Work page.
 * Rules and words live in src/lib/record-routine.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TaskWorkspace } from "@/components/ui/workspace";
import { RoutineSourceDetails } from "@/components/routines/RoutineSourceDetails";
import { useTicketDrawer } from "@/components/nav/TicketDrawer";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { useHomeTeams } from "@/hooks/useHomeTeam";
import { useFeatureFlags } from "@/lib/feature-flags";
import { formatPropertyLabel, matchesPropertySearch } from "@/lib/property-label";
import { ownerRezBookingUrl } from "@/lib/ownerrez-links";
import { usDate } from "@/lib/dates";
import { routineDueLabel, type RoutineOutcome } from "@/lib/routine-controls";
import { recordRoutineCheck } from "@/lib/record-routine.functions";
import {
  CHECKS,
  PANEL_COPY,
  PANEL_OUTCOME_LABELS,
  POST_PLACES,
  REPEAT_OPTIONS,
  REVIEW_LOOKBACK_DAYS,
  SURVEY_CHECK_FLAG,
  TEAM_NAMES,
  WORK_ORDER_LOOKBACK_DAYS,
  byHandChecks,
  byHandKey,
  checkAnswersProblem,
  checkBadge,
  defaultFixTeam,
  maintenanceReviewKey,
  panelChecks,
  reviewCheckKey,
  reviewNeedsCheck,
  reviewTracker,
  sortReviews,
  teamAllDone,
  workOrderDueBy,
  workOrderNeedsCheck,
  type CheckAnswers,
  type LiveCheck,
  type PostPlace,
  type RepeatAnswer,
  type TeamCode,
} from "@/lib/record-routine";

export const RECORD_ROUTINE_EVENT = "resolve:record-routine";

/** Opens the panel from anywhere inside the app frame. */
export function openRecordRoutine() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(RECORD_ROUTINE_EVENT));
}

/** Mounted once by the app frame. */
export function RecordRoutineHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(RECORD_ROUTINE_EVENT, on);
    return () => window.removeEventListener(RECORD_ROUTINE_EVENT, on);
  }, []);
  return <RecordRoutinePanel open={open} onOpenChange={setOpen} />;
}

const PROP_FIELDS = "name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id";

type Item = {
  kind: LiveCheck;
  key: string;
  propertyId: string | null;
  homeLabel: string | null;
  title: string;
  guestName: string | null;
  sub: string | null;
  due: string | null;
  tracker: string | null;
  routineId?: string;
  review?: {
    id: string;
    rating: number | null;
    text: string | null;
    reply: string | null;
    reviewer: string | null;
    stay: string | null;
    platform: string | null;
    link: string | null;
  };
};

type View =
  | { name: "list" }
  | { name: "check"; kind: LiveCheck }
  | { name: "item"; item: Item; from: LiveCheck | "byhand" }
  | { name: "byhand" }
  | { name: "saved"; ticketId: string | null; kind: LiveCheck };

export function RecordRoutinePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [view, setView] = useState<View>({ name: "list" });
  useEffect(() => {
    if (open) setView({ name: "list" });
  }, [open]);
  const data = usePanelData(open);
  const role = useRole();
  const { homeTeamOf } = useHomeTeams();
  const team = homeTeamOf(role.userId ?? null);
  const checks = panelChecks(team, data.surveyOn);

  return (
    <TaskWorkspace
      open={open}
      onOpenChange={onOpenChange}
      title={PANEL_COPY.title}
      subtitle={PANEL_COPY.intro}
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {PANEL_COPY.close}
        </Button>
      }
    >
      {view.name === "list" && (
        <CheckList
          checks={checks}
          counts={data.counts}
          loading={data.loading}
          onPick={(kind) => setView({ name: "check", kind })}
          onByHand={() => setView({ name: "byhand" })}
        />
      )}
      {view.name === "check" && (
        <ItemList
          kind={view.kind}
          items={data.items[view.kind] ?? []}
          onBack={() => setView({ name: "list" })}
          onPick={(item) => setView({ name: "item", item, from: view.kind })}
          onByHand={() => setView({ name: "byhand" })}
        />
      )}
      {view.name === "byhand" && (
        <ByHand
          surveyOn={data.surveyOn}
          onBack={() => setView({ name: "list" })}
          onStart={(item) => setView({ name: "item", item, from: "byhand" })}
        />
      )}
      {view.name === "item" && (
        <CheckForm
          item={view.item}
          onBack={() => setView(view.from === "byhand" ? { name: "byhand" } : { name: "check", kind: view.from })}
          onSaved={(ticketId) => setView({ name: "saved", ticketId, kind: view.item.kind })}
          onClosePanel={() => onOpenChange(false)}
        />
      )}
      {view.name === "saved" && (
        <div className="space-y-4 rounded-xl border border-success/30 bg-success/5 p-5">
          <p className="flex items-center gap-2 text-base font-semibold text-success">
            <CheckCircle2 className="size-5" aria-hidden="true" /> {PANEL_COPY.saved}
          </p>
          {view.ticketId && (
            <Link
              to="/tickets/$ticketId"
              params={{ ticketId: view.ticketId }}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {PANEL_COPY.openTicket} <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          )}
          <div>
            <Button onClick={() => setView({ name: "check", kind: view.kind })}>{PANEL_COPY.backToList}</Button>
          </div>
        </div>
      )}
    </TaskWorkspace>
  );
}

/** Everything waiting, per check. Loaded only while the panel is open. */
function usePanelData(open: boolean) {
  const { demoMode } = useDemo();
  const flags = useFeatureFlags();
  const surveyOn = flags.enabled(SURVEY_CHECK_FLAG);

  const q = useQuery({
    queryKey: ["record-routine", demoMode],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const reviewSince = new Date(Date.now() - REVIEW_LOOKBACK_DAYS * 86_400_000).toISOString();
      const woSince = new Date(Date.now() - (WORK_ORDER_LOOKBACK_DAYS + 7) * 86_400_000).toISOString().slice(0, 10);
      const [routines, reviews, reviewDone, wos, woDone] = await Promise.all([
        supabase
          .from("routine_controls")
          .select(`id, kind, event_key, status, title, due_at, property_id, guest_name, reservation_confirmation, stay_arrival, stay_departure, properties(${PROP_FIELDS})`)
          .eq("is_demo", demoMode)
          .in("kind", ["guest_touch_base", "survey_review"])
          .in("status", ["due", "in_progress"])
          .order("due_at", { ascending: true })
          .limit(200),
        supabase
          .from("guest_feedback")
          .select(`id, feedback_type, property_id, rating, summary, response_text, source_url, submitted_at, stay_start, stay_end, booking_platform, ownerrez_booking_id, reviewer_display_name, guest_name, reservation_guest_name, properties(${PROP_FIELDS})`)
          .eq("is_demo", demoMode)
          .eq("feedback_type", "external_review")
          .gte("submitted_at", reviewSince)
          .order("submitted_at", { ascending: false })
          .limit(300),
        supabase
          .from("routine_controls")
          .select("event_key")
          .eq("kind", "guest_review")
          .in("status", ["completed", "cancelled"])
          .like("event_key", "review:%")
          .limit(2000),
        supabase
          .from("breezeway_work_orders")
          .select(`id, name, department, status, finished_at, breezeway_updated_at, scheduled_date, property_id, properties(is_demo, ${PROP_FIELDS})`)
          .eq("department", "maintenance")
          .eq("status", "Finished")
          .gte("scheduled_date", woSince)
          .limit(400),
        supabase
          .from("routine_controls")
          .select("event_key")
          .eq("kind", "maintenance_review")
          .eq("status", "completed")
          .limit(4000),
      ]);
      for (const r of [routines, reviews, reviewDone, wos, woDone]) if (r.error) throw r.error;

      const items: Record<LiveCheck, Item[]> = {
        guest_touch_base: [],
        survey_review: [],
        guest_review: [],
        maintenance_review: [],
      };
      for (const r of routines.data ?? []) {
        const home = formatPropertyLabel(r.properties).full || null;
        items[r.kind as "guest_touch_base" | "survey_review"].push({
          kind: r.kind as LiveCheck,
          key: r.event_key,
          routineId: r.id,
          propertyId: r.property_id,
          homeLabel: home,
          title: r.guest_name ? `${r.guest_name}${home ? ` at ${home}` : ""}` : (home ?? r.title),
          guestName: r.guest_name,
          sub:
            r.stay_arrival && r.stay_departure
              ? `Stay ${usDate(r.stay_arrival)} to ${usDate(r.stay_departure)}`
              : r.reservation_confirmation
                ? `Reservation ${r.reservation_confirmation}`
                : null,
          due: routineDueLabel(r),
          tracker: null,
        });
      }
      const checkedReviews = new Set((reviewDone.data ?? []).map((r) => r.event_key));
      for (const r of sortReviews((reviews.data ?? []).filter((x) => reviewNeedsCheck(x, checkedReviews)))) {
        const home = formatPropertyLabel(r.properties).full || null;
        const reviewer = r.reviewer_display_name ?? r.guest_name ?? null;
        items.guest_review.push({
          kind: "guest_review",
          key: reviewCheckKey(r.id),
          propertyId: r.property_id,
          homeLabel: home,
          title: `${reviewer ?? "Guest"}${home ? ` at ${home}` : ""}`,
          guestName: r.reservation_guest_name ?? reviewer,
          sub: r.submitted_at ? `Posted ${usDate(r.submitted_at)}` : null,
          due: r.rating != null ? `${r.rating} stars` : null,
          tracker: reviewTracker(r.rating),
          review: {
            id: r.id,
            rating: r.rating,
            text: r.summary,
            reply: r.response_text,
            reviewer,
            stay: r.stay_start && r.stay_end ? `${usDate(r.stay_start)} to ${usDate(r.stay_end)}` : null,
            platform: r.booking_platform,
            link: r.source_url ?? ownerRezBookingUrl(r.ownerrez_booking_id),
          },
        });
      }
      const approved = new Set((woDone.data ?? []).map((r) => (r.event_key ?? "").replace("bz_maint:", "")));
      for (const w of (wos.data ?? []).filter(
        (x) => Boolean(x.properties?.is_demo) === demoMode && workOrderNeedsCheck(x, approved),
      )) {
        const home = formatPropertyLabel(w.properties).full || null;
        const dueBy = workOrderDueBy(w);
        items.maintenance_review.push({
          kind: "maintenance_review",
          key: maintenanceReviewKey(w.id),
          propertyId: w.property_id,
          homeLabel: home,
          title: w.name ?? "Work order",
          guestName: null,
          sub: home,
          due: dueBy ? (Date.parse(dueBy) < Date.now() ? "Due now" : `Review by ${usDate(dueBy)}`) : null,
          tracker: null,
        });
      }
      items.maintenance_review.sort((a, b) => (a.due === "Due now" ? -1 : 0) - (b.due === "Due now" ? -1 : 0));
      return items;
    },
  });

  const items = q.data ?? { guest_touch_base: [], survey_review: [], guest_review: [], maintenance_review: [] };
  const counts = Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.length])) as Record<LiveCheck, number>;
  return { items, counts, surveyOn, loading: q.isLoading };
}

function CheckList({
  checks,
  counts,
  loading,
  onPick,
  onByHand,
}: {
  checks: ReturnType<typeof panelChecks>;
  counts: Partial<Record<LiveCheck, number>>;
  loading: boolean;
  onPick: (k: LiveCheck) => void;
  onByHand: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{PANEL_COPY.whichCheck}</h2>
      {!loading && teamAllDone(checks, counts) && (
        <p className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm font-medium text-success">
          {PANEL_COPY.allDone}
        </p>
      )}
      <div className="space-y-2">
        {checks.map((c) => {
          const def = CHECKS[c.kind];
          const n = counts[c.kind] ?? 0;
          return (
            <button
              key={c.kind}
              type="button"
              onClick={() => onPick(c.kind)}
              className="surface-row flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">{def.label}</span>
                <span className="block text-sm text-muted-foreground">{def.teamLine}</span>
              </span>
              {loading ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : (
                <Badge
                  variant="outline"
                  className={c.mine && n > 0 ? "border-primary/40 bg-primary/10 text-primary" : ""}
                >
                  {checkBadge(c.mine, n)}
                </Badge>
              )}
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onByHand} className="text-sm font-medium text-primary hover:underline">
        {PANEL_COPY.byHand}
      </button>
    </div>
  );
}

function ItemList({
  kind,
  items,
  onBack,
  onPick,
  onByHand,
}: {
  kind: LiveCheck;
  items: Item[];
  onBack: () => void;
  onPick: (i: Item) => void;
  onByHand: () => void;
}) {
  const def = CHECKS[kind];
  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <div>
        <h2 className="text-base font-semibold">{def.label}</h2>
        <p className="text-sm text-muted-foreground">{def.purpose}</p>
      </div>
      {def.notice && <Notice text={def.notice} />}
      {items.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">{PANEL_COPY.emptyCheck}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <button
              key={i.key}
              type="button"
              onClick={() => onPick(i)}
              className="surface-row flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{i.title}</span>
                {i.sub && <span className="block truncate text-sm text-muted-foreground">{i.sub}</span>}
              </span>
              {i.tracker && <Badge variant="outline" className="border-danger/40 text-danger">{i.tracker}</Badge>}
              {i.due && <Badge variant="outline">{i.due}</Badge>}
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onByHand} className="text-sm font-medium text-primary hover:underline">
        {PANEL_COPY.byHand}
      </button>
    </div>
  );
}

function ByHand({ surveyOn, onBack, onStart }: { surveyOn: boolean; onBack: () => void; onStart: (i: Item) => void }) {
  const { demoMode } = useDemo();
  const options = byHandChecks(surveyOn);
  const [kind, setKind] = useState<LiveCheck>(options[0]!);
  const [query, setQuery] = useState("");
  const [home, setHome] = useState<{ id: string; label: string } | null>(null);
  const [guest, setGuest] = useState("");
  const { data: homes } = useQuery({
    queryKey: ["routine-properties", demoMode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(`id, is_demo, listing_alias, ${PROP_FIELDS}`)
        .eq("active", true)
        .eq("is_demo", demoMode)
        .order("name")
        .limit(600);
      if (error) throw error;
      return data ?? [];
    },
  });
  const matches = (homes ?? []).filter((p) => matchesPropertySearch(p, query)).slice(0, 8);
  const def = CHECKS[kind];

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <h2 className="text-base font-semibold">{PANEL_COPY.byHandTitle}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
              kind === k ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
            }`}
          >
            <span className="block text-sm font-semibold">{CHECKS[k].label}</span>
            <span className="block text-xs text-muted-foreground">{CHECKS[k].teamLine}</span>
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{def.purpose}</p>
      <div className="space-y-1.5">
        <Label htmlFor="byhand-home">{PANEL_COPY.whichHome}</Label>
        <Input
          id="byhand-home"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHome(null);
          }}
          placeholder="Start typing an address or home name"
        />
        {query.trim() && !home && (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-1">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const label = formatPropertyLabel(p).full;
                  setHome({ id: p.id, label });
                  setQuery(label);
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                {formatPropertyLabel(p).full}
              </button>
            ))}
            {matches.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No home matches that.</p>}
          </div>
        )}
      </div>
      {def.team === "guest_experience" && (
        <div className="space-y-1.5">
          <Label htmlFor="byhand-guest">Guest name (optional)</Label>
          <Input id="byhand-guest" value={guest} onChange={(e) => setGuest(e.target.value)} />
        </div>
      )}
      <Button
        disabled={!home}
        onClick={() =>
          home &&
          onStart({
            kind,
            key: byHandKey(kind, home.id),
            propertyId: home.id,
            homeLabel: home.label,
            title: `${def.single} · ${home.label}`,
            guestName: guest.trim() || null,
            sub: null,
            due: null,
            tracker: null,
          })
        }
      >
        Start this check
      </Button>
    </div>
  );
}

function CheckForm({
  item,
  onBack,
  onSaved,
  onClosePanel,
}: {
  item: Item;
  onBack: () => void;
  onSaved: (ticketId: string | null) => void;
  onClosePanel: () => void;
}) {
  const def = CHECKS[item.kind];
  const qc = useQueryClient();
  const drawer = useTicketDrawer();
  const { demoMode } = useDemo();
  const save = useServerFn(recordRoutineCheck);
  const [steps, setSteps] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<RoutineOutcome | null>(null);
  const [issue, setIssue] = useState("");
  const [fixTeam, setFixTeam] = useState<TeamCode>(defaultFixTeam(item.kind));
  const [notes, setNotes] = useState("");
  const [replyText, setReplyText] = useState(item.review?.reply ?? "");
  const [postedOn, setPostedOn] = useState<PostPlace | null>(null);
  const [repeat, setRepeat] = useState<RepeatAnswer | null>(null);

  const answers: CheckAnswers = useMemo(
    () => ({
      steps,
      outcome,
      issue,
      fixTeam: outcome === "needs_follow_up" ? fixTeam : null,
      notes,
      ...(item.kind === "guest_review" ? { replyText, postedOn, repeatIssue: repeat } : {}),
      link: item.review?.link ?? null,
    }),
    [steps, outcome, issue, fixTeam, notes, replyText, postedOn, repeat, item],
  );
  const problem = checkAnswersProblem(item.kind, answers);

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          kind: item.kind,
          eventKey: item.key,
          propertyId: item.propertyId,
          homeLabel: item.homeLabel,
          title: item.title,
          guestName: item.guestName,
          feedbackId: item.review?.id ?? null,
          demo: demoMode,
          answers: {
            ...answers,
            fixTeam: answers.fixTeam ?? null,
            postedOn: answers.postedOn ?? null,
            repeatIssue: answers.repeatIssue ?? null,
          },
        },
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["record-routine"] });
      void qc.invalidateQueries({ queryKey: ["routine-controls"] });
      void qc.invalidateQueries({ queryKey: ["routine-due"] });
      if (r.openTicketForm && drawer) {
        toast.success(`${PANEL_COPY.saved} ${PANEL_COPY.ticketFormNext}`);
        onClosePanel();
        drawer.openNewTicket({
          ...(item.propertyId ? { property: item.propertyId } : {}),
          from: `routine:${r.routineId}`,
        });
        return;
      }
      onSaved(r.ticketId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} />
      <div>
        <h2 className="text-base font-semibold">{item.title}</h2>
        <p className="text-sm text-muted-foreground">{def.purpose}</p>
      </div>

      {item.kind === "guest_review" && item.review && <ReviewCard r={item.review} />}
      {(item.kind === "maintenance_review" || item.kind === "survey_review") && (
        <RoutineSourceDetails
          row={{ id: item.routineId ?? "new", kind: item.kind, status: "due", event_key: item.key, draft: true }}
        />
      )}
      {item.kind === "guest_touch_base" && (item.guestName || item.sub) && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          {item.guestName && <p>Guest: {item.guestName}</p>}
          {item.sub && <p className="text-muted-foreground">{item.sub}</p>}
        </div>
      )}
      {def.notice && <Notice text={def.notice} />}

      <div className="space-y-2">
        <p className="text-sm font-semibold">{def.stepsHeading}</p>
        {def.steps.map((s) => (
          <label
            key={s.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-secondary/60"
          >
            <Checkbox
              checked={Boolean(steps[s.id])}
              onCheckedChange={(v) => setSteps((c) => ({ ...c, [s.id]: Boolean(v) }))}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{s.prompt}</span>
              {s.hint && <span className="block text-xs text-muted-foreground">{s.hint}</span>}
            </span>
          </label>
        ))}
      </div>

      {item.kind === "guest_review" && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="rr-reply">{PANEL_COPY.replyLabel}</Label>
            <Textarea id="rr-reply" rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{PANEL_COPY.postedLabel}</p>
            <p className="text-xs text-muted-foreground">{PANEL_COPY.postedHelp}</p>
            <ChoiceRow options={POST_PLACES} value={postedOn} onChange={setPostedOn} label={PANEL_COPY.postedLabel} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{PANEL_COPY.repeatLabel}</p>
            <ChoiceRow options={REPEAT_OPTIONS} value={repeat} onChange={setRepeat} label={PANEL_COPY.repeatLabel} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold">{PANEL_COPY.howDidItGo}</p>
        <ChoiceRow
          options={def.outcomes.map((o) => ({ value: o, label: PANEL_OUTCOME_LABELS[o] }))}
          value={outcome}
          onChange={setOutcome}
          label={PANEL_COPY.howDidItGo}
        />
      </div>

      {outcome === "needs_follow_up" && (
        <div className="space-y-3 rounded-lg border border-attention/40 bg-attention/5 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="rr-issue">{PANEL_COPY.whatNeedsFixing}</Label>
            <Textarea
              id="rr-issue"
              rows={3}
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Say it the way you would to a teammate."
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{PANEL_COPY.whoFixes}</p>
            <ChoiceRow
              options={(["guest_experience", "property_operations"] as const).map((t) => ({
                value: t,
                label: `${TEAM_NAMES[t]}, ${t === "guest_experience" ? "guest experience" : "property operations"}`,
              }))}
              value={fixTeam}
              onChange={setFixTeam}
              label={PANEL_COPY.whoFixes}
            />
            <p className="text-xs text-muted-foreground">{PANEL_COPY.whoFixesHint}</p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="rr-notes">{PANEL_COPY.notesLabel}</Label>
        <Textarea id="rr-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button className="h-11" disabled={Boolean(problem) || m.isPending} onClick={() => m.mutate()}>
          {m.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {PANEL_COPY.save}
        </Button>
        {problem && outcome && <p className="text-sm text-muted-foreground">{problem}</p>}
      </div>
    </div>
  );
}

function ReviewCard({ r }: { r: NonNullable<Item["review"]> }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {r.rating != null && (
          <span className="inline-flex items-center gap-1 font-medium">
            <Star className="size-4 text-attention" aria-hidden="true" /> {r.rating} of 5
          </span>
        )}
        {reviewTracker(r.rating) && (
          <Badge variant="outline" className="border-danger/40 text-danger">
            {reviewTracker(r.rating)}
          </Badge>
        )}
        {r.platform && <span className="text-muted-foreground">{r.platform}</span>}
      </div>
      {r.reviewer && <p className="text-muted-foreground">From {r.reviewer}{r.stay ? `, stay ${r.stay}` : ""}</p>}
      <p className="whitespace-pre-line">{r.text || "No review text was copied from OwnerRez."}</p>
      {r.reply && (
        <p className="whitespace-pre-line text-muted-foreground">
          Reply already in OwnerRez: {r.reply}
        </p>
      )}
      {r.link && (
        <a
          href={r.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Open in OwnerRez <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-lg border px-4 text-sm font-medium transition-colors ${
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return <p className="rounded-lg border border-attention/40 bg-attention/5 px-4 py-3 text-sm font-medium">{text}</p>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> Back
    </button>
  );
}
