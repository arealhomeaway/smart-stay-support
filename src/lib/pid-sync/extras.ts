/**
 * "From the PID": PID fields with no place on the property page, shown read-only with their as-of
 * date so nothing in the PID is missing from Resolve. Formulas and buttons stay excluded as in the
 * Sep 1 mapping, and so does an empty photo field (it has nothing to show). Code fields never
 * appear here: they live only in Guest Access & Credentials.
 */
import { HOME_PROFILE_SECTIONS } from "@/lib/home-profile";
import { CREDENTIAL_FIELDS } from "./plan";

/** Shown elsewhere on the page: the home's name and address come from OwnerRez. */
const SHOWN_AS_ADDRESS = new Set(["Property", "City", "State", "Zip"]);
const NEVER_TYPES = new Set(["formula", "button"]);

const profileLabels = () => new Set(HOME_PROFILE_SECTIONS.flatMap((s) => s.items.map((i) => i.label.trim())));

/** PID fields (name → Notion type) that get a row in From the PID, in name order. */
export function pidExtraFields(fieldTypes: Record<string, string>): string[] {
  const labels = profileLabels();
  return Object.keys(fieldTypes)
    .filter((name) => {
      const n = name.trim();
      if (labels.has(n) || SHOWN_AS_ADDRESS.has(n) || CREDENTIAL_FIELDS.has(n)) return false;
      return !NEVER_TYPES.has(fieldTypes[name]!);
    })
    .sort((a, b) => a.localeCompare(b));
}

export type ExtraValue =
  | { type: "text"; text: string }
  | { type: "list"; items: string[] }
  | { type: "url"; url: string }
  | { type: "files"; count: number };

/**
 * One Notion property value for From the PID; null when blank (a blank never clears what is shown).
 * Linked records show their titles; photo fields show how many photos the PID holds.
 */
export function extraValue(v: any, titles: Map<string, string>): ExtraValue | null {
  if (!v || typeof v !== "object") return null;
  const t = v.type as string;
  const txt = (s: unknown) => {
    const x = s == null ? "" : String(s).trim();
    return x ? ({ type: "text", text: x.slice(0, 2000) } as const) : null;
  };
  switch (t) {
    case "title":
    case "rich_text":
      return txt((v[t] ?? []).map((r: any) => r.plain_text).join(""));
    case "number":
      return v.number == null ? null : txt(v.number);
    case "select":
    case "status":
      return txt(v[t]?.name);
    case "multi_select": {
      const items = (v.multi_select ?? []).map((s: any) => String(s.name)).filter(Boolean);
      return items.length ? { type: "list", items } : null;
    }
    case "checkbox":
      return { type: "text", text: v.checkbox ? "Yes" : "No" };
    case "date":
      return txt(v.date?.start ? String(v.date.start).slice(0, 10) + (v.date.end ? ` to ${String(v.date.end).slice(0, 10)}` : "") : null);
    case "url":
      return v.url && /^https?:\/\//i.test(v.url) ? { type: "url", url: v.url } : txt(v.url);
    case "email":
      return txt(v.email);
    case "phone_number":
      return txt(v.phone_number);
    case "place":
      return txt(v.place ? [v.place.name, v.place.address].filter(Boolean).join(", ") || (v.place.lat != null ? `${v.place.lat}, ${v.place.lon}` : null) : null);
    case "files": {
      const count = (v.files ?? []).length;
      return count ? { type: "files", count } : null;
    }
    case "relation": {
      const items = (v.relation ?? []).map((r: any) => titles.get(String(r.id).replace(/-/g, "")) ?? null).filter((x: string | null): x is string => !!x);
      return items.length ? { type: "list", items } : null;
    }
    case "rollup": {
      const r = v.rollup;
      if (!r) return null;
      if (r.type === "array") {
        const items = (r.array ?? []).flatMap((x: any) => {
          const one = extraValue(x, titles);
          return !one ? [] : one.type === "list" ? one.items : one.type === "text" ? [one.text] : one.type === "url" ? [one.url] : [];
        });
        return items.length ? { type: "list", items: [...new Set<string>(items)] } : null;
      }
      if (r.type === "number") return r.number == null ? null : txt(r.number);
      if (r.type === "date") return txt(r.date?.start ? String(r.date.start).slice(0, 10) : null);
      return null;
    }
    case "created_time":
    case "last_edited_time":
      return txt(v[t] ? String(v[t]).slice(0, 10) : null);
    case "created_by":
    case "last_edited_by":
    case "people":
      return null; // people stay out: the profile's own Added By / Last Edit By rows show the PID's
    default:
      return null;
  }
}

/** Plain text of an extra value, for the code safety check. */
export function extraText(v: ExtraValue): string {
  return v.type === "text" ? v.text : v.type === "list" ? v.items.join("\n") : v.type === "url" ? v.url : String(v.count);
}

/** Every linked record the extra fields point at (Notion page IDs, no dashes). */
export function relationIds(raw: Record<string, any>, fields: string[]): string[] {
  const out = new Set<string>();
  for (const f of fields) for (const r of raw[f]?.type === "relation" ? raw[f].relation ?? [] : []) out.add(String(r.id).replace(/-/g, ""));
  return [...out];
}
