/**
 * Databases, Tickets: tabs across the top with a count each, the same filters
 * on every tab, and an Open button that opens the ticket page (where Reopen
 * works for people who can work tickets, register T12). Rules live in
 * src/lib/ticket-tabs.ts; this file only draws them.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DbLinkButton } from "@/components/databases/DatabaseParts";
import { formatPropertyLabel } from "@/lib/property-label";
import { ALL, CLAIMS_TO_WORK_OPTIONS, MONTH_NAMES, PERIOD_OPTIONS, centralDay, money, type DbRow, type PeriodKind } from "@/lib/databases";
import { databaseQueryKey } from "@/lib/databases-data";
import {
  MOVE_TO_QUEUE_COPY,
  NEEDS_HOME_COPY,
  TICKET_FILTER_LABELS,
  TICKET_SORT_OPTIONS,
  TICKET_TABS,
  TICKET_VIEW_DEFAULT,
  applyTicketView,
  movableToQueue,
  originalCreatedAt,
  ticketFilterOptions,
  ticketRecordLabel,
  ticketTabCounts,
  ticketTotalsLine,
  type TicketSort,
  type TicketTabKey,
  type TicketView,
} from "@/lib/ticket-tabs";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-11 rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";
const LABEL_CLASS = "flex flex-col gap-1 text-[13px] text-muted-foreground";

const day = (iso: string | null | undefined) => {
  const d = centralDay(iso);
  if (!d) return "";
  const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
  return `${MONTH_NAMES[m - 1]!.slice(0, 3)} ${dd}, ${y}`;
};

export function TicketTabs({
  rows,
  loading,
  canFixHome,
  demoMode,
  canMoveToQueue = false,
}: {
  rows: DbRow[];
  loading: boolean;
  /** Operations Supervisor and Admin: the people who chose homes on the old review list. */
  canFixHome: boolean;
  demoMode: boolean;
  /** Operations Supervisor and the Directors: Move to queue on Older open (Build 9 B1). */
  canMoveToQueue?: boolean;
}) {
  const [view, setView] = useState<TicketView>(TICKET_VIEW_DEFAULT);
  const now = Date.now();
  const counts = useMemo(() => ticketTabCounts(rows), [rows]);
  const shown = useMemo(() => applyTicketView(rows, view), [rows, view]);
  const onTab = useMemo(() => applyTicketView(rows, { ...TICKET_VIEW_DEFAULT, tab: view.tab }), [rows, view.tab]);
  const tab = TICKET_TABS.find((t) => t.key === view.tab)!;
  const set = (patch: Partial<TicketView>) => setView((v) => ({ ...v, ...patch }));

  return (
    <div className="flex flex-col gap-3" data-ticket-tabs>
      <div role="tablist" aria-label="Tickets" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TICKET_TABS.map((t) => {
          const active = t.key === view.tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-tab={t.key}
              onClick={() => set({ tab: t.key })}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {t.label}
              <span
                data-count
                className={cn("rounded-full px-2 py-0.5 text-xs", active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}
              >
                {loading ? "…" : counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-[14px] border border-border p-3.5">
        <label className={LABEL_CLASS}>
          {TICKET_FILTER_LABELS.search}
          <input
            type="text"
            value={view.term}
            onChange={(e) => set({ term: e.target.value })}
            placeholder={TICKET_FILTER_LABELS.searchHint}
            className={SELECT_CLASS}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PeriodControls view={view} onChange={set} rows={onTab} />
          <Choice label={TICKET_FILTER_LABELS.problemType} value={view.problemType} options={ticketFilterOptions(onTab, "problemType")} onChange={(v) => set({ problemType: v })} />
          <Choice label={TICKET_FILTER_LABELS.status} value={view.status} options={ticketFilterOptions(onTab, "status")} onChange={(v) => set({ status: v })} />
          <Choice label={TICKET_FILTER_LABELS.owner} value={view.owner} options={ticketFilterOptions(onTab, "owner")} onChange={(v) => set({ owner: v })} />
          <Choice label={TICKET_FILTER_LABELS.claimsToWork} value={view.claimsToWork} options={[...CLAIMS_TO_WORK_OPTIONS]} onChange={(v) => set({ claimsToWork: v })} />
          <Choice label={TICKET_FILTER_LABELS.sort} value={view.sort} options={[...TICKET_SORT_OPTIONS]} onChange={(v) => set({ sort: v as TicketSort })} />
        </div>
        <span data-ticket-totals role="status" className="text-sm font-semibold">
          {loading ? "Loading…" : ticketTotalsLine(shown, view.tab)}
        </span>
      </div>

      {loading ? null : onTab.length === 0 ? (
        <p className="rounded-[14px] border border-border p-6 text-[15px]">{tab.empty}</p>
      ) : shown.length === 0 ? (
        <p className="rounded-[14px] border border-border p-6 text-[15px]">Nothing matches.</p>
      ) : (
        <>
          {view.tab === "older_open" && canMoveToQueue ? <MoveToQueueBar rows={shown} now={now} demoMode={demoMode} /> : null}
          <TicketTable rows={shown} tab={view.tab} now={now} canFixHome={canFixHome} demoMode={demoMode} />
        </>
      )}
      {view.tab === "needs_home" && !canFixHome && onTab.length > 0 ? (
        <p className="text-[13px] text-muted-foreground">{NEEDS_HOME_COPY.who}</p>
      ) : null}
    </div>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className={LABEL_CLASS}>
      {label}
      <select value={options.includes(value) ? value : ALL} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function PeriodControls({ view, onChange, rows }: { view: TicketView; onChange: (p: Partial<TicketView>) => void; rows: DbRow[] }) {
  const today = centralDay(new Date().toISOString())!;
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const years = [
    ...new Set([
      thisYear,
      ...rows.map((r) => (r.ticket ? Number(centralDay(originalCreatedAt(r.ticket))?.slice(0, 4)) : NaN)).filter((y) => Number.isFinite(y) && y > 0),
    ]),
  ].sort((a, b) => b - a);
  const p = view.period;
  return (
    <>
      <label className={LABEL_CLASS}>
        {TICKET_FILTER_LABELS.period}
        <select
          value={p.kind}
          onChange={(e) => {
            const kind = e.target.value as PeriodKind;
            onChange({ period: kind === "month_of" ? { kind, year: thisYear, month: thisMonth } : kind === "range" ? { kind, from: "", to: "" } : { kind } });
          }}
          className={SELECT_CLASS}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.kind} value={o.kind}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {p.kind === "month_of" && (
        <>
          <label className={LABEL_CLASS}>
            Month
            <select value={p.month ?? thisMonth} onChange={(e) => onChange({ period: { ...p, month: Number(e.target.value) } })} className={SELECT_CLASS}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLASS}>
            Year
            <select value={p.year ?? thisYear} onChange={(e) => onChange({ period: { ...p, year: Number(e.target.value) } })} className={SELECT_CLASS}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {p.kind === "range" && (
        <>
          <label className={LABEL_CLASS}>
            From
            <input type="date" value={p.from ?? ""} onChange={(e) => onChange({ period: { ...p, from: e.target.value } })} className={SELECT_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            To
            <input type="date" value={p.to ?? ""} onChange={(e) => onChange({ period: { ...p, to: e.target.value } })} className={SELECT_CLASS} />
          </label>
        </>
      )}
    </>
  );
}

type Col = { label: string; value: (r: DbRow) => string; strong?: boolean; nowrap?: boolean };

function columnsFor(tab: TicketTabKey): Col[] {
  const ref: Col = { label: "Ref", value: (r) => (r.cells[0] ? `#${r.cells[0]}` : ""), strong: true };
  const title: Col = { label: "Title", value: (r) => r.cells[1] ?? "" };
  const home: Col = { label: "Home", value: (r) => r.cells[2] ?? "" };
  if (tab === "claims_history") {
    return [
      ref,
      title,
      home,
      { label: "Claim amount", value: (r) => money(r.ticket?.claim?.amount), nowrap: true },
      { label: "Paid back", value: (r) => money(r.ticket?.claim?.paidBack), nowrap: true },
      { label: "Claim status", value: (r) => r.ticket?.claim?.status ?? "" },
      { label: "Claim date", value: (r) => day(r.ticket?.claim?.openedAt), nowrap: true },
    ];
  }
  const cols: Col[] = [
    ref,
    title,
    home,
    { label: "Problem type", value: (r) => r.cells[3] ?? "" },
    { label: "Status", value: (r) => r.cells[4] ?? "" },
  ];
  // Closed history never shows an owner (N2).
  if (tab !== "closed_history") cols.push({ label: "Owner", value: (r) => r.cells[5] ?? "" });
  cols.push({ label: "Created", value: (r) => (r.ticket ? day(originalCreatedAt(r.ticket)) : ""), nowrap: true });
  return cols;
}

function TicketTable({ rows, tab, now, canFixHome, demoMode }: { rows: DbRow[]; tab: TicketTabKey; now: number; canFixHome: boolean; demoMode: boolean }) {
  const cols = columnsFor(tab);
  const fixing = tab === "needs_home" && canFixHome;
  const label = (r: DbRow) => (r.ticket ? ticketRecordLabel(r.ticket, now) : null);
  const openButton = (r: DbRow) =>
    r.link ? (
      <DbLinkButton link={r.link}>
        Open<span className="sr-only"> ticket {r.cells[0] ? `#${r.cells[0]}` : ""}</span>
      </DbLinkButton>
    ) : null;
  return (
    <div className="overflow-hidden rounded-[14px] border border-border" data-ticket-list={tab}>
      <table className="hidden w-full text-sm md:table">
        <thead className="bg-muted/60 text-left text-[13px] font-bold text-foreground/80">
          <tr>
            {cols.map((c) => (
              <th key={c.label} className="px-3 py-2.5">
                {c.label}
              </th>
            ))}
            <th className="w-[96px] px-3 py-2.5">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-middle" data-ticket-row={r.id}>
              {cols.map((c, i) => (
                <td key={c.label} className={cn("px-3 py-2", c.strong && "font-semibold", c.nowrap && "whitespace-nowrap")}>
                  {c.value(r)}
                  {i === 1 && label(r) ? <span className="mt-0.5 block text-xs text-muted-foreground">{label(r)}</span> : null}
                  {i === 2 && fixing ? <ChooseHome row={r} demoMode={demoMode} /> : null}
                </td>
              ))}
              <td className="px-3 py-2">{openButton(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="border-t border-border p-3 first:border-t-0" data-ticket-card={r.id}>
            <div className="flex items-start justify-between gap-3">
              <dl className="grid min-w-0 flex-1 gap-1">
                {cols.map((c) => {
                  const v = c.value(r);
                  return v ? (
                    <div key={c.label} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{c.label}</dt>
                      <dd className={c.strong ? "break-words font-semibold" : "break-words text-sm"}>{v}</dd>
                    </div>
                  ) : null;
                })}
                {label(r) ? <span className="text-xs text-muted-foreground">{label(r)}</span> : null}
              </dl>
              {openButton(r)}
            </div>
            {fixing ? <ChooseHome row={r} demoMode={demoMode} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

type HomeOption = { id: string; label: string };

/** The one action the old review list offered: choose the home, which also lets the ticket be taken or reopened. */
function ChooseHome({ row, demoMode }: { row: DbRow; demoMode: boolean }) {
  const qc = useQueryClient();
  const [home, setHome] = useState("");
  const [saving, setSaving] = useState(false);
  const homes = useQuery({
    queryKey: ["databases", "ticket-homes", demoMode],
    staleTime: 60_000,
    queryFn: async (): Promise<HomeOption[]> => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname, address_line1, unit, city, state, postal_code")
        .eq("active", true)
        .eq("is_demo", demoMode)
        .is("archived_at", null);
      if (error) throw error;
      return (data ?? [])
        .map((p) => ({ id: p.id, label: formatPropertyLabel(p).primary }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  });
  const save = async () => {
    if (!home) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ property_id: home, import_hold: null } as never)
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      toast.success(NEEDS_HOME_COPY.saved(row.cells[0] ?? ""));
      await qc.invalidateQueries({ queryKey: databaseQueryKey("tickets", demoMode) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        aria-label={`${NEEDS_HOME_COPY.choose} for ticket ${row.cells[0] ? `#${row.cells[0]}` : ""}`}
        value={home}
        onChange={(e) => setHome(e.target.value)}
        className={cn(SELECT_CLASS, "min-w-0 flex-1")}
      >
        <option value="">{NEEDS_HOME_COPY.choose}</option>
        {(homes.data ?? []).map((h) => (
          <option key={h.id} value={h.id}>
            {h.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!home || saving}
        onClick={save}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {NEEDS_HOME_COPY.save}
      </button>
    </div>
  );
}

/**
 * Move to queue (Build 9 B1): pick one or several older open imports and move them into the
 * Team Queue's quiet Imported from Notion group, through the one database step
 * move_notion_to_queue. Nothing is saved unless every picked ticket can move.
 */
function MoveToQueueBar({ rows, now, demoMode }: { rows: DbRow[]; now: number; demoMode: boolean }) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const movable = rows.filter((r) => r.ticket && movableToQueue(r.ticket, now));
  const chosen = movable.filter((r) => picked.has(r.id));
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const move = async () => {
    if (!chosen.length) return;
    setSaving(true);
    try {
      const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: number | null; error: { message: string } | null }>;
      const { data, error } = await rpc("move_notion_to_queue", { _ticket_ids: chosen.map((r) => r.id) });
      if (error) throw new Error(error.message);
      toast.success(MOVE_TO_QUEUE_COPY.moved(Number(data ?? chosen.length)));
      setPicked(new Set());
      await qc.invalidateQueries({ queryKey: databaseQueryKey("tickets", demoMode) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nothing was moved. Try again.");
    } finally {
      setSaving(false);
    }
  };
  if (!movable.length) return null;
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-border p-3" data-move-to-queue>
      <ul className="flex flex-col gap-1">
        {movable.map((r) => {
          const ref = r.cells[0] ? `#${r.cells[0]}` : "";
          return (
            <li key={r.id}>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={picked.has(r.id)}
                  onChange={() => toggle(r.id)}
                  aria-label={MOVE_TO_QUEUE_COPY.pick(ref)}
                />
                <span className="font-semibold">{ref}</span>
                <span className="min-w-0 truncate">{r.cells[1] ?? ""}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPicked(new Set(movable.map((r) => r.id)))}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
        >
          {MOVE_TO_QUEUE_COPY.selectAll}
        </button>
        {chosen.length ? (
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
          >
            {MOVE_TO_QUEUE_COPY.clear}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!chosen.length || saving}
          onClick={move}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {MOVE_TO_QUEUE_COPY.button(chosen.length)}
        </button>
      </div>
    </div>
  );
}

