/**
 * Pure helpers for turning an Outlook message into Resolve content.
 *
 * No Microsoft calls and no database access, so every rule here is unit
 * testable. Anything that cannot be derived confidently is left empty for a
 * coordinator to complete — parsing never blocks a record from being created.
 */

export type OutlookSource = {
  mailbox: string;
  messageId: string;
  internetMessageId: string | null;
  conversationId: string | null;
  subject: string;
  fromName: string | null;
  fromAddress: string | null;
  toRecipients: string[];
  receivedAt: string | null;
  webLink: string | null;
  hasAttachments: boolean;
  attachments: { name: string; contentType: string | null; size: number | null }[];
  trigger: "ticket" | "lead";
};

/** Strips HTML and the quoted reply history so only the new message remains. */
export function plainTextBody(raw: string, contentType?: string | null) {
  const text =
    (contentType ?? "").toLowerCase() === "html"
      ? raw
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
      : raw;
  return text
    .split(/\n-{3,}\s*Original Message|\nFrom: .*\nSent: /)[0]!
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);
}

const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "comcast.net",
  "proton.me",
  "protonmail.com",
]);

/** A US phone number written the way people write them in a signature. */
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/;

export function extractPhone(text: string): string | null {
  const match = PHONE_RE.exec(text.replace(/\u00a0/g, " "));
  if (!match) return null;
  return `(${match[1]}) ${match[2]}-${match[3]}`;
}

/** The organisation behind a sender address, when the domain actually says so. */
export function companyFromAddress(address: string | null | undefined): string | null {
  const domain = (address ?? "").split("@")[1]?.trim().toLowerCase();
  if (!domain || FREE_MAIL.has(domain)) return null;
  const label = domain.split(".").slice(0, -1).join(".") || domain;
  if (!label || label.length < 2) return null;
  return label
    .split(/[.-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Domains and wording we can classify with confidence. Anything else is left blank. */
const SOURCE_RULES: { source: string; test: RegExp }[] = [
  { source: "insurance", test: /(insurance|claims?|adjuster|alacrity|sedgwick|crawford|allstate|statefarm|state farm|usaa|farmers|travelers|alestate|cat team)/i },
  { source: "relocation", test: /(relocation|reloc|moving services|corporate move|sirva|cartus|graebel|aires)/i },
  { source: "corporate", test: /(corporate housing|per ?diem|crew housing|travel department|project team housing)/i },
  { source: "realtor", test: /(realtor|real estate|brokerage|keller ?williams|remax|re\/max|coldwell|compass\.com)/i },
  { source: "referral", test: /(referred by|referral|recommended us|your name came up)/i },
  { source: "website", test: /(website inquiry|contact form|submitted through|web inquiry|arealhomeaway\.com\/contact)/i },
];

/**
 * The lead source, only when the email says so plainly. An unclear source is
 * better left for the coordinator than guessed.
 */
export function guessLeadSource(input: { fromAddress?: string | null; subject?: string; body?: string }): string | null {
  const haystack = `${input.fromAddress ?? ""}\n${input.subject ?? ""}\n${(input.body ?? "").slice(0, 1500)}`;
  for (const rule of SOURCE_RULES) {
    if (rule.test.test(haystack)) return rule.source;
  }
  return null;
}

export type DerivedLead = {
  contact_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  requirements: string | null;
  notes: string | null;
};

/** Everything a Lead can safely inherit from the email that produced it. */
export function deriveLeadFromEmail(input: {
  subject: string;
  body: string;
  fromName?: string | null;
  fromAddress?: string | null;
}): DerivedLead {
  const address = input.fromAddress?.trim() || null;
  const name = (input.fromName ?? "").trim() || address?.split("@")[0]?.replace(/[._-]+/g, " ") || "Unknown contact";
  return {
    contact_name: name.slice(0, 120),
    email: address ? address.toLowerCase() : null,
    phone: extractPhone(input.body),
    company: companyFromAddress(address),
    source: guessLeadSource({ fromAddress: address, subject: input.subject, body: input.body }),
    requirements: input.body.trim().slice(0, 2000) || null,
    notes: `From Outlook: ${input.subject}`.slice(0, 500),
  };
}
