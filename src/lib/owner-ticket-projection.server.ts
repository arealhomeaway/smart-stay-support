import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CATEGORIES, STATUSES } from "./tickets";
import { readCountedRows } from "./read-all-rows";
import { ownerTicketRequest, type OwnerTicketRequest } from "./owner-ticket-authority";

export type OwnerTicket = {
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
type Ticket = Pick<
  Database["public"]["Tables"]["tickets"]["Row"],
  | "id"
  | "ref"
  | "property_id"
  | "category"
  | "priority"
  | "status"
  | "reported_at"
  | "resolved_at"
  | "owner_participation_path"
  | "owner_submitted"
>;

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

/** Caller supplies validated, currently included program properties; caller RLS still applies. */
export async function loadOwnerTicketProjection(
  supabase: SupabaseClient<Database>,
  includedPropertyIds: string[],
  preview: boolean,
) {
  const ids = [...new Set(includedPropertyIds)];
  const tickets: OwnerTicket[] = [];
  // Bound URL filters as well as result pages. Archived work remains part of history.
  for (let offset = 0; offset < ids.length; offset += 100) {
    let query = supabase
      .from("tickets")
      .select(
        "id, ref, property_id, category, priority, status, reported_at, resolved_at, owner_participation_path, owner_submitted",
        { count: "exact" },
      )
      .in("property_id", ids.slice(offset, offset + 100));
    if (!preview) query = query.eq("is_demo", false);
    const result = await readCountedRows(
      query.order("reported_at", { ascending: false }).order("id"),
    );
    let workQuery = supabase
      .from("work_orders")
      .select(
        "id, ticket_id, property_id, phase, quote_amount, approved_amount, approval_status, contractual_exception, emergency_reason",
        { count: "exact" },
      )
      .in("property_id", ids.slice(offset, offset + 100));
    if (!preview) workQuery = workQuery.eq("is_demo", false);
    const work = await readCountedRows(workQuery.order("id"));
    tickets.push(
      ...result.data.map((ticket) => ({
        ...projectOwnerTicket(ticket),
        request: ownerTicketRequest(
          work.data
            .filter(
              (order) => order.ticket_id === ticket.id && order.property_id === ticket.property_id,
            )
            .map((order) => ({
              ...order,
              phase:
                order.phase === "mitigation" ? ("mitigation" as const) : ("permanent" as const),
            })),
        ),
      })),
    );
  }
  return tickets.sort(
    (a, b) => b.reported_at.localeCompare(a.reported_at) || a.id.localeCompare(b.id),
  );
}
