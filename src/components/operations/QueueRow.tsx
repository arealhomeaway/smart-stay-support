/**
 * Team Queue board pieces (Emily, Nov 7, 2026): one group box and one row, as drawn.
 * Words come from TEAM_QUEUE_COPY in src/lib/team-queue-board.ts.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { TEAM_QUEUE_COPY, urgencyChipClass, urgencyName } from "@/lib/team-queue-board";

export function QueueGroup({
  title,
  countLine,
  action,
  children,
  testId,
}: {
  title: string;
  countLine: string;
  action?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <section aria-label={title} data-testid={testId} className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-muted/60 px-4 py-3">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground">{countLine}</span>
          {action}
        </div>
      </header>
      {children ? <ul className="divide-y divide-border">{children}</ul> : null}
    </section>
  );
}

export function QueueChip({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`}>{children}</span>;
}

export type QueueRowDone = {
  title: string;
  ticketId: string;
  secondary?: { label: string; onClick: () => void; busy?: boolean } | null;
};

export function QueueRow({
  ticketId,
  originSearch,
  sourceChip,
  type,
  priority,
  guest,
  home,
  wait,
  quietLine,
  fromLine,
  alert,
  breezewayUrl,
  nextStep,
  actions,
  below,
  done,
}: {
  ticketId: string;
  originSearch: { from: string };
  sourceChip: string;
  type: string;
  priority: string | null | undefined;
  guest: boolean;
  home: string | null;
  wait?: { text: string; late: boolean } | null;
  quietLine?: string | null;
  fromLine?: string | null;
  alert?: string | null;
  breezewayUrl?: string | null;
  nextStep?: string | null;
  actions?: ReactNode;
  below?: ReactNode;
  done?: QueueRowDone | null;
}) {
  if (done) {
    return (
      <li className="px-4 py-3.5" data-testid="queue-row-done">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-success/50 bg-success/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-bold">{done.title}</p>
            <p className="text-sm text-muted-foreground">{TEAM_QUEUE_COPY.at(type, home ?? TEAM_QUEUE_COPY.noHome)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-12 rounded-[10px] px-4 text-[15px] font-bold">
              <Link to="/tickets/$ticketId" params={{ ticketId: done.ticketId }} search={originSearch}>
                {TEAM_QUEUE_COPY.openTicket}
              </Link>
            </Button>
            {done.secondary ? (
              <Button
                variant="outline"
                className="min-h-12 rounded-[10px] border-primary px-4 text-[15px] font-bold text-primary"
                disabled={done.secondary.busy}
                onClick={done.secondary.onClick}
              >
                {done.secondary.label}
              </Button>
            ) : null}
          </div>
        </div>
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between" data-testid="queue-row">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <QueueChip className="bg-muted text-foreground">{sourceChip}</QueueChip>
          <Link
            to="/tickets/$ticketId"
            params={{ ticketId }}
            search={originSearch}
            className="text-[15px] font-bold hover:underline"
          >
            {type}
          </Link>
          <QueueChip className={urgencyChipClass(priority)}>{urgencyName(priority)}</QueueChip>
          {guest ? <QueueChip className="bg-primary/10 text-primary">{TEAM_QUEUE_COPY.guest}</QueueChip> : null}
        </div>
        <p className="text-sm text-foreground/80">{home ?? TEAM_QUEUE_COPY.noHome}</p>
        {fromLine ? <p className="text-[13px] text-muted-foreground">{fromLine}</p> : null}
        {quietLine ? <p className="text-[13px] text-muted-foreground">{quietLine}</p> : null}
        {wait ? (
          <p className={`text-[13px] ${wait.late ? "font-bold text-danger" : "text-muted-foreground"}`}>{wait.text}</p>
        ) : null}
        {alert ? <p className="text-[13px] font-bold text-danger">{alert}</p> : null}
        {breezewayUrl ? (
          <a
            href={breezewayUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center text-[13px] font-bold text-primary hover:underline"
          >
            {TEAM_QUEUE_COPY.openBreezeway}
          </a>
        ) : null}
        {nextStep ? <p className="text-[13px] text-muted-foreground">{TEAM_QUEUE_COPY.nextStep(nextStep)}</p> : null}
        {below}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </li>
  );
}

export function TakeButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button className="min-h-12 rounded-[10px] px-5 text-[15px] font-bold" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}
