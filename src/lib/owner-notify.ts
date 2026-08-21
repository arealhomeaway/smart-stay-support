/**
 * Owner alerting model (browser-safe).
 *
 * Every alert lands in the owner's in-app inbox first — that surface is always
 * available and is the audit trail. Email and text are delivery attempts on top
 * of that record, so a failed send never loses the alert itself.
 */

export type OwnerAlertKind =
  | "ticket_opened"
  | "ticket_p1"
  | "ticket_resolved"
  | "review_ready"
  | "reminder";

export type DeliveryStatus = "pending" | "sent" | "skipped" | "failed" | "escalated";

export type OwnerAlert = {
  id: string;
  kind: OwnerAlertKind;
  priority: string;
  title: string;
  body: string;
  ticket_id: string | null;
  review_id: string | null;
  read_at: string | null;
  email_status: DeliveryStatus;
  sms_status: DeliveryStatus;
  created_at: string;
};

export const ALERT_LABELS: Record<OwnerAlertKind, { label: string; tone: string }> = {
  ticket_opened: { label: "New at your home", tone: "bg-primary/10 text-primary border-primary/20" },
  ticket_p1: { label: "Urgent", tone: "bg-destructive/10 text-destructive border-destructive/20" },
  ticket_resolved: {
    label: "Resolved",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  review_ready: { label: "Ready for you", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  reminder: { label: "Reminder", tone: "bg-muted text-muted-foreground border-border" },
};

export function alertLabel(kind: string) {
  return ALERT_LABELS[(kind as OwnerAlertKind) ?? "reminder"] ?? ALERT_LABELS.reminder;
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
