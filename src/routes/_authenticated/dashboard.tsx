import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingPage, PageHero, PriorityRail, SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { ActivityList, type ActivityEvent } from "@/components/ui/activity";
import heroImage from "@/assets/hero-arha-property.jpg";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { routineConfig, routineDueLabel, routineDueState } from "@/lib/routine-controls";
import { ticketNextAction } from "@/lib/ticket-next-action";
import { OPEN_STATUSES, priorityMeta, priorityTone, relativeTime, slaState } from "@/lib/tickets";
import { isMine } from "@/lib/matters";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { SupervisorAttentionBand } from "@/components/SupervisorAttentionBand";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — Resolve Operations" },
      {
        name: "description",
        content:
          "What needs you now, what you have started, what you are waiting on, and routine work due today.",
      },
      { property: "og:title", content: "Home — Resolve Operations" },
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

/** Human time: 4:00 PM, never 16:00. */
function clockTime(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Row = {
  id: string;
  ref: number | null;
  title: string;
  priority: string;
  status: string;
  acknowledged_at: string | null;
  action_started_at: string | null;
  next_review_at: string | null;
  response_due_at: string | null;
  action_due_at: string | null;
  waiting_on: string | null;
  waiting_reason: string | null;
  guest_in_residence: boolean | null;
  vendor_name: string | null;
  vendor_status: string | null;
  reported_at: string | null;
  current_action_owner: string | null;
  assigned_to: string | null;
  record_owner: string | null;
  accountable_owner: string | null;
  created_by: string | null;
  pending_handoff_to: string | null;
  properties: { name: string | null; nickname: string | null } | null;
};

function Dashboard() {
  const { demoMode } = useDemo();
  const role = useRole();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, properties(name, nickname)")
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .order("reported_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = data ?? [];
  const open = rows.filter((t) => OPEN_STATUSES.includes(t.status));
  const owned = role.userId ? open.filter((t) => isMine(t, role.userId)) : [];
  // While an admin is previewing another seat, their own assignments are not
  // that person's work. Rather than show an empty, misleading Home, show a
  // sample of the queue this seat works and say plainly that it is a sample.
  const sampleQueue = Boolean(role.previewRole) && owned.length === 0 && open.length > 0;
  const mine = sampleQueue ? open.slice(0, 20) : owned;

  const waiting = mine
    .filter((t) => t.status === "waiting")
    .sort((a, b) => (a.next_review_at ?? "").localeCompare(b.next_review_at ?? ""));

  const dueBack = (t: Row) => Boolean(t.next_review_at && new Date(t.next_review_at) <= new Date());

  // "Needs me now" is work that is actionable this minute: not started, past a
  // clock, or a Waiting item whose follow-up time has arrived.
  const needsMe = mine
    .filter(
      (t) =>
        (t.status !== "waiting" &&
          (!t.acknowledged_at || !t.action_started_at || slaState(t).breached)) ||
        (t.status === "waiting" && dueBack(t)),
    )
    .sort((a, b) => {
      const rank: Record<string, number> = { p1: 3, p2: 2, p3: 1 };
      return (
        (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0) ||
        (a.response_due_at ?? a.action_due_at ?? "").localeCompare(
          b.response_due_at ?? b.action_due_at ?? "",
        )
      );
    });

  const needsMeIds = new Set(needsMe.map((t) => t.id));
  const inProgress = mine.filter(
    (t) => !needsMeIds.has(t.id) && t.status !== "waiting" && t.action_started_at,
  );
  const unclaimed = open.filter((t) => !t.current_action_owner && !t.assigned_to);

  // Home is a workspace too: a ticket opened from here comes back to here.
  const { originSearch } = useWorkspaceOrigin(
    "Home",
    [...needsMe, ...inProgress, ...waiting].map((t) => ({
      id: t.id,
      label: t.title,
      sub: t.properties?.nickname ?? t.properties?.name ?? undefined,
    })),
  );

  // A person's own name, so Home greets them the way a colleague would.
  const { data: me } = useQuery({
    queryKey: ["my-name", role.userId],
    enabled: Boolean(role.userId),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", role.userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const firstName = (me?.full_name ?? "").trim().split(/\s+/)[0] ?? "";

  // Recent activity, derived from the same rows Home already loaded — no new
  // source of truth, just the last few things that visibly moved.
  const recent: (ActivityEvent & { at: string })[] = rows
    .map((t) => {
      const at = t.action_started_at ?? t.acknowledged_at ?? t.reported_at;
      const kind: ActivityEvent["kind"] =
        t.status === "waiting"
          ? "waiting"
          : t.status === "resolved" || t.status === "closed"
            ? "completed"
            : t.vendor_name
              ? "repair"
              : t.pending_handoff_to
                ? "handoff"
                : t.action_started_at
                  ? "handoff"
                  : "note";
      return {
        id: t.id,
        kind,
        when: relativeTime(at),
        at: at ?? "",
        label: (
          <>
            <span className="font-medium">{t.title}</span>
            <span className="text-muted-foreground">
              {" · "}
              {t.properties?.nickname ?? t.properties?.name ?? "No property"}
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

  if (isLoading || !data) return <LoadingPage tiles={0} />;


  return (
    <div className="space-y-8">
      <PageHero
        image={heroImage}
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}.`}
        description="Own the outcome. Protect the stay."
        actions={
          <>
            <Link
              to="/tickets"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <ClipboardList className="size-4" /> My work
            </Link>
            <Link
              to="/team-queue"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-base font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <Users className="size-4" /> Team queue
            </Link>
            {role.can("ticket_create") && (
              <Link
                to="/tickets/new"
                search={{ origin: originSearch.from }}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-base font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <Plus className="size-4" /> Report an issue
              </Link>
            )}
          </>
        }
      />

      {role.can("oversight") && <SupervisorAttentionBand />}

      {sampleQueue && (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          You are previewing the {role.previewRole?.replace(/_/g, " ")} view. Nothing is assigned to
          your own account here, so this is a sample of the work this seat handles — not one
          person&apos;s real queue.
        </p>
      )}

      {/* Compact, colourful, meaningful. Only what is worth acting on. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DecisionTile
          value={needsMe.length}
          label="Needs me now"
          tone="critical"
          to="/tickets"
        />
        <DecisionTile value={inProgress.length} label="In progress" tone="progress" to="/tickets" />
        <DecisionTile value={waiting.length} label="Waiting" tone="attention" to="/tickets" />
        <DecisionTile
          value={unclaimed.length}
          label="Unclaimed in team queue"
          tone="review"
          to="/team-queue"
        />
      </div>

      <SectionCard
        tone={needsMe.length > 0 ? "critical" : "default"}
        title="Needs me now"
        description="Actionable this minute — unacknowledged, not started, past a clock, or back from waiting."
        bodyClassName="space-y-1.5"
      >
        {needsMe.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing needs you right now — everything you own is moving or parked with a follow-up
            time.
          </p>
        ) : (
          needsMe.map((t) => <WorkRow key={t.id} t={t} emphasis origin={originSearch} />)
        )}
      </SectionCard>

      {inProgress.length > 0 && (
        <SectionCard
          title="In progress"
          description="Work you own and have already started."
          bodyClassName="space-y-1.5"
        >
          {inProgress.map((t) => (
            <WorkRow key={t.id} t={t} origin={originSearch} />
          ))}
        </SectionCard>
      )}

      {waiting.length > 0 && (
        <SectionCard
          title="Waiting"
          description="Parked on someone else, soonest follow-up first. The clock is paused, not finished."
          bodyClassName="space-y-1.5"
        >
          {waiting.map((t) => (
            <WorkRow key={t.id} t={t} origin={originSearch} />
          ))}
        </SectionCard>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard title="Recent activity" description="The last few things that moved.">
          <ActivityList events={recent} emptyLabel="Nothing has moved in your work yet today." />
        </SectionCard>
        <div className="warm-surface flex flex-col justify-center p-6">
          <p className="eyebrow">The ARHA way</p>
          <p className="mt-2 font-display text-2xl leading-snug">
            “Own the outcome. Protect the stay.”
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            A handoff is not complete until someone accepts it.
          </p>
        </div>
      </div>

      <RoutineWorkDue />
    </div>
  );
}

/** One compact, colourful figure that leads somewhere useful. */
function DecisionTile({
  value,
  label,
  tone,
  to,
}: {
  value: number;
  label: string;
  tone: "critical" | "progress" | "attention" | "review";
  to: string;
}) {
  const plate = {
    critical: "border-coral/25 bg-coral/8 text-coral",
    progress: "border-sky/25 bg-sky/8 text-sky",
    attention: "border-amber/30 bg-amber/10 text-amber",
    review: "border-lavender/25 bg-lavender/8 text-lavender",
  }[tone];
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      className={`rounded-xl border px-4 py-3.5 transition-colors hover:brightness-[0.98] ${plate} ${
        value === 0 ? "opacity-60" : ""
      }`}
    >
      <p className="numeric text-3xl font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-sm font-medium text-foreground">{label}</p>
    </Link>
  );
}


/** One compact line of work: what it is, where, what to do next, and by when. */
function WorkRow({
  t,
  emphasis = false,
  origin,
}: {
  t: Row;
  emphasis?: boolean;
  origin: { from: string };
}) {
  const sla = slaState(t);
  const overdue = Boolean(sla.breached);
  const next = ticketNextAction({
    status: t.status,
    acknowledged_at: t.acknowledged_at,
    action_started_at: t.action_started_at,
    waiting_on: t.waiting_on,
    guest_in_residence: t.guest_in_residence,
    vendor_name: t.vendor_name,
    vendor_status: t.vendor_status,
  });
  const followUp = t.status === "waiting" ? clockTime(t.next_review_at) : null;
  const waitingLate =
    t.status === "waiting" && t.next_review_at && new Date(t.next_review_at) <= new Date();

  return (
    <Link
      to="/tickets/$ticketId"
      params={{ ticketId: t.id }}
      search={origin}
      className={`surface-row relative flex flex-wrap items-center gap-x-3 gap-y-1 py-3 pl-5 pr-3 ${
        overdue ? "border-danger/30" : ""
      }`}
    >
      <PriorityRail priority={t.priority} />
      <Badge variant="outline" className={priorityTone(t.priority)}>
        {priorityMeta(t.priority).short}
      </Badge>

      <span className="min-w-0 flex-1 basis-full sm:basis-auto">
        <span
          className={`block truncate ${emphasis ? "text-base font-semibold" : "text-base font-medium"}`}
        >
          {t.title}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {t.properties?.nickname ?? t.properties?.name ?? "No property"}
          {next ? ` · ${next.label}` : ""}
        </span>
      </span>

      {t.status === "waiting" ? (
        <StatusBadge
          tone={waitingLate ? "escalated" : "waiting"}
          icon={<PauseCircle />}
        >
          {waitingLate ? "Follow up now" : `Follow up ${followUp ?? "—"}`}
        </StatusBadge>
      ) : overdue ? (
        <StatusBadge tone="escalated" icon={<AlertTriangle />}>
          Overdue
        </StatusBadge>
      ) : t.action_started_at ? (
        <StatusBadge tone="progress" icon={<PlayCircle />}>
          In progress
        </StatusBadge>
      ) : (
        <span className="numeric text-sm text-muted-foreground">{relativeTime(t.reported_at)}</span>
      )}

      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/**
 * Routine work due — the recurring controls, kept visually separate from
 * tickets so nobody confuses scheduled quality work with a reported problem.
 */
function RoutineWorkDue() {
  const { can } = useRole();
  const { demoMode } = useDemo();
  const { data } = useQuery({
    queryKey: ["routine-due", demoMode],
    enabled: can("routines"),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_controls")
        .select("id, kind, title, status, due_at, properties(name, nickname)")
        .eq("is_demo", demoMode)
        .in("status", ["due", "in_progress"])
        .order("due_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!can("routines")) return null;

  const rows = (data ?? []).filter((r) => routineDueState(r) !== "upcoming").slice(0, 6);
  const late = rows.filter((r) => routineDueState(r) === "overdue").length;

  return (
    <SectionCard
      title="Routine work due"
      description="Cleaning Reviews, Guest Reviews, Checkouts and Guest Touch Bases. Scheduled work, not reported problems."
      tone={late > 0 ? "attention" : "default"}
      bodyClassName="space-y-1.5"
      actions={
        <Link
          to="/routines"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ClipboardCheck className="size-4" /> Run a routine control
        </Link>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No routine checks due right now."
          hint="Cleaning Reviews appear here on their own once a departure clean is finished."
        />
      ) : (
        rows.map((r) => {
          const overdue = routineDueState(r) === "overdue";
          return (
            <Link
              key={r.id}
              to="/routines"
              className="surface-row flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{r.title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {routineConfig(r.kind).label}
                  {r.properties?.nickname || r.properties?.name
                    ? ` \u00b7 ${r.properties?.nickname ?? r.properties?.name}`
                    : ""}
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
