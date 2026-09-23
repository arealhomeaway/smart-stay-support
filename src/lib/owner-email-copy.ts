/**
 * Homeowner email wording the onboarding director controls.
 *
 * The facts in an alert are written by Resolve and never editable here. What
 * IS editable is the wrapper: the subject line, the greeting, the standing
 * sentence before the detail, the sign-off and the button label. Two sets:
 * one for work dispatched to an Active Owner, one for every other alert.
 *
 * Browser-safe: no server imports, so the settings screen and the sender both
 * use the exact same defaults and rendering.
 */

export type OwnerEmailVariant = "dispatch" | "alert";

export type OwnerEmailCopy = {
  subject: string;
  greeting: string;
  intro: string;
  closing: string;
  actionLabel: string;
};

export type OwnerEmailCopyConfig = Record<OwnerEmailVariant, OwnerEmailCopy>;

export const OWNER_EMAIL_COPY_KEY = "owner_email_copy";

export const OWNER_EMAIL_TOKENS = ["{title}", "{first_name}", "{owner_name}"] as const;

export const OWNER_EMAIL_VARIANT_LABELS: Record<OwnerEmailVariant, string> = {
  dispatch: "Active Owner task dispatch",
  alert: "Other homeowner notifications",
};

export const OWNER_EMAIL_VARIANT_HINTS: Record<OwnerEmailVariant, string> = {
  dispatch: "Sent when the team dispatches work or a participation opportunity to an Active Owner.",
  alert: "Sent for property work updates, approvals and other homeowner alerts.",
};

export const DEFAULT_OWNER_EMAIL_COPY: OwnerEmailCopyConfig = {
  dispatch: {
    subject: "{title}",
    greeting: "Hi {first_name},",
    intro:
      "Your onboarding team has sent something to your owner portal that needs your attention.",
    closing: "Thank you,\nThe A Real Home Away team",
    actionLabel: "Open your owner portal",
  },
  alert: {
    subject: "{title}",
    greeting: "Hi {first_name},",
    intro: "",
    closing: "Thank you,\nThe A Real Home Away team",
    actionLabel: "Open your owner portal",
  },
};

const LIMITS: Record<keyof OwnerEmailCopy, number> = {
  subject: 160,
  greeting: 160,
  intro: 600,
  closing: 400,
  actionLabel: 60,
};

function readField(
  source: Record<string, unknown> | null,
  field: keyof OwnerEmailCopy,
  fallback: string,
) {
  const raw = source?.[field];
  if (typeof raw !== "string") return fallback;
  const value = raw.replace(/\r\n/g, "\n").trim();
  if (field === "subject" || field === "actionLabel") {
    // A blank subject or button label would ship an unusable email.
    if (!value) return fallback;
  }
  return value.slice(0, LIMITS[field]);
}

/** Turns stored settings JSON into a complete, safe copy config. */
export function readOwnerEmailCopy(value: unknown): OwnerEmailCopyConfig {
  const root = (value ?? null) as Record<string, unknown> | null;
  const variant = (name: OwnerEmailVariant): OwnerEmailCopy => {
    const source = (root?.[name] ?? null) as Record<string, unknown> | null;
    const base = DEFAULT_OWNER_EMAIL_COPY[name];
    return {
      subject: readField(source, "subject", base.subject),
      greeting: readField(source, "greeting", base.greeting),
      intro: readField(source, "intro", base.intro),
      closing: readField(source, "closing", base.closing),
      actionLabel: readField(source, "actionLabel", base.actionLabel),
    };
  };
  return { dispatch: variant("dispatch"), alert: variant("alert") };
}

function firstName(ownerName: string | null | undefined) {
  const name = (ownerName ?? "").trim();
  if (!name) return "there";
  const first = name.split(/\s+/)[0] ?? "";
  // Entity names ("ABC Holdings LLC") read badly as a first name.
  return first.length > 1 && /[a-z]/i.test(first) ? first : name;
}

export function fillOwnerEmailTokens(
  text: string,
  values: { title: string; ownerName?: string | null },
) {
  return text
    .replaceAll("{title}", values.title)
    .replaceAll("{first_name}", firstName(values.ownerName))
    .replaceAll("{owner_name}", (values.ownerName ?? "").trim() || firstName(values.ownerName));
}

/** The final subject, body and button for one homeowner email. */
export function renderOwnerEmail(
  copy: OwnerEmailCopy,
  input: { title: string; body: string; ownerName?: string | null },
) {
  const fill = (text: string) => fillOwnerEmailTokens(text, input);
  const body = [fill(copy.greeting), fill(copy.intro), input.body, fill(copy.closing)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
  return {
    subject: fill(copy.subject).trim() || input.title,
    body,
    actionLabel: fill(copy.actionLabel).trim() || "Open your owner portal",
  };
}

/** Dispatched work reads differently from a status alert. */
export function ownerEmailVariantFor(kind: string): OwnerEmailVariant {
  return kind === "review_ready" || kind.startsWith("onboarding") || kind.startsWith("owner_task")
    ? "dispatch"
    : "alert";
}
