/**
 * The owner items on one home (Active Owner Opportunities, released program activities and
 * Operations owner records) as one list for the Owner tab. One mapping, shared by the Owner
 * tab list and the page's counts (Owner tab badge, Needs attention, Overview Owner card).
 */
import type { OwnerTabItem } from "@/lib/onboarding-cleanup";

type Opp = {
  id: string;
  title: string;
  status: string;
  sent_at: string | null;
  completed_at: string | null;
  source_department?: string | null;
  owner_content?: unknown;
  owner_response: { at?: string | null }[];
};
type Msg = { work_item_id: string | null; author_type: string; author_name?: string | null; created_at: string };
type File = { workItemId: string | null; uploadedAt?: string | null };
type Released = {
  id: string;
  title: string;
  status: string;
  notified_at: string | null;
  closed_at: string | null;
  responded_at: string | null;
  last_staff_at: string | null;
  owner_response?: unknown;
};
type OpsRecord = { id: string; ticketId: string | null; type: string; title: string; sentAt: string | null; answeredAt?: string | null; decidedAt?: string | null };

export function ownerTabItems(input: {
  opps: Opp[];
  messages: Msg[];
  files: File[];
  released: Released[];
  opsRecords: OpsRecord[];
  opsStatus: (r: OpsRecord) => string;
}): OwnerTabItem[] {
  const requests: OwnerTabItem[] = input.opps.map((o) => {
    const thread = input.messages.filter((m) => m.work_item_id === o.id);
    const files = input.files.filter((f) => f.workItemId === o.id);
    const ownerTimes = [
      ...o.owner_response.map((r) => r.at),
      ...thread.filter((m) => m.author_type === "homeowner").map((m) => m.created_at),
      ...files.map((f) => f.uploadedAt),
    ]
      .filter((x): x is string => Boolean(x))
      .sort();
    const staffTimes = thread.filter((m) => m.author_type === "staff").map((m) => m.created_at).sort();
    const latest = thread.filter((m) => m.author_type === "homeowner").slice(-1)[0];
    const c = (o.owner_content ?? null) as Record<string, unknown> | null;
    const fromOps = o.source_department === "operations";
    return {
      id: o.id,
      kind: "request",
      fromOperations: fromOps,
      ticketId: fromOps && typeof c?.["ticket_id"] === "string" ? (c["ticket_id"] as string) : null,
      typeLabel: fromOps ? (c?.["send_kind"] === "review" ? "For review" : "Owner task") : undefined,
      title: o.title,
      status: o.status,
      sentAt: o.sent_at,
      completedAt: o.completed_at,
      ownerAt: ownerTimes.at(-1) ?? null,
      staffAt: staffTimes.at(-1) ?? null,
      activity: latest ? `${latest.author_name} replied` : files.length ? "Homeowner uploaded a file" : "Homeowner responded",
    };
  });
  const reviews: OwnerTabItem[] = input.released.map((r) => ({
    id: r.id,
    kind: "review",
    title: r.title,
    status: r.status,
    sentAt: r.notified_at,
    completedAt: r.closed_at,
    ownerAt: r.responded_at,
    staffAt: r.last_staff_at,
    activity: r.owner_response ? "Homeowner replied" : "Homeowner responded",
  }));
  const ops: OwnerTabItem[] = input.opsRecords.map((r) => ({
    id: r.id,
    kind: "ops",
    fromOperations: true,
    ticketId: r.ticketId,
    typeLabel: r.type,
    title: r.type === "Ticket update" ? "Ticket update" : r.title,
    status: input.opsStatus(r),
    sentAt: r.sentAt,
    completedAt: r.type === "Ticket update" ? (r.answeredAt ?? null) : (r.decidedAt ?? null),
    ownerAt: null,
    staffAt: null,
    activity: "",
  }));
  return [...requests, ...reviews, ...ops];
}
