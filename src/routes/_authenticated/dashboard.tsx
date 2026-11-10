import { formatPropertyLabel } from "@/lib/property-label";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { myDirectBookings } from "@/lib/direct-bookings.functions";
import { homeBookingLine, overnightUnclaimedCount } from "@/lib/direct-bookings";
import { loadOvernightDirectBookings, overnightQueueKey } from "@/components/operations/OvernightDirectBookings";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { useHomeTeams } from "@/hooks/useHomeTeam";
import { useStaffDirectory, displayName } from "@/hooks/useTeam";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status";
import { isRecentOpenImport } from "@/lib/notion-ticket-display";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingPage, PageHero, PriorityRail, SectionCard, SegmentedControl } from "@/components/ui/page";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { ActivityList, type ActivityEvent } from "@/components/ui/activity";
import heroImage from "@/assets/hero-arha-property.jpg";
import { homePhotoUrl } from "@/components/property/HomePhoto";
import { applyTestDataFilter } from "@/lib/test-data";
import { bannerCaption, dailyHomePhoto } from "@/lib/daily-home-photo";
import { AlertTriangle, ArrowRight, ClipboardCheck, Handshake, Inbox, Users } from "lucide-react";
import {
  RETIRED_ROUTINE_KINDS,
  kindsForTeam,
  routineConfig,
  routineDueLabel,
  routineDueState,
} from "@/lib/routine-controls";
import { ticketNextAction } from "@/lib/ticket-next-action";
import { OPEN_STATUSES, relativeTime } from "@/lib/tickets";
import { currentOwnerId } from "@/lib/matters";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { SupervisorAttentionBand } from "@/components/SupervisorAttentionBand";
import { SupervisorRecords } from "@/components/scorecard/SupervisorRecords";
import { HandoffsWaiting } from "@/components/operations/HandoffsWaiting";
import { OwnerFollowUps } from "@/components/OwnerFollowUps";
import { LunchPrompt, MyShiftCard, TimeOffRequestsWaiting, useTimeOffWaiting } from "@/components/home/MyShift";
import { openRecordRoutine } from "@/components/routines/RecordRoutinePanel";
import { useFeatureFlags } from "@/lib/feature-flags";
import { SURVEY_CHECK_FLAG } from "@/lib/record-routine";
import {
  HOME_COPY,
  HOME_TABS,
  boardColumnOf,
  boardColumns,
  homeSearchMatch,
  inHomeTab,
  isMyRecentImport,
  isResolveWork,
  needsYouNow,
  unclaimedCount,
  urgencyLabel,
  type HomeTab,
  type HomeTicket,
} from "@/lib/home-work";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home | Resolve Operations" },
      {
        name: "description",
        content: "What needs you now, your work, routine work due today and recent activity, in one place.",
      },
      { property: "og:title", content: "Home | Resolve Operations" },
      { property: "og:description", content: "Your working day in Resolve, in one screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type Row = HomeTicket & {
  ref: number | null;
  title: string;
  reported_at: string | null;
  next_review_at: string | null;
  waiting_on: string | null;
  waiting_reason: string | null;
  guest_in_residence: boolean | null;
  vendor_name: string | null;
  vendor_status: string | null;
  properties: (HomeTicket["properties"] & { primary_photo_url?: string | null }) | null;
};

const PROPERTY_FIELDS = "name, nickname, primary_photo_url, address_line1, unit, city, state, postal_code, ownerrez_property_id";

