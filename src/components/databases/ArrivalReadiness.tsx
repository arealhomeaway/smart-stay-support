/**
 * Databases, Arrival readiness (Build 12; register BN10; docs/specs/arrival-check.md): every
 * arrival check with its home, check in, deadline, who completed it and when, the result, any
 * issue and backup plan, and the ticket. Filters: Period, Home, Completed by, Result, Team, with
 * totals of what is shown. Read only. A coordinator sees only their own checks (database rule);
 * test checks show, marked Test, only to the people who run the test plan, and never count.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DbLinkButton } from "@/components/databases/DatabaseParts";
import { useStaffDirectory, displayName } from "@/hooks/useTeam";
import { periodRange, type PeriodKind } from "@/lib/databases";
import {
  arrivalResultLabel,
  arrivalTime,
  arrivalTotals,
  filterArrivalRows,
  type ArrivalFilter,
  type ArrivalRow,
} from "@/lib/arrival-check";
import { TEAM_A, TEAM_B } from "@/lib/coverage-model";

const SELECT_CLASS = "h-11 rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";
const LABEL_CLASS = "flex flex-col gap-1 text-[13px] text-muted-foreground";
const PERIODS: { kind: PeriodKind; label: string }[] = [
  { kind: "all", label: "All time" },
  { kind: "week", label: "This week" },
  { kind: "month", label: "This month" },
  { kind: "year", label: "This year" },
  { kind: "range", label: "Choose dates" },
];
const RESULTS: { value: NonNullable<ArrivalFilter["result"]>; label: string }[] = [
  { value: "on_time", label: "On time" },
  { value: "late", label: "Late" },
  { value: "missed", label: "Missed" },
  { value: "open", label: "Not done yet" },
  { value: "cancelled", label: "Cancelled" },
];
const TEAMS = [
  { value: TEAM_B, label: "Property Operations" },
  { value: TEAM_A, label: "Guest Experience" },
];
const dayLabel = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

type Db = { from: (t: string) => any };

export function ArrivalReadiness({ demoMode }: { demoMode: boolean }) {
  const staff = useStaffDirectory();
  const q = useQuery({
    queryKey: ["arrival-readiness", demoMode],
    enabled: !demoMode,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as Db)
        .from("arrival_checks")
        .select("id, home_label, property_id, arrival_on, check_in_at, deadline_at, time_zone, team, status, result, outcome, issue_text, backup_plan, completed_by, completed_at, ticket_id, late_booking, is_test, cleared_at")
        .order("check_in_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as ArrivalRow[];
    },
  });
  const [period, setPeriod] = useState<PeriodKind>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [home, setHome] = useState("");
  const [person, setPerson] = useState("");
  const [result, setResult] = useState("");
  const [team, setTeam] = useState("");

  const rows = q.data ?? [];
  const range = period === "range" ? { from: from || null, to: to || null } : periodRange({ kind: period });
  const shown = useMemo(
    () =>
      filterArrivalRows(rows, {
        from: range?.from ?? null,
        to: range?.to ?? null,
        home: home || null,
        person: person || null,
        result: (result || null) as ArrivalFilter["result"],
        team: team || null,
      }),
    [rows, range?.from, range?.to, home, person, result, team],
  );
  const totals = arrivalTotals(shown);
  const homes = [...new Map(rows.filter((r) => r.property_id).map((r) => [r.property_id!, r.home_label])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const people = [...new Set(rows.map((r) => r.completed_by).filter(Boolean) as string[])];
  const nameOf = (id: string | null) => (id ? displayName((staff.data ?? []).find((m) => m.id === id)) : "");

  if (demoMode) return <p className="text-sm text-muted-foreground">No arrival checks in the demo.</p>;

  return (
    <div className="flex flex-col gap-4" data-arrival-readiness>
      <div className="grid grid-cols-1 gap-3 rounded-[14px] border border-border p-3.5 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          Period
          <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodKind)} className={SELECT_CLASS}>
            {PERIODS.map((p) => <option key={p.kind} value={p.kind}>{p.label}</option>)}
          </select>
        </label>
        {period === "range" && (
          <div className="grid grid-cols-2 gap-3">
            <label className={LABEL_CLASS}>
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={SELECT_CLASS} />
            </label>
            <label className={LABEL_CLASS}>
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={SELECT_CLASS} />
            </label>
          </div>
        )}
        <label className={LABEL_CLASS}>
          Home
          <select value={home} onChange={(e) => setHome(e.target.value)} className={SELECT_CLASS}>
            <option value="">All</option>
            {homes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Completed by
          <select value={person} onChange={(e) => setPerson(e.target.value)} className={SELECT_CLASS}>
            <option value="">All</option>
            {people.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Result
          <select value={result} onChange={(e) => setResult(e.target.value)} className={SELECT_CLASS}>
            <option value="">All</option>
            {RESULTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Team
          <select value={team} onChange={(e) => setTeam(e.target.value)} className={SELECT_CLASS}>
            <option value="">All</option>
            {TEAMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <p className="text-sm font-medium" data-arrival-totals>
        {totals.checks} {totals.checks === 1 ? "check" : "checks"} · {totals.onTime} on time
        {totals.onTimeShare === null ? "" : ` (${totals.onTimeShare}%)`} · {totals.late} late · {totals.missed} missed ·{" "}
        {totals.issues} {totals.issues === 1 ? "issue" : "issues"} flagged
      </p>

      {q.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Loading…</p>
      ) : q.error ? (
        <p role="alert" className="text-destructive">This list could not be loaded. Try again in a moment.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No arrival checks match.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-3.5" data-arrival-row={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.home_label}
                    {r.is_test && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-medium">Test</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {dayLabel(r.arrival_on)} · Check in {arrivalTime(r.check_in_at, r.time_zone)} · Deadline {arrivalTime(r.deadline_at, r.time_zone)}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{arrivalResultLabel(r)}</span>
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted-foreground">Completed by </dt><dd className="inline">{r.completed_by ? nameOf(r.completed_by) : "Not done"}</dd></div>
                <div><dt className="inline text-muted-foreground">Completed at </dt><dd className="inline">{r.completed_at ? arrivalTime(r.completed_at, r.time_zone) : "Not done"}</dd></div>
                {r.outcome === "issue" && (
                  <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Issue and backup plan </dt><dd className="inline">{r.issue_text} Backup plan: {r.backup_plan}</dd></div>
                )}
              </dl>
              {r.ticket_id && (
                <div className="mt-2">
                  <DbLinkButton link={{ kind: "ticket", id: r.ticket_id }}>Open</DbLinkButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
