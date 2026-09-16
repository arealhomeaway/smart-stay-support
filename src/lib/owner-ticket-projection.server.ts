import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CATEGORIES, STATUSES } from "./tickets";
import { readCountedRows } from "./read-all-rows";
import { ownerTicketRequest, type OwnerTicketRequest } from "./owner-ticket-authority";
import { ownerTicketCosts } from "./owner-ticket-costs";
import { reconcileTicketApproval } from "./owner-ticket-approval";

export type OwnerTicket = {
  costs?: ReturnType<typeof ownerTicketCosts>;
  owner_update_revision?: number | null;
  request: OwnerTicketRequest;
  id: string;
  ref: number;
  property_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  reported_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  owner_participation_path: string | null;
  owner_submitted: boolean | null;
};
type Ticket = Database["public"]["Functions"]["read_owner_tickets"]["Returns"][number];

/** Never spread a source Ticket or publish its unrestricted text fields. */
export function projectOwnerTicket(ticket: Ticket): OwnerTicket {
  const category = CATEGORIES.find((item) => item.value === ticket.category);
  return {
    request: ownerTicketRequest([]),
    id: ticket.id,
    ref: ticket.ref,
    property_id: ticket.property_id,
    title: `${category?.label ?? "Property work"} · Ticket #${ticket.ref}`,
    description: "Detailed owner-safe work information has not yet been published.",
    category: category?.value ?? "other",
    priority: ["p1", "p2", "p3"].includes(ticket.priority) ? ticket.priority : "unknown",
    status: STATUSES.some((item) => item.value === ticket.status) ? ticket.status : "unknown",
    reported_at: ticket.reported_at,
    resolved_at: ticket.resolved_at,
    resolution_notes: null,
    owner_participation_path: ["inform", "consult", "approve", "emergency"].includes(
      ticket.owner_participation_path ?? "",
    )
      ? ticket.owner_participation_path
      : null,
    owner_submitted: ticket.owner_submitted,
  };
}

/** Each RPC validates the current canonical Owner, enrollment, Property and demo mode. */
export async function loadOwnerTicketProjection(
  supabase: SupabaseClient<Database>,
  includedPropertyIds: string[],
  preview: boolean,
  programId: string,
) {
  const ids = [...new Set(includedPropertyIds)];
  const tickets: OwnerTicket[] = [];
  // Bound URL filters as well as result pages. Archived work remains part of history.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await readCountedRows(
      supabase
        .rpc(
          "read_owner_tickets",
          {
            _program_id: programId,
            _property_ids: ids.slice(offset, offset + 100),
            _preview: preview,
          },
          { count: "exact" },
        )
        .order("reported_at", { ascending: false })
        .order("id"),
    );
    const work = await readCountedRows(
      supabase
        .rpc(
          "read_owner_ticket_financial_context",
          {
            _program_id: programId,
            _property_ids: ids.slice(offset, offset + 100),
            _preview: preview,
          },
          { count: "exact" },
        )
        .order("id"),
    );
    const updates = await readCountedRows(
      supabase
        .rpc(
          "read_owner_ticket_updates",
          {
            _program_id: programId,
            _property_ids: ids.slice(offset, offset + 100),
            _preview: preview,
          },
          { count: "exact" },
        )
        .order("ticket_id"),
    );
    tickets.push(
      ...result.data.map((ticket) => ({
        ...projectOwnerTicket(ticket),
        ...projectReviewedTicketUpdate(
          updates.data.find(
            (update) => update.ticket_id === ticket.id && update.property_id === ticket.property_id,
          ),
        ),
        costs: ownerTicketCosts(
          work.data.filter(
            (order) => order.ticket_id === ticket.id && order.property_id === ticket.property_id,
          ),
        ),
        request: ownerTicketRequest(
          work.data
            .filter(
              (order) => order.ticket_id === ticket.id && order.property_id === ticket.property_id,
            )
            .map((order) =>
              reconcileTicketApproval(
                {
                  ...order,
                  phase:
                    order.phase === "mitigation" ? ("mitigation" as const) : ("permanent" as const),
                },
                order.receipt_id && order.receipt_status
                  ? [
                      {
                        id: order.receipt_id,
                        entity_type: "work_order",
                        entity_id: order.id,
                        property_id: order.property_id,
                        approver_role: "owner",
                        status: order.receipt_status,
                        amount: order.receipt_amount,
                        decided_at: order.receipt_decided_at,
                      },
                    ]
                  : [],
              ),
            ),
        ),
      })),
    );
  }
  return tickets.sort(
    (a, b) => b.reported_at.localeCompare(a.reported_at) || a.id.localeCompare(b.id),
  );
}

/** Only content explicitly reviewed for owner visibility enters this narrative. */
export function projectReviewedTicketUpdate(update?: {
  revision: number;
  issue: string;
  work_performed: string;
  outcome: string;
  reviewed_at: string;
}) {
  if (!update) return {};
  return {
    owner_update_revision: update.revision,
    description: `Reviewed update (${update.reviewed_at.slice(0, 10)}). Issue: ${update.issue}\nWork: ${update.work_performed}${update.outcome ? `\nOutcome: ${update.outcome}` : ""}`,
    resolution_notes: update.outcome || null,
  };
}