function Dashboard() {
  const { demoMode } = useDemo();
  const role = useRole();
  const userId = role.userId ?? null;
  const { homeTeamOf } = useHomeTeams();
  const myTeam = homeTeamOf(userId);

  // Work this person owns or has been handed, open and recently finished.
  const mine = useQuery({
    queryKey: ["home-my-work", demoMode, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const id = userId!;
      const { data, error } = await supabase
        .from("tickets")
        .select(`*, properties(${PROPERTY_FIELDS}), work_types(name)`)
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .or(
          `assigned_to.eq.${id},current_action_owner.eq.${id},record_owner.eq.${id},accountable_owner.eq.${id},pending_handoff_to.eq.${id}`,
        )
        .order("reported_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  // Unowned open work, only to count it for the Team Queue link.
  const unowned = useQuery({
    queryKey: ["home-unowned", demoMode],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id, status, priority, functional_role_code, import_hold, external_source, external_status, reported_at, assigned_to, current_action_owner, record_owner, accountable_owner",
        )
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .in("status", OPEN_STATUSES)
        .is("assigned_to", null)
        .is("current_action_owner", null)
        .is("record_owner", null)
        .is("accountable_owner", null)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as HomeTicket[];
    },
  });

  const { data: me } = useQuery({
    queryKey: ["my-name", userId],
    enabled: Boolean(userId),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name").eq("id", userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const firstName = (me?.full_name ?? "").trim().split(/\s+/)[0] ?? "";

  // Register T1: a real home's photo that changes daily, the same for everyone.
  const bannerHomes = useQuery({
    queryKey: ["home-banner-photos"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, is_demo, address_line1, unit, city, state, postal_code, primary_photo_medium_url, primary_photo_url")
        .not("primary_photo_url", "is", null);
      if (error) throw error;
      return applyTestDataFilter(data ?? [], false, (p) => p).map((p) => ({
        id: p.id,
        photo: homePhotoUrl(p) ?? "",
        name: formatPropertyLabel(p).primary,
        city: p.city,
      }));
    },
  });
  const [bannerFailed, setBannerFailed] = useState(false);
  const bannerHome = bannerFailed ? null : dailyHomePhoto(bannerHomes.data ?? [], new Date());

  const rows = mine.data ?? [];
  // The same rows, with the home label, for End my shift and the lunch handoff.
  const walkRows = useMemo(
    () => rows.map((t) => ({ ...t, homeLabel: formatPropertyLabel(t.properties).full })),
    [rows],
  );
  // Overnight Direct Bookings wait in the Team Queue for Team A and count here too (register D2).
  const overnight = useQuery({
    queryKey: overnightQueueKey(demoMode),
    enabled: role.can("direct_bookings_work"),
    staleTime: 30_000,
    queryFn: () => loadOvernightDirectBookings(demoMode),
  });
  const unclaimed =
    unclaimedCount(unowned.data ?? [], myTeam) +
    (role.can("direct_bookings_work") ? overnightUnclaimedCount(overnight.data ?? [], myTeam) : 0);
  const openForOrigin = rows.filter(
    (t) => (isResolveWork(t) && OPEN_STATUSES.includes(t.status)) || isMyRecentImport(t, userId),
  );
  const { originSearch } = useWorkspaceOrigin(
    "Home",
    openForOrigin.map((t) => ({ id: t.id, label: t.title, sub: formatPropertyLabel(t.properties).primary })),
  );

  if (!userId || mine.isLoading) return <LoadingPage tiles={0} />;

  return (
    <div className="space-y-8">
      <PageHero
        image={bannerHome?.photo ?? (bannerHomes.isLoading ? undefined : heroImage)}
        imageCaption={bannerHome ? bannerCaption(bannerHome) : undefined}
        onImageError={bannerHome ? () => setBannerFailed(true) : undefined}
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}.`}
        description={HOME_COPY.heroLine}
      />

      {/* Leaders see escalations, approval requests and unassigned work first. */}
      {role.can("oversight") && <SupervisorAttentionBand />}

      {role.isStaff && <SupervisorRecords />}

      {role.previewRole && rows.length === 0 && (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          You are previewing the {role.identityLabel} view. Nothing is assigned to your own account, so these
          sections are empty.
        </p>
      )}

      {/* Register S1: before lunch, ask about Right now and time sensitive work. */}
      <LunchPrompt userId={userId} isCoordinator={role.roles.includes("tech")} rows={walkRows} demoMode={demoMode} />

      <NeedsYouNow rows={rows} userId={userId} originSearch={originSearch} />

      {mine.isError ? (
        <EmptyState
          title="Your work could not be loaded."
          hint="Try again before relying on this list."
        />
      ) : (
        <MyWork rows={rows} userId={userId} unclaimed={unclaimed} originSearch={originSearch} />
      )}

      <RoutineWorkDue team={myTeam} />

      {/* Register T1, T4: My shift sits after Routine work due today. */}
      <MyShiftCard userId={userId} isCoordinator={role.roles.includes("tech")} rows={walkRows} demoMode={demoMode} />

      <RecentActivity rows={rows} originSearch={originSearch} />
    </div>
  );
}

/** Decisions and items addressed to this person. Never Team Queue items. */
function NeedsYouNow({ rows, userId, originSearch }: { rows: Row[]; userId: string; originSearch: { from: string } }) {
  const { demoMode } = useDemo();
  const { can } = useRole();
  const fetchBookings = useServerFn(myDirectBookings);
  const bookings = useQuery({
    queryKey: ["my-direct-bookings", demoMode],
    enabled: can("direct_bookings_work"),
    queryFn: () => fetchBookings({ data: { demo: demoMode } }),
    refetchInterval: 15_000,
  });
  const approvals = useQuery({
    queryKey: ["home-my-approvals", demoMode, userId],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select("id, title, entity_type, entity_id, created_at")
        .eq("status", "pending")
        .eq("approver_id", userId)
        .eq("is_demo", demoMode)
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = useMemo(() => needsYouNow(rows, userId), [rows, userId]);
  const bookingRows = bookings.data ?? [];
  const approvalRows = approvals.data ?? [];
  const timeOff = useTimeOffWaiting(userId, demoMode);
  const nothing = items.length === 0 && bookingRows.length === 0 && approvalRows.length === 0 && timeOff.rows.length === 0;

  return (
    <SectionCard
      title={HOME_COPY.needsYouTitle}
      description={HOME_COPY.needsYouHint}
      tone={nothing ? "default" : "attention"}
      bodyClassName="space-y-1.5"
    >
      <HandoffsWaiting />
      <OwnerFollowUps />
      <TimeOffRequestsWaiting userId={userId} demoMode={demoMode} />
      {bookingRows.map((r) => (
        <Link
          key={r.id}
          to="/direct-bookings/$requestId"
          params={{ requestId: r.id }}
          className="surface-row flex items-center gap-3 px-4 py-3"
        >
          <Inbox className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {r.partner_name || r.company || r.subject || "Direct booking request"}
            </span>
            <span className="block text-sm text-muted-foreground">
              {homeBookingLine(r)}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
      {approvalRows.map((a) => {
        const inner = (
          <>
            <ClipboardCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{a.title}</span>
              <span className="block text-sm text-muted-foreground">Waiting for your approval</span>
            </span>
          </>
        );
        return a.entity_type === "ticket" && a.entity_id ? (
          <Link
            key={a.id}
            to="/tickets/$ticketId"
            params={{ ticketId: a.entity_id }}
            search={originSearch}
            className="surface-row flex items-center gap-3 px-4 py-3"
          >
            {inner}
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ) : (
          <div key={a.id} className="surface-row flex items-center gap-3 px-4 py-3">
            {inner}
          </div>
        );
      })}
      {items.map((i) => (
        <Link
          key={i.id}
          to="/tickets/$ticketId"
          params={{ ticketId: i.ticketId! }}
          search={originSearch}
          className="surface-row flex items-center gap-3 px-4 py-3"
        >
          {i.kind === "handoff" ? (
            <Handshake className="size-4 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{i.title}</span>
            <span className="block truncate text-sm text-muted-foreground">{i.detail}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
      {nothing && <p className="text-sm text-muted-foreground">{HOME_COPY.needsYouEmpty}</p>}
    </SectionCard>
  );
}

const PRIORITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "p1", label: "P1" },
  { value: "p2", label: "P2" },
  { value: "p3", label: "P3" },
];

/** My work: Active, Waiting and Done recently, with search, priority and List or Board. */
function MyWork({
  rows,
  userId,
  unclaimed,
  originSearch,
}: {
  rows: Row[];
  userId: string;
  unclaimed: number;
  originSearch: { from: string };
}) {
  const [tab, setTab] = useState<HomeTab>("active");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [layout, setLayout] = useState<"list" | "board">("list");
  const { data: staff } = useStaffDirectory();
  const people = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s])), [staff]);

  const counts = useMemo(() => {
    const c = {} as Record<HomeTab, number>;
    for (const t of HOME_TABS) c[t.value] = rows.filter((r) => inHomeTab(r, t.value, userId)).length;
    return c;
  }, [rows, userId]);

  const shown = rows
    .filter((t) => inHomeTab(t, tab, userId))
    .filter((t) => priority === "all" || t.priority === priority)
    .filter((t) => homeSearchMatch(t, query, displayName(people.get(currentOwnerId(t) ?? ""))))
    .sort((a, b) => {
      if (tab === "done") return (b.resolved_at ?? "").localeCompare(a.resolved_at ?? "");
      const rank: Record<string, number> = { p1: 0, p2: 1, p3: 2 };
      return (
        (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) ||
        (a.response_due_at ?? a.action_due_at ?? "9999").localeCompare(b.response_due_at ?? b.action_due_at ?? "9999")
      );
    });
  const emptyText = HOME_TABS.find((t) => t.value === tab)?.empty ?? "";

  return (
    <SectionCard
      title={HOME_COPY.myWorkTitle}
      description={HOME_COPY.myWorkHint}
      bodyClassName="space-y-3"
      actions={
        <Link
          to="/team-queue"
          search={{ flags: "unassigned" } as never}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Users className="size-4" aria-hidden="true" /> {HOME_COPY.teamQueueLink(unclaimed)}
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          ariaLabel="My work"
          value={tab}
          onChange={(v) => setTab(v as HomeTab)}
          options={HOME_TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] }))}
        />
        <SegmentedControl ariaLabel="Priority" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
        <SegmentedControl
          ariaLabel="Layout"
          value={layout}
          onChange={(v) => setLayout(v === "board" ? "board" : "list")}
          options={[
            { value: "list", label: "List" },
            { value: "board", label: "Board" },
          ]}
        />
        <Input
          className="sm:ml-auto sm:w-80"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={HOME_COPY.searchPlaceholder}
          aria-label="Search my work"
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query.trim() || priority !== "all" ? "Nothing matches. Try another word or priority." : emptyText}
        </p>
      ) : layout === "board" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {boardColumns(tab).map((col) => {
            const colRows = shown.filter((t) => boardColumnOf(t, tab) === col.value);
            return (
              <section key={col.value} aria-label={col.label} className="rounded-xl border bg-muted/20 p-3">
                <h3 className="mb-2 text-sm font-semibold">
                  {col.label} · {colRows.length}
                </h3>
                <div className="space-y-2">
                  {colRows.map((t) => (
                    <WorkRow key={t.id} t={t} origin={originSearch} compact />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {shown.map((t) => (
            <WorkRow key={t.id} t={t} origin={originSearch} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/** One line of work: the home by full address, the problem, how urgent and the next step. */
function WorkRow({ t, origin, compact = false }: { t: Row; origin: { from: string }; compact?: boolean }) {
  // A recent Notion import stays quiet until someone takes it: badge, no clock.
  const imported = isRecentOpenImport(t);
  const next = imported
    ? { label: HOME_COPY.importNext }
    : OPEN_STATUSES.includes(t.status)
    ? ticketNextAction({
        status: t.status,
        acknowledged_at: t.acknowledged_at ?? null,
        action_started_at: t.action_started_at ?? null,
        waiting_on: t.waiting_on,
        waiting_reason: t.waiting_reason,
        next_review_at: t.next_review_at,
        guest_in_residence: t.guest_in_residence,
        vendor_name: t.vendor_name,
        vendor_status: t.vendor_status,
      })
    : null;
  const urgent = urgencyLabel(t);
  const home = formatPropertyLabel(t.properties).full;
  return (
    <Link
      to="/tickets/$ticketId"
      params={{ ticketId: t.id }}
      search={origin}
      className="surface-row relative flex flex-wrap items-center gap-x-3 gap-y-1 py-3 pl-5 pr-3"
    >
      <PriorityRail priority={t.priority} />
      {!compact && (
        <PropertyPhoto url={t.properties?.primary_photo_url ?? null} name={home} className="size-11" />
      )}
      <span className="min-w-0 flex-1 basis-full sm:basis-auto">
        <span className="block truncate text-sm text-muted-foreground">{home}</span>
        <span className="block truncate text-base font-medium">{t.title}</span>
        <span className="block truncate text-sm">
          <span className="font-medium text-primary">{next ? next.label : "Done"}</span>
        </span>
      </span>
      {imported && <StatusBadge tone="context">{HOME_COPY.importBadge}</StatusBadge>}
      <Badge variant="outline" className={/Overdue|Escalated/.test(urgent) ? "border-danger/40 text-danger" : ""}>
        {urgent}
      </Badge>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/** Routine checks due today for this person's team. */
function RoutineWorkDue({ team }: { team: string | null }) {
  const { can } = useRole();
  const { demoMode } = useDemo();
  const flags = useFeatureFlags();
  const kinds = kindsForTeam(team).filter(
    (k) => !RETIRED_ROUTINE_KINDS.has(k) && (k !== "survey_review" || flags.enabled(SURVEY_CHECK_FLAG)),
  );
  const { data } = useQuery({
    queryKey: ["routine-due", demoMode, kinds.join(",")],
    enabled: can("routines"),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_controls")
        .select(
          "id, kind, title, status, due_at, properties(name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id)",
        )
        .eq("is_demo", demoMode)
        .in("status", ["due", "in_progress"])
        .in("kind", kinds)
        .order("due_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!can("routines")) return null;
  const rows = (data ?? []).filter((r) => routineDueState(r) !== "upcoming").slice(0, 8);
  const late = rows.filter((r) => routineDueState(r) === "overdue").length;

  return (
    <SectionCard
      title={HOME_COPY.routineTitle}
      description={HOME_COPY.routineHint}
      tone={late > 0 ? "attention" : "default"}
      bodyClassName="space-y-1.5"
      actions={
        <button
          type="button"
          onClick={() => openRecordRoutine()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ClipboardCheck className="size-4" aria-hidden="true" /> {HOME_COPY.routineButton}
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{HOME_COPY.routineEmpty}</p>
      ) : (
        rows.map((r) => {
          const overdue = routineDueState(r) === "overdue";
          return (
            <Link key={r.id} to="/routines" className="surface-row flex flex-wrap items-center gap-3 px-4 py-3">
              <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{r.title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {routineConfig(r.kind).label}
                  {r.properties ? ` \u00b7 ${formatPropertyLabel(r.properties).full}` : ""}
                </span>
              </span>
              <span
                className={`rounded-md px-2 py-1 text-sm font-medium ${
                  overdue ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground"
                }`}
              >
                {routineDueLabel(r)}
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })
      )}
    </SectionCard>
  );
}

/** The last few things that moved in this person's work. */
function RecentActivity({ rows, originSearch }: { rows: Row[]; originSearch: { from: string } }) {
  const recent: (ActivityEvent & { at: string })[] = rows
    .filter((t) => isResolveWork(t))
    .map((t) => {
      const at = t.resolved_at ?? t.action_started_at ?? t.acknowledged_at ?? t.reported_at ?? "";
      const kind: ActivityEvent["kind"] =
        t.status === "waiting"
          ? "waiting"
          : t.status === "resolved" || t.status === "closed"
            ? "completed"
            : t.vendor_name
              ? "repair"
              : t.pending_handoff_to
                ? "handoff"
                : "note";
      return {
        id: t.id,
        kind,
        when: relativeTime(at),
        at,
        label: (
          <>
            <span className="font-medium">{t.title}</span>
            <span className="text-muted-foreground">
              {" \u00b7 "}
              {formatPropertyLabel(t.properties).full}
            </span>
          </>
        ),
        to: "/tickets/$ticketId",
        params: { ticketId: t.id },
        search: originSearch,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  return (
    <SectionCard title={HOME_COPY.activityTitle}>
      <ActivityList events={recent} emptyLabel={HOME_COPY.activityEmpty} />
    </SectionCard>
  );
}
