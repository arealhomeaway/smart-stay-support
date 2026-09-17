/** Stored work alerts may contain legacy internal Ticket text. Never republish it. */
export function ownerNotificationText(row: {
  kind: string;
  ticket_id: string | null;
  review_id: string | null;
  title: string;
  body: string;
}): { title: string; body: string } {
  const workAlert =
    row.ticket_id || row.review_id || row.kind.startsWith("ticket_") || row.kind === "review_ready";
  if (!workAlert) return { title: row.title, body: row.body };
  if (row.kind === "ticket_p1")
    return {
      title: "Urgent property work update",
      body: "An urgent matter was recorded for your property. Open your owner portal to review the owner-safe context and any action required.",
    };
  if (row.kind === "ticket_resolved")
    return {
      title: "Property work marked resolved",
      body: "A property matter was marked resolved. Open your owner portal to review its recorded status and available owner-safe outcome information.",
    };
  return {
    title: row.kind === "review_ready" ? "Participation opportunity ready" : "Property work update",
    body: "Open your owner portal to review this property work and whether an owner response is required. You may record time you actually spend participating.",
  };
}
