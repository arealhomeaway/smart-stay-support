/**
 * Team Queue, Pick up work: Handoffs waiting for you (register T6). Accept moves the next
 * step to you; Decline needs a short reason and sends it back. Ownership moves only on
 * Accept. The ticket is saved first and the handoff recorded only when the ticket really
 * changed (settleHandoff), the same order as the ticket's own Reassignments panel.
 */
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CoverageConfig } from "@/lib/coverage";
import { handoffAcceptPatch, settleHandoff } from "@/lib/handoff-accept";
import type { PropertyLabelFields } from "@/lib/property-label";
import { OPEN_STATUSES } from "@/lib/tickets";
import {
  TEAM_QUEUE_COPY,
  declineReasonOk,
  groupCountLine,
  handoffFromLine,
  handoffsForMe,
  isLate,
  sortPickRows,
  ticketTeam,
  waitLine,
  type HandoffQueueRow,
} from "@/lib/team-queue-board";
import { QueueGroup, QueueRow, type DoneProps } from "./QueueRow";
import { rowBreezeway, rowHome, rowType, type SourceRow } from "./AutomatedSourceQueue";

type Db = { from: (t: string) => any };

export type HandoffRow = HandoffQueueRow & { ticket: (SourceRow & { is_demo?: boolean | null; handoff_status?: string | null; pending_handoff_to?: string | null; current_action_owner?: string | null }) | null };

export const handoffsKey = (userId: string | null, demoMode: boolean) => ["team-queue-handoffs", userId, demoMode] as const;

const TICKET_FIELDS =
  "id, ref, title, priority, status, guest_in_residence, property_id, functional_role_code, archived_at, is_demo, external_source, breezeway_task_url, breezeway_task_id, next_action, escalation_level, handoff_status, pending_handoff_to, current_action_owner, assigned_to, record_owner, accountable_owner, assignment_source, assignment_note, reported_at, properties(name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id), work_types(name, functional_role_code)";

/** Pending handoffs offered to this person, by name or to a role they hold now. */
export async function loadHandoffsForMe(userId: string | null, demoMode: boolean): Promise<HandoffRow[]> {
  if (!userId) return [];
  const db = supabase as unknown as Db;
  const [h, roles] = await Promise.all([
    db
      .from("handoffs")
      .select(`id, ticket_id, from_user, to_user, to_role_code, priority, next_action, created_at, status, ticket:tickets(${TICKET_FIELDS})`)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200),
    db.from("functional_roles").select("code").eq("current_seat_holder", userId),
  ]);
  if (h.error) throw h.error;
  const codes = new Set<string>(((roles.data ?? []) as { code: string }[]).map((r) => r.code));
  return handoffsForMe((h.data ?? []) as HandoffRow[], userId, codes, demoMode, OPEN_STATUSES);
}

type TicketState = {
  handoff_status: string | null;
  pending_handoff_to: string | null;
  current_action_owner: string | null;
  assignment_source: string | null;
  assignment_note: string | null;
};

