/**
 * Personal notification settings (browser-safe, data only).
 *
 * Every person decides which kinds of work reach their inbox and which stay in
 * Resolve. Nothing here silences an event: the in-app record is always written,
 * these settings only decide what is shown in the bell and what is emailed.
 */

export type NotificationCategory =
  | "assignments"
  | "approvals"
  | "escalations"
  | "handoffs"
  | "work_orders";

export type CategoryMeta = {
  key: NotificationCategory;
  label: string;
  description: string;
};

export const NOTIFICATION_CATEGORIES: CategoryMeta[] = [
  {
    key: "assignments",
    label: "Work assigned to me",
    description: "A ticket, task or visit is handed to you.",
  },
  {
    key: "approvals",
    label: "Approvals and decisions",
    description: "Something is waiting on your yes or no.",
  },
  {
    key: "escalations",
    label: "Escalations and overdue work",
    description: "A response clock has run out or work has been raised to you.",
  },
  {
    key: "handoffs",
    label: "Handoffs",
    description: "Work passed to you, accepted or sent back.",
  },
  {
    key: "work_orders",
    label: "Work Orders and closure checks",
    description: "Vendor work and the checks before a job is closed.",
  },
];

export type NotificationPreferences = {
  emailEnabled: boolean;
  email: Record<NotificationCategory, boolean>;
  inApp: Record<NotificationCategory, boolean>;
};

const ALL_ON: Record<NotificationCategory, boolean> = {
  assignments: true,
  approvals: true,
  escalations: true,
  handoffs: true,
  work_orders: true,
};

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  email: { ...ALL_ON },
  inApp: { ...ALL_ON },
};

/** The notification kinds the database writes, mapped onto a person's settings. */
export function categoryForKind(kind: string): NotificationCategory {
  if (kind.startsWith("handoff")) return "handoffs";
  if (kind.includes("approval")) return "approvals";
  if (kind.includes("escalat") || kind.includes("overdue") || kind.includes("breach"))
    return "escalations";
  if (kind.includes("work_order") || kind.includes("closure")) return "work_orders";
  return "assignments";
}

type PreferenceRow = Partial<Record<string, unknown>> | null | undefined;

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

/** Turns a stored row (or nothing at all) into a complete set of settings. */
export function readPreferences(row: PreferenceRow): NotificationPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES, email: { ...ALL_ON }, inApp: { ...ALL_ON } };
  const email = {} as Record<NotificationCategory, boolean>;
  const inApp = {} as Record<NotificationCategory, boolean>;
  for (const { key } of NOTIFICATION_CATEGORIES) {
    email[key] = bool(row[`email_${key}`], true);
    inApp[key] = bool(row[`inapp_${key}`], true);
  }
  return { emailEnabled: bool(row["email_enabled"], true), email, inApp };
}

/** The database shape for saving a person's settings. */
export function preferenceRow(prefs: NotificationPreferences) {
  const row: Record<string, boolean> = { email_enabled: prefs.emailEnabled };
  for (const { key } of NOTIFICATION_CATEGORIES) {
    row[`email_${key}`] = prefs.email[key];
    row[`inapp_${key}`] = prefs.inApp[key];
  }
  return row;
}

/** Whether a notification of this kind should be emailed to this person. */
export function allowsEmail(prefs: NotificationPreferences, kind: string) {
  if (!prefs.emailEnabled) return false;
  return prefs.email[categoryForKind(kind)] !== false;
}

/** Whether a notification of this kind should be shown in their bell. */
export function allowsInApp(prefs: NotificationPreferences, kind: string) {
  return prefs.inApp[categoryForKind(kind)] !== false;
}

/** Initials for a person's photo placeholder. */
export function personInitials(name: string | null | undefined, email?: string | null) {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0]?.replace(/[._-]+/g, " ") || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters =
    parts.length === 1
      ? (parts[0] ?? "").slice(0, 2)
      : `${(parts[0] ?? "").charAt(0)}${(parts[1] ?? "").charAt(0)}`;
  return letters.toUpperCase() || "?";
}
