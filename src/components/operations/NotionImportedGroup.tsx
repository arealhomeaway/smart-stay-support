/**
 * Team Queue, Pick up work, last group: open tickets imported from Notion in the last 30
 * days (register T7, N4). Quiet on purpose: collapsed by default, no clocks, no red state,
 * no alert line, never in the chip counts. Opened, rows sit under the chosen team (Team A,
 * Team B, Unassigned when no home or no team). Take it makes the person the owner through
 * the one Notion rule (reopen_notion_ticket). Rules in notion-ticket-display.ts.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPropertyLabel, type PropertyLabelFields } from "@/lib/property-label";
import { NOTION_GROUPS, notionQueueGroups, type NotionGroup, type NotionQueueRow } from "@/lib/notion-ticket-display";
import { reopenNotionTicket } from "@/lib/notion-reopen.functions";
import { TEAM_QUEUE_COPY, sortPickRows, type QueueScope } from "@/lib/team-queue-board";
import { QueueGroup, QueueRow, TakeButton, type DoneProps } from "./QueueRow";

export const NOTION_GROUP_COPY = {
  title: TEAM_QUEUE_COPY.groups.notion,
  line: TEAM_QUEUE_COPY.notionLine,
  show: TEAM_QUEUE_COPY.show,
  hide: TEAM_QUEUE_COPY.hide,
} as const;

type Row = NotionQueueRow & {
  id: string;
  ref?: number | null;
  title?: string | null;
  priority?: string | null;
  property_id?: string | null;
  guest_in_residence?: boolean | null;
  properties?: PropertyLabelFields | null;
  work_types?: { name?: string | null } | null;
};

/** Which Notion sub groups a chip shows: its team plus Unassigned; All shows all three. */
export function notionGroupsFor(scope: QueueScope): NotionGroup[] {
  if (scope === "a") return ["team_a", "unassigned"];
  if (scope === "b") return ["team_b", "unassigned"];
  return ["team_a", "team_b", "unassigned"];
}

export function NotionImportedGroup({
  rows,
  homeTeamOf,
  scope,
  canTake,
  originSearch,
  onTaken,
  done,
  setDone,
}: {
  rows: Row[];
  homeTeamOf: (userId: string | null) => string | null;
  scope: QueueScope;
  canTake: boolean;
  originSearch: { from: string };
  onTaken: () => unknown;
} & DoneProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const take = useServerFn(reopenNotionTicket);
  const groups = notionQueueGroups(rows, homeTeamOf);
  const shown = notionGroupsFor(scope);
  const doneFor = (g: NotionGroup) =>
    Object.values(done)
      .filter((d) => d.kind === "notion_took" && d.group === `notion:${g}`)
      .map((d) => d.snapshot as unknown as Row);
  const sections = NOTION_GROUPS.filter((g) => shown.includes(g.value))
    .map((g) => {
      const live = groups[g.value];
      const ids = new Set(live.map((r) => r.id));
      const all = sortPickRows(
        [...live, ...doneFor(g.value).filter((r) => !ids.has(r.id))],
        (r) => ({ priority: r.priority ?? null, team: null, since: r.reported_at ?? null }),
        null,
      );
      return { ...g, live, all };
    })
    .filter((g) => g.all.length > 0);
  const total = sections.reduce((n, g) => n + g.live.length, 0);
  if (sections.length === 0) return null;

  async function takeIt(t: Row, group: NotionGroup) {
    setBusy(t.id);
    try {
      await take({ data: { ticketId: t.id, reason: TEAM_QUEUE_COPY.notionTakeReason } });
      setDone(t.id, { kind: "notion_took", group: `notion:${group}`, team: null, snapshot: t as unknown as Record<string, unknown> });
      await onTaken();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : TEAM_QUEUE_COPY.notDone);
    } finally {
      setBusy(null);
    }
  }

  return (
    <QueueGroup
      title={NOTION_GROUP_COPY.title}
      countLine={TEAM_QUEUE_COPY.notionCount(total)}
      testId="notion-imported-group"
      action={
        <Button
          variant="outline"
          className="min-h-11 rounded-[10px] px-4 font-bold"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? NOTION_GROUP_COPY.hide : NOTION_GROUP_COPY.show}
        </Button>
      }
    >
      {open
        ? sections.map((g) => (
            <li key={g.value} aria-label={g.label}>
              <p className="bg-muted/30 px-4 py-2 text-[13px] font-semibold">{TEAM_QUEUE_COPY.notionTeams[g.value]}</p>
              <ul className="divide-y divide-border">
                {g.all.map((t) => {
                  const entry = done[t.id];
                  const home = t.import_hold === "needs_home" || !t.property_id || !t.properties ? null : formatPropertyLabel(t.properties).primary;
                  return (
                    <QueueRow
                      key={t.id}
                      ticketId={t.id}
                      originSearch={originSearch}
                      sourceChip={TEAM_QUEUE_COPY.sourceChip.notion}
                      type={t.work_types?.name || t.title || "Ticket"}
                      priority={t.priority}
                      guest={Boolean(t.guest_in_residence)}
                      home={home}
                      quietLine={NOTION_GROUP_COPY.line}
                      done={entry ? { title: TEAM_QUEUE_COPY.took, ticketId: t.id, secondary: null } : null}
                      actions={
                        canTake ? (
                          <TakeButton
                            label={busy === t.id ? TEAM_QUEUE_COPY.taking : TEAM_QUEUE_COPY.take}
                            disabled={busy !== null}
                            onClick={() => void takeIt(t, g.value)}
                          />
                        ) : null
                      }
                    />
                  );
                })}
              </ul>
            </li>
          ))
        : null}
    </QueueGroup>
  );
}
