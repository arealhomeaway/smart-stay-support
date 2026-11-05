import { z } from "zod";

export const HELP_STATUSES = ["new", "reviewing", "planned", "in_progress", "resolved", "closed"] as const;
export const HELP_STATUS_LABEL: Record<string, string> = {
  new: "New", reviewing: "Reviewing", planned: "Planned", in_progress: "In Progress", resolved: "Resolved", closed: "Closed / Not Pursuing",
};
export const HELP_OPEN_STATUSES = ["new", "reviewing", "planned", "in_progress"];
export const HELP_BULK_NOTIFY_DEFAULT = false;
export const helpBulkSchema = z.object({
  batchId: z.string().uuid(),
  tickets: z.array(z.object({ id: z.string().uuid(), expectedUpdatedAt: z.string() })).min(1),
  status: z.enum(HELP_STATUSES), note: z.string().trim().max(5000), notify: z.boolean().default(false),
});
export type HelpBulkInput = z.infer<typeof helpBulkSchema>;
export type HelpBulkTicket = {
  id: string; ticket_number: number; submitted_by: string | null; submitter_email: string | null;
  description: string; status: string; event_id: string;
};
export type HelpBulkReceipt = { batchId: string; count: number; status: string; notify: boolean; note: string; tickets: HelpBulkTicket[] };
export function filterHelpTickets<T extends { status: string; kind: string; portal: string | null }>(rows: T[], filters: { status: string; kind: string; portal: string; q: string }) {
  return rows.filter((row) => {
    if (filters.status === "open" && !HELP_OPEN_STATUSES.includes(row.status)) return false;
    if (filters.status !== "open" && filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.kind !== "all" && row.kind !== filters.kind) return false;
    if (filters.portal !== "all" && row.portal !== filters.portal) return false;
    const r = row as T & { page_title?: string; route?: string; submitter_name?: string; submitter_email?: string; description?: string; property_label?: string };
    const hay = [r.page_title, r.route, r.submitter_name, r.submitter_email, r.description, r.property_label].join(" ").toLowerCase();
    return hay.includes(filters.q.trim().toLowerCase());
  });
}
export function toggleHelpSelection(selected: string[], ids: string[], checked: boolean) {
  return checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id));
}
export function groupHelpSubmitters(tickets: HelpBulkTicket[]) {
  const groups = new Map<string, HelpBulkTicket[]>();
  for (const ticket of tickets) {
    // Account identity wins over an old submission email. Never mix households/accounts.
    const key = ticket.submitted_by ?? ticket.submitter_email?.trim().toLowerCase() ?? ticket.id;
    groups.set(key, [...(groups.get(key) ?? []), ticket]);
  }
  return [...groups.values()];
}
export async function notifyHelpBulk(receipt: HelpBulkReceipt, deps: {
  claim: () => Promise<boolean>;
  recipient: (ticket: HelpBulkTicket) => Promise<string | null>;
  send: (tickets: HelpBulkTicket[], recipient: string | null) => Promise<string>;
  record: (eventIds: string[], recipient: string | null, status: string) => Promise<void>;
}) {
  if (!receipt.notify || !(await deps.claim())) return { sent: 0, failed: 0 };
  let sent = 0; let failed = 0;
  for (const tickets of groupHelpSubmitters(receipt.tickets)) {
    const first = tickets[0]; if (!first) continue;
    let recipient: string | null = null; let status = "failed";
    try { recipient = await deps.recipient(first); status = await deps.send(tickets, recipient); }
    catch { status = "failed"; }
    await deps.record(tickets.map((ticket) => ticket.event_id), recipient, status);
    if (status === "sent") sent++; else failed++;
  }
  return { sent, failed };
}