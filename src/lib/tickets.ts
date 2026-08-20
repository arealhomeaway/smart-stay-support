export const CATEGORIES = [
  { value: "plumbing", label: "Plumbing / water" },
  { value: "safety", label: "Safety devices (smoke / CO / security)" },
  { value: "hvac", label: "Heating / cooling" },
  { value: "appliance", label: "Appliance" },
  { value: "access", label: "Access / lockout" },
  { value: "pest", label: "Pest" },
  { value: "electrical", label: "Electrical" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
] as const;

export const PRIORITIES = [
  { value: "emergency", label: "Emergency", hours: 1 },
  { value: "urgent", label: "Urgent", hours: 4 },
  { value: "normal", label: "Normal", hours: 24 },
  { value: "low", label: "Low", hours: 72 },
] as const;

export const STATUSES = [
  { value: "open", label: "Open" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_guest", label: "Awaiting guest confirmation" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

export const OPEN_STATUSES = ["open", "dispatched", "in_progress", "awaiting_guest"];

export function labelFor(
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return list.find((i) => i.value === value)?.label ?? value ?? "—";
}

export function priorityHours(priority: string) {
  return PRIORITIES.find((p) => p.value === priority)?.hours ?? 24;
}

export function statusTone(status: string) {
  switch (status) {
    case "open":
      return "bg-danger/10 text-danger border-danger/30";
    case "dispatched":
    case "in_progress":
      return "bg-info/10 text-info border-info/30";
    case "awaiting_guest":
      return "bg-warning/15 text-warning-foreground border-warning/40";
    case "resolved":
    case "closed":
      return "bg-success/10 text-success border-success/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function priorityTone(priority: string) {
  switch (priority) {
    case "emergency":
      return "bg-danger text-danger-foreground border-danger";
    case "urgent":
      return "bg-warning text-warning-foreground border-warning";
    case "low":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return mins <= 0 ? "just now" : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function dueLabel(dueAt: string | null | undefined, status: string) {
  if (!dueAt || status === "resolved" || status === "closed") return null;
  const diff = new Date(dueAt).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 0) return { text: `Overdue by ${Math.abs(mins) < 60 ? `${Math.abs(mins)}m` : `${Math.round(Math.abs(mins) / 60)}h`}`, overdue: true };
  return { text: `Due in ${mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`}`, overdue: false };
}
