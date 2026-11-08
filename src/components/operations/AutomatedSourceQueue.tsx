/**
 * Team Queue, Pick up work: tickets from the info inbox, Breezeway and OwnerRez wait here
 * with no owner (register T15) in the board's groups From email, From Breezeway and From
 * OwnerRez, built from the ticket's source field. A coordinator presses Take it; the row then
 * reads You took it. with Open ticket and Give it back. Rules in src/lib/automated-sources.ts
 * and src/lib/team-queue-board.ts.
 */
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPropertyLabel, type PropertyLabelFields } from "@/lib/property-label";
import { breezewayTaskUrl } from "@/lib/departure-review";
import type { CoverageConfig } from "@/lib/coverage";
import { takeTicketPatch, type AutomatedSource, type AutomatedTicket } from "@/lib/automated-sources";
import {
  TEAM_QUEUE_COPY,
  alertLine,
  giveBackPatch,
  groupCountLine,
  isLate,
  sortPickRows,
  sourceGroups,
  waitLine,
  type QueueScope,
} from "@/lib/team-queue-board";
import { QueueGroup, QueueRow, TakeButton, type DoneProps } from "./QueueRow";

export type SourceRow = AutomatedTicket & {
  ref?: number | null;
  title?: string | null;
  priority?: string | null;
  property_id?: string | null;
  properties?: PropertyLabelFields | null;
  work_types?: { name?: string | null; functional_role_code?: string | null } | null;
  guest_in_residence?: boolean | null;
  escalation_level?: string | null;
  next_action?: string | null;
  breezeway_task_url?: string | null;
  breezeway_task_id?: string | null;
  assignment_source?: string | null;
  assignment_note?: string | null;
};

type Db = { from: (t: string) => any };

export const rowType = (t: { work_types?: { name?: string | null } | null; title?: string | null }) =>
  t.work_types?.name || t.title || "Ticket";
export const rowHome = (t: { property_id?: string | null; properties?: PropertyLabelFields | null }) =>
  t.property_id && t.properties ? formatPropertyLabel(t.properties).primary : null;
export const rowBreezeway = (t: { breezeway_task_url?: string | null; breezeway_task_id?: string | null }) =>
  t.breezeway_task_url || breezewayTaskUrl(t.breezeway_task_id) || null;

export function AutomatedSourceQueue({
  rows,
  userId,
  canTake,
  scope,
  myTeam,
  cfg,
  now,
  originSearch,
  onTaken,
  done,
  setDone,
}: {
  rows: SourceRow[];
  userId: string | null;
  canTake: boolean;
  scope: QueueScope;
  myTeam: string | null;
  cfg: CoverageConfig | null;
  now: Date;
  originSearch: { from: string };
  onTaken: () => unknown;
} & DoneProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const live = sourceGroups(rows, scope, myTeam);

  async function take(t: SourceRow, source: AutomatedSource, team: string | null) {
    if (!userId) return;
    setBusy(t.id);
    try {
      const db = supabase as unknown as Db;
      const { data, error } = await db
        .from("tickets")
        .update(takeTicketPatch(t, userId))
        .eq("id", t.id)
        .is("assigned_to", null)
        .is("current_action_owner", null)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error(TEAM_QUEUE_COPY.alreadyTaken);
      } else {
        await db.from("ticket_activity").insert({
          ticket_id: t.id,
          author_id: userId,
          kind: "assignment",
          event_type: "assigned",
          body: TEAM_QUEUE_COPY.history.took,
          internal: false,
          mentions: [],
        });
        setDone(t.id, { kind: "took", group: source, team, snapshot: t as unknown as Record<string, unknown>, before: t as unknown as Record<string, unknown> });
      }
      await onTaken();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : TEAM_QUEUE_COPY.notDone);
    } finally {
      setBusy(null);
    }
  }

  async function giveBack(id: string) {
    const entry = done[id];
    if (!userId || !entry) return;
    setBusy(id);
    try {
      const db = supabase as unknown as Db;
      const { data, error } = await db
        .from("tickets")
        .update(giveBackPatch(entry.before ?? {}))
        .eq("id", id)
        .eq("assigned_to", userId)
        .eq("current_action_owner", userId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(TEAM_QUEUE_COPY.notDone);
      await db.from("ticket_activity").insert({
        ticket_id: id,
        author_id: userId,
        kind: "assignment",
        event_type: "unassigned",
        body: TEAM_QUEUE_COPY.history.gaveBack,
        internal: false,
        mentions: [],
      });
      setDone(id, null);
      await onTaken();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : TEAM_QUEUE_COPY.notDone);
    } finally {
      setBusy(null);
    }
  }

  const groups = (["email", "breezeway", "ownerrez"] as const)
    .map((source) => {
      const liveRows = live.find((g) => g.source === source)?.rows ?? [];
      const liveIds = new Set(liveRows.map((r) => r.row.id));
      const doneRows = Object.values(done)
        .filter((d) => d.kind === "took" && d.group === source && !liveIds.has(String(d.snapshot["id"])))
        .map((d) => ({ row: d.snapshot as unknown as SourceRow, team: d.team }));
      const all = sortPickRows(
        [...liveRows, ...doneRows],
        (w) => ({ priority: w.row.priority ?? null, team: w.team, since: w.row.reported_at ?? null }),
        myTeam,
      );
      return { source, liveRows, all };
    })
    .filter((g) => g.all.length > 0);

  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((g) => (
        <QueueGroup
          key={g.source}
          title={TEAM_QUEUE_COPY.groups[g.source]}
          countLine={groupCountLine(g.liveRows.map((r) => r.row.reported_at), now)}
          testId={`queue-group-${g.source}`}
        >
          {g.all.map(({ row: t, team }) => {
            const entry = done[t.id];
            const late = isLate(t.priority, t.reported_at, now, cfg);
            return (
              <QueueRow
                key={t.id}
                ticketId={t.id}
                originSearch={originSearch}
                sourceChip={TEAM_QUEUE_COPY.sourceChip[g.source]}
                type={rowType(t)}
                priority={t.priority}
                guest={Boolean(t.guest_in_residence)}
                home={rowHome(t)}
                wait={{ text: waitLine(t.reported_at, now, late), late }}
                alert={alertLine(t.priority, t.escalation_level)}
                breezewayUrl={rowBreezeway(t)}
                nextStep={t.next_action ?? null}
                done={
                  entry
                    ? {
                        title: TEAM_QUEUE_COPY.took,
                        ticketId: t.id,
                        secondary: { label: TEAM_QUEUE_COPY.giveBack, onClick: () => void giveBack(t.id), busy: busy !== null },
                      }
                    : null
                }
                actions={
                  canTake && userId ? (
                    <TakeButton
                      label={busy === t.id ? TEAM_QUEUE_COPY.taking : TEAM_QUEUE_COPY.take}
                      disabled={busy !== null}
                      onClick={() => void take(t, g.source, team)}
                    />
                  ) : null
                }
              />
            );
          })}
        </QueueGroup>
      ))}
    </>
  );
}