export function TicketHandoffsQueue({
  rows,
  userId,
  canAct,
  myTeam,
  homeTeamOf,
  cfg,
  now,
  originSearch,
  onChanged,
  done,
  setDone,
}: {
  rows: HandoffRow[];
  userId: string | null;
  canAct: boolean;
  myTeam: string | null;
  homeTeamOf: (userId: string | null) => string | null;
  cfg: CoverageConfig | null;
  now: Date;
  originSearch: { from: string };
  onChanged: () => unknown;
} & DoneProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const db = supabase as unknown as Db;

  const liveIds = new Set(rows.map((h) => h.id));
  const doneRows = Object.values(done)
    .filter((d) => (d.kind === "accepted" || d.kind === "declined") && d.group === "handoffs" && !liveIds.has(String(d.handoffId)))
    .map((d) => d.snapshot as unknown as HandoffRow);
  const all = sortPickRows(
    [...rows, ...doneRows],
    (h) => ({ priority: h.priority ?? h.ticket?.priority ?? null, team: h.ticket ? ticketTeam(h.ticket) : null, since: h.created_at }),
    myTeam,
  );
  if (all.length === 0) return null;

  const stateOf = (t: NonNullable<HandoffRow["ticket"]>): TicketState => ({
    handoff_status: t.handoff_status ?? null,
    pending_handoff_to: t.pending_handoff_to ?? null,
    current_action_owner: t.current_action_owner ?? null,
    assignment_source: t.assignment_source ?? null,
    assignment_note: t.assignment_note ?? null,
  });

  async function log(ticketId: string, eventType: string, body: string) {
    await db.from("ticket_activity").insert({ ticket_id: ticketId, author_id: userId, kind: "handoff", event_type: eventType, body, internal: false, mentions: [] });
  }

  async function accept(h: HandoffRow) {
    if (!userId || !h.ticket) return;
    setBusy(h.id);
    const before = stateOf(h.ticket);
    try {
      const result = await settleHandoff("accept", {
        saveTicket: async () => {
          const { data, error } = await db
            .from("tickets")
            .update({ handoff_status: "accepted", pending_handoff_to: null, current_action_owner: userId, assignment_source: "manual", assignment_note: null })
            .eq("id", h.ticket_id)
            .select("id");
          return { error, rows: data?.length ?? 0 };
        },
        saveHandoff: async () => {
          const { data, error } = await db
            .from("handoffs")
            .update(handoffAcceptPatch(userId, new Date().toISOString()))
            .eq("id", h.id)
            .eq("status", "pending")
            .select("id");
          return { error, rows: data?.length ?? 0 };
        },
        undoTicket: async () => db.from("tickets").update(before).eq("id", h.ticket_id),
      });
      if (!result.ok) {
        toast.error(result.message);
      } else {
        await log(h.ticket_id, "handoff_accepted", TEAM_QUEUE_COPY.history.accepted);
        setDone(h.ticket_id, { kind: "accepted", group: "handoffs", team: ticketTeam(h.ticket), snapshot: h as unknown as Record<string, unknown>, before, handoffId: h.id });
      }
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function decline(h: HandoffRow) {
    if (!userId || !h.ticket || !declineReasonOk(reason)) return;
    setBusy(h.id);
    const before = stateOf(h.ticket);
    const why = reason.trim();
    try {
      const result = await settleHandoff("decline", {
        saveTicket: async () => {
          const { data, error } = await db
            .from("tickets")
            .update({ handoff_status: "rejected", pending_handoff_to: null })
            .eq("id", h.ticket_id)
            .select("id");
          return { error, rows: data?.length ?? 0 };
        },
        saveHandoff: async () => {
          const { data, error } = await db
            .from("handoffs")
            .update({ status: "rejected", responded_at: new Date().toISOString(), response_reason: why })
            .eq("id", h.id)
            .eq("status", "pending")
            .select("id");
          return { error, rows: data?.length ?? 0 };
        },
        undoTicket: async () => db.from("tickets").update(before).eq("id", h.ticket_id),
      });
      if (!result.ok) {
        toast.error(result.message);
      } else {
        await log(h.ticket_id, "handoff_rejected", TEAM_QUEUE_COPY.history.declined(why));
        setDeclining(null);
        setReason("");
        setDone(h.ticket_id, { kind: "declined", group: "handoffs", team: ticketTeam(h.ticket), snapshot: h as unknown as Record<string, unknown>, before, handoffId: h.id });
      }
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  /** Give it back after Accept, or Undo after Decline: the ticket and the handoff as they were. */
  async function revert(ticketId: string) {
    const entry = done[ticketId];
    if (!userId || !entry?.handoffId || !entry.before) return;
    setBusy(entry.handoffId);
    const accepted = entry.kind === "accepted";
    try {
      const tq = db.from("tickets").update(entry.before).eq("id", ticketId);
      const t = await (accepted ? tq.eq("current_action_owner", userId) : tq.eq("handoff_status", "rejected")).select("id");
      if (t.error || !t.data?.length) throw new Error(TEAM_QUEUE_COPY.notDone);
      const hq = await db
        .from("handoffs")
        .update(accepted
          ? { status: "pending", responded_at: null, accepted_by: null, accepted_at: null }
          : { status: "pending", responded_at: null, response_reason: null })
        .eq("id", entry.handoffId)
        .eq("status", accepted ? "accepted" : "rejected")
        .select("id");
      if (hq.error || !hq.data?.length) {
        // Put the ticket back to what the handoff record still says.
        await db
          .from("tickets")
          .update(accepted
            ? { handoff_status: "accepted", pending_handoff_to: null, current_action_owner: userId, assignment_source: "manual", assignment_note: null }
            : { handoff_status: "rejected", pending_handoff_to: null })
          .eq("id", ticketId);
        throw new Error(TEAM_QUEUE_COPY.notDone);
      }
      await log(ticketId, accepted ? "handoff_returned" : "handoff_decline_undone", accepted ? TEAM_QUEUE_COPY.history.gaveBackHandoff : TEAM_QUEUE_COPY.history.undoDecline);
      setDone(ticketId, null);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : TEAM_QUEUE_COPY.notDone);
    } finally {
      setBusy(null);
    }
  }

  return (
    <QueueGroup
      title={TEAM_QUEUE_COPY.groups.handoffs}
      countLine={groupCountLine(rows.map((h) => h.created_at), now)}
      testId="queue-group-handoffs"
    >
      {all.map((h) => {
        const t = h.ticket;
        if (!t) return null;
        const entry = done[h.ticket_id];
        const priority = h.priority ?? t.priority ?? null;
        const late = isLate(priority, h.created_at, now, cfg);
        const isDeclining = declining === h.id;
        return (
          <QueueRow
            key={h.id}
            ticketId={h.ticket_id}
            originSearch={originSearch}
            sourceChip={TEAM_QUEUE_COPY.sourceChip.handoff}
            type={rowType(t)}
            priority={priority}
            guest={Boolean(t.guest_in_residence)}
            home={rowHome(t)}
            fromLine={handoffFromLine(homeTeamOf(h.from_user), ticketTeam(t) ?? myTeam)}
            wait={{ text: waitLine(h.created_at, now, late), late }}
            breezewayUrl={rowBreezeway(t)}
            nextStep={h.next_action}
            done={
              entry
                ? {
                    title: entry.kind === "accepted" ? TEAM_QUEUE_COPY.accepted : TEAM_QUEUE_COPY.declined,
                    ticketId: h.ticket_id,
                    secondary: {
                      label: entry.kind === "accepted" ? TEAM_QUEUE_COPY.giveBack : TEAM_QUEUE_COPY.undo,
                      onClick: () => void revert(h.ticket_id),
                      busy: busy !== null,
                    },
                  }
                : null
            }
            actions={
              canAct && userId ? (
                <>
                  <Button className="min-h-12 rounded-[10px] px-5 text-[15px] font-bold" disabled={busy !== null} onClick={() => void accept(h)}>
                    {TEAM_QUEUE_COPY.accept}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-12 rounded-[10px] border-primary px-5 text-[15px] font-bold text-primary"
                    disabled={busy !== null}
                    aria-expanded={isDeclining}
                    onClick={() => {
                      setDeclining(isDeclining ? null : h.id);
                      setReason("");
                    }}
                  >
                    {TEAM_QUEUE_COPY.decline}
                  </Button>
                </>
              ) : null
            }
            below={
              isDeclining ? (
                <div className="space-y-1.5 pt-2">
                  <label htmlFor={`decline-${h.id}`} className="block text-sm font-medium">
                    {TEAM_QUEUE_COPY.declineLabel}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id={`decline-${h.id}`}
                      className="h-11 min-w-0 flex-1 sm:w-72"
                      placeholder={TEAM_QUEUE_COPY.declinePlaceholder}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <Button
                      className="min-h-11 px-5 font-bold"
                      variant={declineReasonOk(reason) ? "default" : "secondary"}
                      disabled={!declineReasonOk(reason) || busy !== null}
                      onClick={() => void decline(h)}
                    >
                      {TEAM_QUEUE_COPY.send}
                    </Button>
                  </div>
                </div>
              ) : null
            }
          />
        );
      })}
    </QueueGroup>
  );
}
