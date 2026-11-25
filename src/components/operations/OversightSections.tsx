/**
 * Oversight supervisor sections (Emily, Nov 25 2026): P1 right now, No owner,
 * Past due date and Who has what. Reads existing rows only; Reassign reuses the
 * shared bulk ticket update. Rules live in src/lib/oversight-sections.ts.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { displayName, useStaffDirectory } from "@/hooks/useTeam";
import { formatPropertyLabel } from "@/lib/property-label";
import { bulkUpdateTicketsFn } from "@/lib/queue-bulk.functions";
import { usDate } from "@/lib/dates";
import { currentOwnerId } from "@/lib/matters";
import { COORDINATOR_ROLE_LABELS } from "@/lib/coverage-model";
import { SH_COORDINATOR_CODES } from "@/lib/shift-handoffs";
import { myShiftToday, type ShiftOverride, type ShiftRole, type ShiftRow } from "@/lib/my-shift";
import { loadFor, onShiftAt, sectionRows, SECTION_LIMIT, type SectionKey, type SectionTicket } from "@/lib/oversight-sections";

export type OversightFilter = { kind: SectionKey } | { kind: "person"; id: string; label: string };

export type SectionRow = SectionTicket & {
  ref?: number | null;
  title?: string | null;
  due_locked?: boolean | null;
  properties?: Parameters<typeof formatPropertyLabel>[0] | null;
};

const PEOPLE_CODES = [...SH_COORDINATOR_CODES, "ops_supervisor"] as string[];
const ROLE_LABEL: Record<string, string> = { ...COORDINATOR_ROLE_LABELS, ops_supervisor: "Operations Supervisor" };

function useShiftPeople() {
  return useQuery({
    queryKey: ["oversight-people"],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const from = new Date(now.getTime() - 36 * 3600_000).toISOString();
      const to = new Date(now.getTime() + 36 * 3600_000).toISOString();
      const [roles, shifts, overrides] = await Promise.all([
        supabase.from("functional_roles").select("code, current_seat_holder, active"),
        supabase.from("coverage_shifts").select("role_code, weekday, start_minute, end_minute, lunch_start_minute, lunch_end_minute, active").eq("active", true),
        supabase.from("coverage_overrides").select("role_code, kind, user_id, starts_at, ends_at, created_at").lt("starts_at", to).gt("ends_at", from),
      ]);
      for (const r of [roles, shifts, overrides]) if (r.error) throw r.error;
      const roleRows = (roles.data ?? []) as ShiftRole[];
      const people = new Map<string, string>();
      for (const code of PEOPLE_CODES) {
        const r = roleRows.find((x) => x.code === code && x.active !== false && x.current_seat_holder);
        if (r?.current_seat_holder && !people.has(r.current_seat_holder)) people.set(r.current_seat_holder, ROLE_LABEL[code] ?? "Coordinator");
      }
      return [...people.entries()].map(([id, role]) => {
        const shift = myShiftToday({
          userId: id, isCoordinator: true, roles: roleRows,
          shifts: (shifts.data ?? []) as ShiftRow[], overrides: (overrides.data ?? []) as ShiftOverride[], now,
        });
        return { id, role, onShift: !shift.off && onShiftAt(shift.blocks, now) };
      });
    },
  });
}

function Due({ t }: { t: SectionRow }) {
  return (
    <span className="whitespace-nowrap">
      {t.due_on ? usDate(t.due_on) : "No date"}
      {t.due_locked ? <Lock className="ml-1 inline h-3 w-3" aria-label="Locked" /> : null}
    </span>
  );
}

function ReassignOne({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const { data: staff } = useStaffDirectory();
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await bulkUpdateTicketsFn({ data: { ticketIds: [ticketId], action: "assign", assigneeId: who } });
      if (r.updated) toast.success("Reassigned");
      if (r.skipped.length) toast.error(r.skipped[0]?.why ?? "Not changed");
      setWho("");
      await qc.invalidateQueries({ queryKey: ["oversight"] });
      await qc.invalidateQueries({ queryKey: ["team-queue"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That change could not be saved.");
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={who} onValueChange={setWho}>
        <SelectTrigger className="min-h-11 w-48" aria-label="Reassign to"><SelectValue placeholder="Reassign to" /></SelectTrigger>
        <SelectContent>{(staff ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{displayName(p)}</SelectItem>)}</SelectContent>
      </Select>
      <Button className="min-h-11" disabled={!who || busy} onClick={() => void save()}>{busy ? "Saving..." : "Reassign"}</Button>
    </div>
  );
}

export function OversightSections({
  open, nameFor, onSeeAll,
}: {
  open: SectionRow[];
  nameFor: (id: string | null) => string;
  onSeeAll: (f: OversightFilter) => void;
}) {
  const people = useShiftPeople();
  const now = new Date();
  const ownerName = (t: SectionRow) => { const id = currentOwnerId(t); return id ? nameFor(id) : "No owner"; };

  const block = (key: SectionKey, title: string, empty: string, extra: (t: SectionRow) => React.ReactNode) => {
    const rows = sectionRows(key, open, now);
    return (
      <SectionCard title={`${title} (${rows.length})`}>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
          <ul className="divide-y divide-border">
            {rows.slice(0, SECTION_LIMIT).map((t) => (
              <li key={t.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:gap-4">
                <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center hover:underline">
                  <span className="truncate font-medium">{t.ref ? `#${t.ref} ` : ""}{t.title ?? "Ticket"}</span>
                  <span className="truncate text-xs text-muted-foreground">{t.properties ? formatPropertyLabel(t.properties).full : "No property"}</span>
                </Link>
                <div className="flex flex-wrap items-center gap-3 text-sm">{extra(t)}</div>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 ? (
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => onSeeAll({ kind: key })}>See all</Button>
        ) : null}
      </SectionCard>
    );
  };

  const loads = loadFor((people.data ?? []).map((p) => p.id), open, now);

  return (
    <div className="space-y-4" data-testid="oversight-sections">
      {block("p1", "P1 right now", "No P1 tickets open.", (t) => (<><span>{ownerName(t)}</span><Due t={t} /></>))}
      {block("no_owner", "No owner", "Every open ticket has an owner.", (t) => (<><Due t={t} /><ReassignOne ticketId={t.id} /></>))}
      {block("past_due", "Past due date", "Nothing is past its due date.", (t) => (<><span>{ownerName(t)}</span><span className="font-semibold text-coral"><Due t={t} /></span></>))}
      <SectionCard title="Who has what">
        {people.isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (people.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No coordinators set up.</p>
        ) : (
          <ul className="divide-y divide-border">
            <li className="hidden grid-cols-[1fr_repeat(4,80px)] gap-2 pb-2 text-xs text-muted-foreground sm:grid">
              <span>Role</span><span>Open</span><span>Past due</span><span>Due today</span><span>On shift</span>
            </li>
            {(people.data ?? []).map((p) => {
              const l = loads.find((x) => x.id === p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSeeAll({ kind: "person", id: p.id, label: p.role })}
                    className="grid min-h-11 w-full grid-cols-2 items-center gap-2 py-2 text-left text-sm hover:bg-secondary sm:grid-cols-[1fr_repeat(4,80px)]"
                  >
                    <span className="col-span-2 flex flex-col sm:col-span-1">
                      <span className="font-medium">{p.role}</span>
                      <span className="text-xs text-muted-foreground">{nameFor(p.id)}</span>
                    </span>
                    <span><span className="sm:hidden">Open </span>{l?.open ?? 0}</span>
                    <span className={l?.pastDue ? "font-semibold text-coral" : ""}><span className="sm:hidden">Past due </span>{l?.pastDue ?? 0}</span>
                    <span><span className="sm:hidden">Due today </span>{l?.dueToday ?? 0}</span>
                    <span>{p.onShift ? "On shift" : "Off"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

/** The All open tickets filter for a section or a person. */
export function applyOversightFilter<T extends SectionRow>(open: T[], f: OversightFilter | null): T[] {
  if (!f) return open;
  if (f.kind === "person") return open.filter((t) => currentOwnerId(t) === f.id);
  return sectionRows(f.kind, open);
}

export function filterLabel(f: OversightFilter): string {
  return f.kind === "person" ? f.label : f.kind === "p1" ? "P1 right now" : f.kind === "no_owner" ? "No owner" : "Past due date";
}
