/**
 * Home, Needs you now (register T2): a row opens this side panel (from the right
 * on a wide screen, full screen on a phone) with what the item is, why it waits
 * on this person and its action, without leaving Home. Decisions go through the
 * paths they already use: the ticket's handoff Accept and Decline (HandoffPanel)
 * and the Work Order spending decision (recordWorkOrderSupervisorDecision).
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TaskWorkspace, PeekRow } from "@/components/ui/workspace";
import { HandoffPanel } from "@/components/HandoffPanel";
import { useCurrentUserId } from "@/hooks/useTeam";
import { formatPropertyLabel } from "@/lib/property-label";
import { relativeTime } from "@/lib/tickets";
import { recordWorkOrderSupervisorDecision } from "@/lib/work-order-supervisor-decision";
import { NEEDS_KIND_LABEL, NEEDS_PANEL_COPY, NEEDS_WHY, type NeedsKind } from "@/lib/home-needs";

export type NeedsPanelItem = {
  kind: NeedsKind;
  id: string;
  title: string;
  detail: string;
  ticketId?: string | null;
  approvalId?: string | null;
  bookingId?: string | null;
  /** The ticket fields the handoff Accept and Decline need. */
  ticket?: { id: string; priority: string; status: string; next_action: string | null; functional_role_code: string | null } | null;
};

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? null : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));

export function NeedsYouNowPanel({
  item,
  onClose,
  originSearch,
}: {
  item: NeedsPanelItem | null;
  onClose: () => void;
  originSearch: { from: string };
}) {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["home-my-work"] }),
      qc.invalidateQueries({ queryKey: ["home-my-approvals"] }),
    ]);
  };
  const openTicket = item?.ticketId ? (
    <Button asChild className="min-h-11" variant={item.kind === "handoff" ? "outline" : "default"}>
      <Link to="/tickets/$ticketId" params={{ ticketId: item.ticketId }} search={originSearch} onClick={onClose} data-panel-open-ticket>
        {NEEDS_PANEL_COPY.openTicket}
      </Link>
    </Button>
  ) : null;

  return (
    <TaskWorkspace
      open={Boolean(item)}
      onOpenChange={(o) => !o && onClose()}
      title={item?.title ?? ""}
      subtitle={item ? `${NEEDS_KIND_LABEL[item.kind]} · ${item.detail}` : ""}
      footer={
        item ? (
          <>
            <Button variant="outline" className="min-h-11" onClick={onClose} data-panel-close>
              Close
            </Button>
            {item.kind === "booking" && item.bookingId ? (
              <Button asChild className="min-h-11">
                <Link to="/direct-bookings/$requestId" params={{ requestId: item.bookingId }} onClick={onClose}>
                  {NEEDS_PANEL_COPY.openRequest}
                </Link>
              </Button>
            ) : (
              openTicket
            )}
          </>
        ) : null
      }
    >
      {item && (
        <div className="space-y-4" data-needs-panel={item.kind}>
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[15px]" data-panel-why>
            {NEEDS_WHY[item.kind]}
          </p>
          {item.kind === "handoff" && item.ticket && (
            <HandoffPanel ticket={item.ticket} closed onChanged={refresh} />
          )}
          {item.kind === "approval" && item.approvalId && <ApprovalBody approvalId={item.approvalId} onDecided={refresh} onClose={onClose} />}
        </div>
      )}
    </TaskWorkspace>
  );
}

function ApprovalBody({ approvalId, onDecided, onClose }: { approvalId: string; onDecided: () => Promise<void>; onClose: () => void }) {
  const userId = useCurrentUserId();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const q = useQuery({
    queryKey: ["home-approval-panel", approvalId],
    queryFn: async () => {
      const { data: a, error } = await supabase
        .from("approvals")
        .select("id, title, detail, kind, status, amount, entity_type, entity_id, approver_role, property_id, created_at, is_demo")
        .eq("id", approvalId)
        .single();
      if (error) throw error;
      const [home, wo] = await Promise.all([
        a.property_id
          ? supabase.from("properties").select("name, nickname, address_line1, unit, city, state, postal_code").eq("id", a.property_id).maybeSingle()
          : Promise.resolve({ data: null }),
        a.entity_type === "work_order" && a.entity_id
          ? supabase.from("work_orders").select("id, ticket_id, supervisor_approval_id, supervisor_approval_status, is_demo").eq("id", a.entity_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { a, home: home.data, wo: wo.data as { id: string; ticket_id: string | null; supervisor_approval_id: string | null; supervisor_approval_status: string | null; is_demo: boolean } | null };
    },
  });
  const authority = useQuery({
    queryKey: ["my-spending-approval-authority"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.rpc("my_spending_approval_authority")).data === true,
  });
  if (!q.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { a, home, wo } = q.data;
  const decidable = a.status === "pending" && a.approver_role === "supervisor" && wo && wo.supervisor_approval_status === "pending";

  const decide = async (outcome: "approved" | "declined") => {
    if (!wo) return;
    if (!note.trim()) {
      toast.error(NEEDS_PANEL_COPY.noteNeeded);
      return;
    }
    setSaving(true);
    try {
      await recordWorkOrderSupervisorDecision(supabase, { workOrder: wo, outcome, note, userId });
      toast.success(NEEDS_PANEL_COPY.decided);
      await onDecided();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-sm" data-approval-body>
      {a.detail ? <p className="whitespace-pre-wrap text-[15px]">{a.detail}</p> : null}
      <PeekRow label={NEEDS_PANEL_COPY.home} value={home ? formatPropertyLabel(home).full : "Not set"} />
      {money(a.amount as number | null) ? <PeekRow label={NEEDS_PANEL_COPY.amount} value={money(a.amount as number | null)!} /> : null}
      <PeekRow label={NEEDS_PANEL_COPY.asked} value={relativeTime(a.created_at)} />
      {a.status !== "pending" ? (
        <p className="text-muted-foreground">{NEEDS_PANEL_COPY.alreadyDecided}</p>
      ) : decidable && authority.data ? (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-muted-foreground">{NEEDS_PANEL_COPY.decisionNote}</span>
            <textarea
              rows={2}
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-approval-note
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="min-h-11" disabled={saving || !note.trim()} onClick={() => decide("approved")} data-approval-approve>
              {NEEDS_PANEL_COPY.approve}
            </Button>
            <Button variant="outline" className="min-h-11" disabled={saving || !note.trim()} onClick={() => decide("declined")}>
              {NEEDS_PANEL_COPY.decline}
            </Button>
          </div>
        </div>
      ) : decidable ? (
        <p className="text-muted-foreground">{NEEDS_PANEL_COPY.onlyLeaders}</p>
      ) : null}
      {wo?.ticket_id ? (
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/tickets/$ticketId" params={{ ticketId: wo.ticket_id }} onClick={onClose}>
            {NEEDS_PANEL_COPY.openWorkOrder}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
