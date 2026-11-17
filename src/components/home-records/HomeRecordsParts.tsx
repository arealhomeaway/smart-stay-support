/** Monthly home records: shared screen pieces. Presentation only; rules live in src/lib/home-records.ts. */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Field, SELECT_CLASS } from "@/components/trackers/parts";
import { loadMonthRecords } from "@/lib/home-records.data";
import {
  HR_COPY, STATUS_LABEL, moneyText, monthChoices, usDay,
  type HomeTotals, type LineLink, type RecordLine, type RecordStatus,
} from "@/lib/home-records";

export function useMonthRecords(month: string) {
  return useQuery({ queryKey: ["home-records", month], queryFn: () => loadMonthRecords(month), staleTime: 60_000 });
}

export const STATUS_TONE: Record<RecordStatus, StatusTone> = { known: "resolved", pending: "waiting", missing: "escalated", na: "closed" };

export function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const choices = monthChoices();
  return (
    <Field label="Month">
      <select className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)} data-filter="month">
        {choices.some((c) => c.value === value) ? null : <option value={value}>{value}</option>}
        {choices.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
    </Field>
  );
}

/** Opens where the line lives: its Ticket, its Task, the home or Finance. */
export function LineLinkView({ link, origin, children, className }: { link: LineLink; origin: Record<string, string>; children?: React.ReactNode; className?: string }) {
  const cls = className ?? "inline-flex min-h-11 items-center font-medium text-primary hover:underline";
  const body = children ?? link.label;
  switch (link.kind) {
    case "ticket":
      return <Link to="/tickets/$ticketId" params={{ ticketId: link.ticketId }} search={origin} className={cls}>{body}</Link>;
    case "task":
      return <Link to="/onboarding/$propertyId" params={{ propertyId: link.propertyId }} search={{ task: link.taskId }} className={cls}>{body}</Link>;
    case "onboarding":
      return <Link to="/onboarding/$propertyId" params={{ propertyId: link.propertyId }} search={{ tab: link.tab }} className={cls}>{body}</Link>;
    case "home":
      return <Link to="/property/$propertyId" params={{ propertyId: link.propertyId }} search={{ tab: link.tab }} className={cls}>{body}</Link>;
    case "finance":
      return <Link to="/finance" className={cls}>{body}</Link>;
  }
}

export function TotalsStrip({ totals, withNet }: { totals: HomeTotals; withNet: boolean }) {
  const items: [string, number][] = [
    ["Billed to owner", totals.billedToOwner],
    ["Paid by ARHA", totals.paidByArha],
    ["Refunds and credits", totals.refunds],
    ["Recovered", totals.recovered],
  ];
  if (withNet) items.push([HR_COPY.netLine, totals.net]);
  return (
    <div className="space-y-1.5">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" data-totals="">
        {items.map(([label, v]) => (
          <div key={label} className="rounded-[14px] border border-border px-4 py-3">
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{moneyText(v)}</dd>
          </div>
        ))}
      </dl>
      {withNet ? <p className="text-[13px] text-muted-foreground">{HR_COPY.netLine}: {HR_COPY.netHow}. Estimates are not counted.</p> : null}
    </div>
  );
}

/** One record line: what it was and its amount, then the facts, then its status. */
export function RecordLineRow({ line, origin, homeLabel }: { line: RecordLine; origin: Record<string, string>; homeLabel?: string }) {
  const facts = [
    line.date ? usDay(line.date) : null,
    line.vendor,
    `Billed to: ${line.billedTo ?? HR_COPY.notRecorded}`,
    line.approval ? `Approval: ${line.approval}` : null,
  ].filter(Boolean);
  const money = [
    line.estimate != null ? `Estimate ${moneyText(line.estimate)}` : null,
    line.approved != null ? `Approved ${moneyText(line.approved)}` : null,
    line.paidBack != null ? `Paid back ${moneyText(line.paidBack)}` : null,
  ].filter(Boolean);
  return (
    <li className="py-3" data-line={line.id} data-status={line.status}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          {homeLabel ? <p className="text-[13px] text-muted-foreground">{homeLabel}</p> : null}
          <p className="break-words font-medium">{line.what}</p>
        </div>
        <p className="shrink-0 font-semibold tabular-nums">{line.amount != null ? moneyText(line.amount) : <span className="font-normal text-muted-foreground">No amount</span>}</p>
      </div>
      <p className="mt-0.5 break-words text-sm text-muted-foreground">{facts.join(" · ")}</p>
      {money.length ? <p className="break-words text-sm text-muted-foreground">{money.join(" · ")}</p> : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge tone={STATUS_TONE[line.status]}>{STATUS_LABEL[line.status]}</StatusBadge>
        {line.note ? <span className="text-sm">{line.status === "pending" && !line.note.startsWith("Waiting") ? `Waiting on: ${line.note}` : line.note}</span> : null}
        {line.link ? <LineLinkView link={line.link} origin={origin} /> : null}
      </div>
    </li>
  );
}

/** "What's missing this month": each item names what is missing and opens where it is fixed. */
export function MissingList({ lines, origin, homeLabels, limit }: { lines: RecordLine[]; origin: Record<string, string>; homeLabels?: Record<string, string>; limit?: number }) {
  const shown = limit ? lines.slice(0, limit) : lines;
  if (!lines.length) return <p className="text-sm text-muted-foreground">{HR_COPY.nothingMissing}</p>;
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border" data-missing-list="">
        {shown.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <div className="min-w-0 flex-1">
              {homeLabels ? <p className="text-[13px] text-muted-foreground">{homeLabels[l.propertyId] ?? ""}</p> : null}
              <p className="break-words text-sm"><span className="font-medium">{l.what}</span>: {l.note ?? "Missing"}</p>
            </div>
            {l.fix ?? l.link ? <LineLinkView link={(l.fix ?? l.link)!} origin={origin}>Fix it</LineLinkView> : null}
          </li>
        ))}
      </ul>
      {limit && lines.length > limit ? <p className="text-sm text-muted-foreground">{lines.length - limit} more below, on each home.</p> : null}
    </div>
  );
}
