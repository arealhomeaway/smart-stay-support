/**
 * Email a Work Order to a vendor who is not reachable through Breezeway.
 * Pure: no I/O. The server action repeats every check before sending.
 */

/** Offered only when Breezeway cannot carry this Work Order to the accepted vendor. */
export function vendorEmailOffered(input: { hasAcceptedVendor: boolean; vendorBreezewayPersonId: unknown; homeAllowedForBreezeway: boolean }) {
  if (!input.hasAcceptedVendor) return false;
  const mapped = Number.isInteger(Number(input.vendorBreezewayPersonId)) && Number(input.vendorBreezewayPersonId) > 0;
  return !mapped || !input.homeAllowedForBreezeway;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Work Order inbox first, then the primary contact, then any contact on file. */
export function pickVendorEmail(v: { work_order_email?: string | null; primary_contact_email?: string | null; contacts?: (string | null)[] }) {
  for (const e of [v.work_order_email, v.primary_contact_email, ...(v.contacts ?? [])]) {
    const t = String(e ?? "").trim();
    if (EMAIL.test(t)) return t;
  }
  return null;
}

export const NO_VENDOR_EMAIL = "This vendor has no email on file. Add one on the vendor's page, or call them and record the visit here.";

function centralWhen(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) + " Central";
}

export type VendorEmailFacts = {
  vendorName: string | null;
  address: string | null;
  title: string;
  scope: string | null;
  scheduledFor: string | null;
  timeWindow: string | null;
  photoLinks: string[];
  senderName: string | null;
};

/**
 * The prefilled email. It only uses the facts passed in: no access codes, guest
 * names or owner money details are ever part of these facts.
 */
export function buildVendorWorkOrderEmail(f: VendorEmailFacts) {
  const when = centralWhen(f.scheduledFor);
  const lines = [
    `Hello${f.vendorName ? ` ${f.vendorName}` : ""},`,
    "",
    "A Real Home Away would like you to do the following work.",
    "",
    `Home: ${f.address ?? "Address to follow"}`,
    `Work: ${f.title}`,
  ];
  if (f.scope?.trim()) lines.push("", "Details:", f.scope.trim());
  lines.push("", `Requested date: ${when ?? "Please reply with your earliest available date and time."}`);
  if (f.timeWindow?.trim()) lines.push(`Time window: ${f.timeWindow.trim()}`);
  lines.push(
    "",
    "On site: please call ARHA before you arrive. We will give you access on the day. Reply to this email if you have questions.",
  );
  if (f.photoLinks.length) lines.push("", "Photos:", ...f.photoLinks);
  lines.push("", "Please reply to confirm you can do this work and when.", "", "Thank you,", f.senderName ?? "A Real Home Away");
  return { subject: `Work Order: ${f.title}${f.address ? ` at ${f.address}` : ""}`.slice(0, 200), body: lines.join("\n") };
}

const CODE_WORDS = /\b(door|lock|lockbox|gate|garage|keypad|alarm|access|entry|wifi|wi-fi)\s*(code|pin|password|combo|combination)\b[^\n]{0,20}\d{3,}/i;
const MONEY_WORDS = /\b(owner (statement|payout|revenue|income)|payout|net income|owner'?s? (balance|earnings))\b/i;

/** What must come out before this email can be sent to a vendor. */
export function vendorEmailProblems(text: string, ctx: { guestNames?: (string | null)[]; secrets?: (string | null)[] } = {}) {
  const problems: string[] = [];
  if (CODE_WORDS.test(text)) problems.push("Remove door, lock, gate or Wi-Fi codes. ARHA gives access on the day.");
  for (const s of ctx.secrets ?? []) {
    const v = String(s ?? "").trim();
    if (v.length >= 3 && text.includes(v)) { problems.push("Remove the home's access code or password."); break; }
  }
  for (const g of ctx.guestNames ?? []) {
    const v = String(g ?? "").trim();
    if (v.length >= 3 && text.toLowerCase().includes(v.toLowerCase())) { problems.push("Remove the guest's name."); break; }
  }
  if (MONEY_WORDS.test(text)) problems.push("Remove the owner's financial details.");
  return problems;
}

export const VENDOR_EMAIL_EVENT = "sent_to_vendor_email";
export const VENDOR_EMAIL_PURPOSE = "work_order_vendor_email";
