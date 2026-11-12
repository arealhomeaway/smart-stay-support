/**
 * Value rules for copying the Notion PID into Resolve. Copied unchanged from the Sep 1 importer
 * (scripts/pid-import.ts) so the nightly copy reads values exactly as the import and the Nov 12
 * dry run did. Pure: no network, no database.
 */

export type Json = Record<string, any>;

/** Notion property value to a plain value (Sep 1 rule). */
export function plain(v: any): any {
  if (!v) return null;
  switch (v.type) {
    case "title":
    case "rich_text":
      return v[v.type].map((t: any) => t.plain_text).join("").trim() || null;
    case "select":
      return v.select?.name ?? null;
    case "multi_select":
      return v.multi_select.length ? v.multi_select.map((s: any) => s.name) : null;
    case "number":
      return v.number ?? null;
    case "checkbox":
      return v.checkbox;
    case "date":
      return v.date?.start ?? null;
    case "url":
      return v.url ?? null;
    case "email":
      return v.email ?? null;
    case "phone_number":
      return v.phone_number ?? null;
    case "formula": {
      const f = v.formula;
      return f?.string ?? f?.number ?? f?.boolean ?? f?.date?.start ?? null;
    }
    case "rollup": {
      const r = v.rollup;
      if (r?.type === "array") {
        const parts = r.array.map((x: any) => plain(x)).filter(Boolean);
        return parts.length ? parts.join("; ") : null;
      }
      return r?.number ?? r?.date?.start ?? null;
    }
    default:
      return null;
  }
}

export function yesNo(v: any): boolean | string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["yes", "true", "y"].includes(s)) return true;
  if (["no", "false", "n"].includes(s)) return false;
  return String(v).trim() || null;
}

/** Sep 1 free-text safety net: a typed code is replaced before the value is planned. */
export const REDACTION_TEXT = "[removed: credentials are not stored in Resolve]";
const SECRET_PATTERN =
  /\b(passwords?|passcodes?|pass\s?code|pwd|wifi\s*pass\w*|login\s*(?:info\w*|details)?|credentials?|access\s*code|gate\s*code|alarm\s*code|keypad\s*code|lockbox\s*code|door\s*code|profile\s*code|pin)\b\s*(?:is|are|:|=|-)?\s*[^\s,;\n]{2,}/gi;

export function scrub(text: string): { text: string; redacted: number } {
  let redacted = 0;
  const out = text.replace(SECRET_PATTERN, (_m, label) => {
    redacted += 1;
    return `${label}: ${REDACTION_TEXT}`;
  });
  return { text: out, redacted };
}

/**
 * Nov 12 refresh safety net: the Sep 1 scrub misses some forms ("The Pool Code is: 42909", a password
 * typed after a removed login). Text that still looks like it holds a code is never copied.
 */
const SUSPECT = [
  /\b(codes?|pins?|passcodes?|passwords?|pwd|logins?|combo|combination|fob)\b[^\n]{0,25}?\d{3,}/i,
  /\[removed[^\]]*\]\s*[^\s\]]*(?=[^\s\]]*\d)(?=[^\s\]]*[A-Za-z])[^\s\]]{5,}/i,
  /(?<![\w@.])(?=\S*\d)(?=\S*[A-Za-z])(?=\S*[!#$%^&*?])[^\s@]{7,}(?![\w@])/,
];
const stripUrls = (t: string) => t.replace(/https?:\/\/\S+/g, " ");
export function suspect(v: unknown): boolean {
  if (v == null) return false;
  const t = stripUrls(typeof v === "string" ? v : JSON.stringify(v));
  return SUSPECT.some((r) => r.test(t));
}

export function toInt(v: any): number | null {
  const m = String(v).replace(/,/g, "").match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const pad = (n: string | number) => String(n).padStart(2, "0");
const lastDayOfMonth = (year: number, month: number) =>
  `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;

/** Free-text expiration copy; never guesses an ambiguous date (Sep 1 rule). */
export function parseExpiry(raw: string): { date: string; precision: "day" | "month" | "year" } | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { date: `${m[1]}-${pad(m[2]!)}-${pad(m[3]!)}`, precision: "day" };
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return { date: `${m[3]}-${pad(m[1]!)}-${pad(m[2]!)}`, precision: "day" };
  const mon = MONTHS.findIndex((x) => new RegExp(`\\b${x.slice(0, 3)}\\w*\\b`, "i").test(s));
  const yr = s.match(/\b(20\d{2})\b/);
  const day = s.replace(/\b20\d{2}\b/, "").match(/\b(\d{1,2})\b/);
  if (mon >= 0 && yr) {
    if (day && Number(day[1]) >= 1 && Number(day[1]) <= 31)
      return { date: `${yr[1]}-${pad(mon + 1)}-${pad(day[1]!)}`, precision: "day" };
    return { date: lastDayOfMonth(Number(yr[1]), mon + 1), precision: "month" };
  }
  m = s.match(/^(\d{1,2})[./-](\d{4})$/);
  if (m) return { date: lastDayOfMonth(Number(m[2]), Number(m[1])), precision: "month" };
  m = s.match(/^(\d{4})[./-](\d{1,2})$/);
  if (m) return { date: lastDayOfMonth(Number(m[1]), Number(m[2])), precision: "month" };
  m = s.match(/^(\d{1,2})\s+(20\d{2})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12)
    return { date: lastDayOfMonth(Number(m[2]), Number(m[1])), precision: "month" };
  m = s.match(/^(\d{1,2})[./-](\d{2})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12)
    return { date: lastDayOfMonth(2000 + Number(m[2]), Number(m[1])), precision: "month" };
  m = s.match(/^(19|20)(\d{2})$/);
  if (m) return { date: `${m[1]}${m[2]}-12-31`, precision: "year" };
  return null;
}

export function urlsIn(text: string): string[] {
  return [...new Set((text.match(/https?:\/\/[^\s)\]"']+/g) ?? []).map((u) => u.replace(/[.,;]+$/, "")))];
}

export function linkKindFor(url: string): { kind: string; staffOnly: boolean; canonical: boolean } {
  const h = url.toLowerCase();
  if (h.includes("ring.com") || h.includes("blink.com") || h.includes("alarm.com"))
    return { kind: "camera_portal", staffOnly: true, canonical: false };
  if (h.includes("sharepoint.com")) return { kind: "legacy_onedrive", staffOnly: true, canonical: false };
  if (h.includes("fillout.com")) return { kind: "fillout_form", staffOnly: true, canonical: false };
  if (h.includes("app.ownerrez.com") || h.includes("app.breezeway.io"))
    return { kind: "system", staffOnly: true, canonical: true };
  if (/drhorton|capitalhomes|homesbytaber|rwcwarranty/.test(h))
    return { kind: "builder", staffOnly: true, canonical: false };
  if (/hoa|southforklife|vintageokc|gozego/.test(h)) return { kind: "hoa", staffOnly: true, canonical: false };
  return { kind: "reference", staffOnly: true, canonical: false };
}

/** "properties.systems.smoke.brand (seeded, dated)" → ["systems","smoke","brand"] (Sep 1 rule). */
export function targetPath(target: string): string[] | null {
  const clean = target.replace(/\(.*?\)/g, "").trim();
  if (!clean.startsWith("properties.")) return null;
  return clean.slice("properties.".length).split(".").map((s) => s.trim()).filter(Boolean);
}

export const digits = (v: unknown) => (v == null ? null : String(v).replace(/[^0-9]/g, "") || null);
