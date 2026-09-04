/**
 * One approval, in one place.
 *
 * QA found approvals presented as a bare count: a supervisor could see that a
 * decision was waiting but not what home it belonged to, which ticket raised
 * it, what the amount was, or who decided it. Every approval in Resolve is the
 * same canonical record, so this reads that record and resolves the things it
 * points at — property, ticket, work order, requester, approver — into one
 * coherent view.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TaskWorkspace, PeekRow } from "@/components/ui/workspace";
import { Chip } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/tickets";

const KIND_LABEL: Record<string, string> = {
  estimate: "Repair estimate",
  spend: "Spending approval",
  vendor: "Vendor selection",
  scope: "Scope of work",
  access: "Property access",
  onboarding_task: "Onboarding item",
  other: "Decision",
};

const STATUS_TONE: Record<string, "active" | "done" | "blocked" | "waiting"> = {
  pending: "waiting",
  approved: "done",
  declined: "blocked",
  changes_requested: "blocked",
  cancelled: "blocked",
};

function money(amount: number | null, currency: string | null) {
  if (amount === null || amount === undefined) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(Number(amount));
  } catch {
    return `${currency ?? "USD"} ${amount}`;
  }
}

export function ApprovalDetail({
  approvalId,
  onClose,
}: {
  approvalId: string | null;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["approval-detail", approvalId],
    enabled: Boolean(approvalId),
    queryFn: async () => {
      const { data: approval, error } = await supabase
        .from("approvals")
        .select("*")
        .eq("id", approvalId!)
        .single();
      if (error) throw error;

      const [property, people, ticket, workOrder] = await Promise.all([
        approval.property_id
          ? supabase
              .from("properties")
              .select("id, name, nickname")
              .eq("id", approval.property_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", [approval.requested_by, approval.approver_id].filter(Boolean) as string[]),
        approval.entity_type === "ticket" && approval.entity_id
          ? supabase
              .from("tickets")
              .select("id, ref, title")
              .eq("id", approval.entity_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        approval.entity_type === "work_order" && approval.entity_id
          ? supabase
              .from("work_orders")
              .select("id, title, ticket_id, quote_amount")
              .eq("id", approval.entity_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const names = new Map(
        (people.data ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown"]),
      );
      return {
        approval,
        propertyName: property.data?.nickname ?? property.data?.name ?? null,
        ticket: ticket.data,
        workOrder: workOrder.data,
        requestedBy: approval.requested_by ? (names.get(approval.requested_by) ?? null) : null,
        approver: approval.approver_id ? (names.get(approval.approver_id) ?? null) : null,
      };
    },
  });

  const a = q.data?.approval;
  const linkedTicketId = q.data?.ticket?.id ?? q.data?.workOrder?.ticket_id ?? null;

  return (
    <TaskWorkspace
      open={Boolean(approvalId)}
      onOpenChange={(o: boolean) => {
        if (!o) onClose();
      }}
      title={a?.title ?? "Approval"}
      subtitle={a ? (KIND_LABEL[a.kind] ?? a.kind) : ""}
    >
      {q.isLoading || !a ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={stateChip(STATUS_TONE[a.status] ?? "active")}>
              {a.status === "pending" ? "Awaiting a decision" : a.status.replace(/_/g, " ")}
            </Chip>
            {a.is_demo ? <Chip>Demo record</Chip> : null}
          </div>

          {a.detail ? <p className="whitespace-pre-wrap">{a.detail}</p> : null}

          <PeekRow label="Home" value={q.data?.propertyName ?? "—"} />
          <PeekRow
            label="Amount"
            value={money(a.amount as number | null, a.currency) ?? "Not a spending decision"}
          />
          <PeekRow label="Requested by" value={q.data?.requestedBy ?? "—"} />
          <PeekRow label="Requested" value={relativeTime(a.created_at)} />
          <PeekRow
            label="Approver"
            value={q.data?.approver ?? (a.approver_role ? `${a.approver_role} seat` : "Unrouted")}
          />
          <PeekRow
            label="Decision"
            value={
              a.status === "pending"
                ? `Still open${a.due_on ? ` · due ${new Date(a.due_on).toLocaleDateString()}` : ""}`
                : `${a.status.replace(/_/g, " ")} ${relativeTime(a.decided_at)}`
            }
          />
          {a.decision_note ? <PeekRow label="Note" value={a.decision_note} /> : null}
          {q.data?.workOrder ? <PeekRow label="Work order" value={q.data.workOrder.title} /> : null}

          <OwnerReplies
            approvalId={a.id}
            pending={a.status === "pending" && a.approver_role === "owner"}
            onRecorded={() => void q.refetch()}
          />


          {linkedTicketId ? (
            <Link
              to="/tickets/$ticketId"
              params={{ ticketId: linkedTicketId }}
              onClick={onClose}
              className="inline-block font-medium text-primary hover:underline"
            >
              {q.data?.ticket
                ? `Open ticket #${q.data.ticket.ref} — ${q.data.ticket.title}`
                : "Open the ticket this came from"}
            </Link>
          ) : null}
        </div>
      )}
    </TaskWorkspace>
  );
}
