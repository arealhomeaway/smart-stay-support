/**
 * Active Owner welcome email wording (browser-safe, pure).
 *
 * The Onboarding Director edits the subject and body; Resolve fills the
 * placeholders. The optional video section appears only when a video is
 * configured. Every send stores the exact rendered text and template version.
 */

export const OWNER_WELCOME_KEY = "owner_welcome_template";

export type WelcomeReview = "draft" | "approved";

export type OwnerWelcomeTemplate = {
  subject: string;
  body: string;
  /** https link, or a file in the private welcome-media store. */
  video: { kind: "link"; url: string } | { kind: "upload"; path: string; name: string } | null;
  version: number;
  review: WelcomeReview;
};

export const WELCOME_PLACEHOLDERS = [
  "{{owner_first_name}}",
  "{{property_display_name}}",
  "{{portal_sign_in_link}}",
  "{{welcome_video_section}}",
] as const;

/** Emily Jimenez's draft (Oct 8, 2026). Proposed wording — not yet approved for sending. */
export const DEFAULT_WELCOME: OwnerWelcomeTemplate = {
  subject: "Welcome to the Active Owner program",
  body: `Hi {{owner_first_name}},

Welcome to the Active Owner program! Your Resolve portal is ready for {{property_display_name}}.

This is where you can review Opportunities from our team, share feedback and documents, and keep a record of your participation.

Open your portal: {{portal_sign_in_link}}

Sign in using the email address you provided to ARHA. If you haven't set a password yet, select Forgot password? on the sign-in page and follow the email instructions.

Once you're signed in:

Review the Opportunities available to you.

Record your participation with the activity date, time spent and a short description.

Identify the property involved, or choose General for participation that isn't tied to one home.

Record each activity once, even when it relates to more than one property.

{{welcome_video_section}}

Our team will continue coordinating onboarding and will use your Opportunities to keep you involved along the way. If you need help getting started, contact your onboarding Project Manager.

We're glad to be working with you!

The A Real Home Away Onboarding Team`,
  video: null,
  version: 1,
  review: "draft",
};

export function readWelcomeTemplate(raw: unknown): OwnerWelcomeTemplate {
  const r = (raw ?? {}) as Partial<OwnerWelcomeTemplate>;
  const subject = typeof r.subject === "string" && r.subject.trim() ? r.subject.trim().slice(0, 200) : DEFAULT_WELCOME.subject;
  const body = typeof r.body === "string" && r.body.trim() ? r.body.replace(/\r\n/g, "\n").slice(0, 20000) : DEFAULT_WELCOME.body;
  const v = r.video as OwnerWelcomeTemplate["video"];
  const video =
    v && v.kind === "link" && /^https:\/\//.test(v.url)
      ? { kind: "link" as const, url: v.url }
      : v && v.kind === "upload" && typeof v.path === "string" && v.path
        ? { kind: "upload" as const, path: v.path, name: String(v.name ?? "Welcome video") }
        : null;
  return {
    subject,
    body,
    video,
    version: Number.isInteger(r.version) && (r.version as number) > 0 ? (r.version as number) : 1,
    review: r.review === "approved" ? "approved" : "draft",
  };
}

function firstName(name: string | null | undefined) {
  const n = (name ?? "").trim();
  if (!n) return "there";
  const f = n.split(/\s+/)[0] ?? "";
  return f.length > 1 && /[a-z]/i.test(f) ? f : n;
}

export function propertyDisplayName(names: string[]) {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (!list.length) return "your home";
  if (list.length === 1) return list[0]!;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/** Final subject and body. With no video, the placeholder line disappears entirely. */
export function renderWelcome(
  tpl: Pick<OwnerWelcomeTemplate, "subject" | "body">,
  input: { ownerName: string | null; propertyNames: string[]; portalLink: string; videoLink: string | null },
) {
  const videoSection = input.videoLink ? `Watch a short welcome video: ${input.videoLink}` : "";
  const fill = (s: string) =>
    s
      .replaceAll("{{owner_first_name}}", firstName(input.ownerName))
      .replaceAll("{{property_display_name}}", propertyDisplayName(input.propertyNames))
      .replaceAll("{{portal_sign_in_link}}", input.portalLink)
      .replaceAll("{{welcome_video_section}}", videoSection);
  const body = fill(tpl.body)
    .split("\n")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject: fill(tpl.subject).trim(), body };
}

/** Unknown {{tokens}} are reported so a typo never ships to a homeowner. */
export function unknownPlaceholders(text: string) {
  const found = text.match(/\{\{[^}]+\}\}/g) ?? [];
  return [...new Set(found.filter((t) => !(WELCOME_PLACEHOLDERS as readonly string[]).includes(t)))];
}
