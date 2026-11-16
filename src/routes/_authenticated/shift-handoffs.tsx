/**
 * Oversight, Shift handoffs (Admin, Nov 16): the Operations Supervisor, the Director of
 * Operations and Admin see who was on shift, missed shift ends and every handoff. Read only.
 * Rules live in src/lib/shift-handoffs.ts; the data comes from src/hooks/useShiftHandoffs.ts.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, SELECT_CLASS } from "@/components/trackers/parts";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { useShiftHandoffs } from "@/hooks/useShiftHandoffs";
import { priorityMeta } from "@/lib/tickets";
import { centralToday } from "@/lib/team-schedule";
import {
  SH_COPY as C,
  SH_KIND_LABEL,
  SH_TEAMS,
  centralDayTime,
  centralTime,
  dateChoices,
  hoursLabel,
  shiftHandoffsView,
  type SHPersonDay,
  type SHRow,
  type SHTeam,
} from "@/lib/shift-handoffs";

export const Route = createFileRoute("/_authenticated/shift-handoffs")({
  head: () => ({
    meta: [
      { title: "Shift handoffs: Resolve" },
      { name: "description", content: "Who was on shift, missed shift ends and every handoff waiting to be accepted." },
      { property: "og:title", content: "Shift handoffs: Resolve" },
      { property: "og:description", content: "Who was on shift, missed shift ends and every handoff waiting to be accepted." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="shift_handoffs" title="Shift handoffs">
      <ShiftHandoffsPage />
    </RequireCapability>
  ),
});

const STATUS_TONE: Record<SHRow["status"], StatusTone> = { waiting: "waiting", accepted: "resolved", declined: "closed" };

function ShiftHandoffsPage() {
  useShellPageLabel(C.title);
  const q = useShiftHandoffs();
  const [date, setDate] = useState(() => centralToday());
  const [team, setTeam] = useState<SHTeam>("all");
  const choices = useMemo(() => dateChoices(), []);
  const view = useMemo(
    () => (q.data ? shiftHandoffsView(q.data, { date, team, demo: q.demoMode }) : null),
    // dataUpdatedAt moves the waited minutes forward on each refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, q.dataUpdatedAt, date, team, q.demoMode],
  );
  const { originSearch } = useWorkspaceOrigin(C.title);
  const isToday = date === centralToday();

  return (
    <div className="space-y-6" data-shift-handoffs-page>
      <PageHeader title={C.title} description={C.hint} />
      <div className="grid gap-3 sm:max-w-xl sm:grid-cols-2">
        <Field label={C.date}>
          <select className={SELECT_CLASS} value={date} onChange={(e) => setDate(e.target.value)} data-filter="date">
            {choices.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label={C.team}>
          <select className={SELECT_CLASS} value={team} onChange={(e) => setTeam(e.target.value as SHTeam)} data-filter="team">
            {SH_TEAMS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {q.isError ? (
        <div className="rounded-xl border border-border p-6">
          <p className="font-semibold">{C.error}</p>
          <Button className="mt-4 min-h-11" variant="outline" onClick={() => void q.refetch()}>{C.tryAgain}</Button>
        </div>
      ) : !view ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <SectionCard
            title={`${C.missedTitle} (${view.missed.length})`}
            description={C.missedHint}
            tone={view.missed.length ? "critical" : "default"}
            bodyClassName="space-y-1.5"
          >
            <div data-section="missed">
              {view.missed.length === 0 ? (
                <p className="text-sm text-muted-foreground">{C.missedNone}</p>
              ) : (
                view.missed.map((p) => <MissedRow key={p.userId} p={p} />)
              )}
            </div>
          </SectionCard>

          {view.late.length > 0 && (
            <SectionCard title={`${C.lateTitle} (${view.late.length})`} tone="critical" bodyClassName="space-y-2">
              <div data-section="late" className="space-y-2">
                {view.late.map((r) => <HandoffCard key={r.id} r={r} origin={originSearch} />)}
              </div>
            </SectionCard>
          )}

          <SectionCard title={C.shiftsTitle} bodyClassName="space-y-1.5">
            <div data-section="shifts">
              {view.shifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{C.shiftsNone}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {view.shifts.map((p) => <ShiftRow key={p.userId} p={p} />)}
                </ul>
              )}
            </div>
          </SectionCard>

          <SectionCard title={`${C.handoffsTitle} (${view.handoffs.length})`} bodyClassName="space-y-2">
            <div data-section="handoffs" className="space-y-2">
              {view.handoffs.length === 0 ? (
                <EmptyState title={C.handoffsNone} hint={isToday ? undefined : "Choose another day to see more."} />
              ) : (
                view.handoffs.map((r) => <HandoffCard key={r.id} r={r} origin={originSearch} />)
              )}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function teamName(team: string | null) {
  return team === "guest_experience" ? "Team A" : team === "property_operations" ? "Team B" : null;
}

function MissedRow({ p }: { p: SHPersonDay }) {
  return (
    <div className="flex min-h-11 items-start gap-3 rounded-lg border border-danger/30 px-4 py-3" data-missed-row>
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{p.roleLabel}{p.covering ? ` (${C.cover})` : ""}</p>
        <p className="text-sm text-muted-foreground">
          Shift ended {centralTime(p.endsAt)}. Still owns {p.openOwned} open ticket{p.openOwned === 1 ? "" : "s"}.
        </p>
      </div>
    </div>
  );
}

function ShiftRow({ p }: { p: SHPersonDay }) {
  const state =
    p.state === "ended" ? (
      <StatusBadge tone="resolved">Ended {centralTime(p.endedAt)}</StatusBadge>
    ) : p.state === "missed" ? (
      <StatusBadge tone="escalated">{C.missed}</StatusBadge>
    ) : p.state === "on_shift" ? (
      <StatusBadge tone="progress">{C.onShift}</StatusBadge>
    ) : (
      <StatusBadge tone="closed">{C.later}</StatusBadge>
    );
  const handed =
    p.state !== "ended" ? C.notYet : p.nothing ? C.nothing : `${p.handedOff} ticket${p.handedOff === 1 ? "" : "s"} handed off`;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3" data-shift-row data-state={p.state}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{p.roleLabel}{p.covering ? ` (${C.cover})` : ""}</p>
        <p className="text-sm text-muted-foreground">
          {[teamName(p.team), `${hoursLabel(p.start, p.end)}, Central time`].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        {state}
        <span className="text-sm text-muted-foreground">{handed}</span>
      </div>
    </li>
  );
}

function HandoffCard({ r, origin }: { r: SHRow; origin: { from: string } }) {
  return (
    <article
      className={`rounded-lg border px-4 py-3 ${r.late ? "border-danger/50 bg-danger/5" : "border-border"}`}
      data-handoff-row
      data-late={r.late ? "true" : "false"}
      data-status={r.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to="/tickets/$ticketId"
            params={{ ticketId: r.ticketId }}
            search={origin}
            className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
          >
            {r.ticketRef ? `#${r.ticketRef} ` : ""}{r.ticketTitle}
          </Link>
          <p className="text-sm text-muted-foreground">
            {[SH_KIND_LABEL[r.kind], priorityMeta(r.priority).label, teamName(r.team)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusBadge tone={r.late ? "escalated" : STATUS_TONE[r.status]}>{r.statusText}</StatusBadge>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">{C.from}</dt>
        <dd>{r.fromLabel}</dd>
        <dt className="text-muted-foreground">{C.to}</dt>
        <dd>{r.toLabel}</dd>
        <dt className="text-muted-foreground">{C.asked}</dt>
        <dd>{centralDayTime(r.createdAt)}</dd>
        <dt className="text-muted-foreground">{C.done}</dt>
        <dd className="whitespace-pre-wrap">{r.done || "Not written"}</dd>
        <dt className="text-muted-foreground">{C.next}</dt>
        <dd className="whitespace-pre-wrap">{r.next || "Not written"}</dd>
        <dt className="text-muted-foreground">{C.due}</dt>
        <dd>{r.dueAt ? centralDayTime(r.dueAt) : "Not set"}</dd>
      </dl>
    </article>
  );
}
