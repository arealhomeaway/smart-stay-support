/**
 * Codes and passwords from the PID go only to the protected credentials vault, as on Sep 1
 * (scripts/pid-credentials.ts): the nine code fields become encrypted Guest Access & Credentials
 * records (source notion_pid), and text elsewhere that may hold a code goes to the encrypted
 * intake list for review. Pure rules; encryption happens in run.server.ts.
 */
import type { CredentialCategory } from "@/lib/credentials.server";

export type CredentialFieldRule = {
  field: string;
  category: CredentialCategory;
  label: string;
  usernameField?: string;
  instructionsField?: string;
  /** Descriptive-heavy fields only count when a code-like token is present. */
  requireDigit: boolean;
};

/** The Sep 1 rules, unchanged. */
export const CREDENTIAL_FIELD_RULES: CredentialFieldRule[] = [
  { field: "WiFi Password", category: "wifi", label: "Guest WiFi", usernameField: "WiFi Network Name", requireDigit: false },
  { field: "Gate Code", category: "gate_community", label: "Gate / community code", requireDigit: true },
  { field: "Access Codes", category: "property_access", label: "Property access code", requireDigit: true },
  { field: "Alarm Code", category: "alarm_security", label: "Alarm code", requireDigit: true },
  { field: "Garage Keypad Code", category: "garage", label: "Garage keypad code", requireDigit: true },
  { field: "Garage Trim Lockbox Code", category: "lockbox", label: "Garage trim lockbox code", requireDigit: true },
  { field: "Closet Supply Box Code", category: "supply_storage", label: "Closet supply box code", instructionsField: "Closet Supply Box Location", requireDigit: true },
  { field: "Storage Closet/Cabinet Code", category: "supply_storage", label: "Storage closet / cabinet code", instructionsField: "Storage for Supplies", requireDigit: true },
  { field: "Neighborhood Pool Access Key/Fob", category: "property_access", label: "Neighborhood pool access", requireDigit: true },
];

const PLACEHOLDER =
  /^(n\/?a\.?|none\.?|no\.?|yes\.?|no code|none needed|not applicable|not listed|not mentioned|not provided|not specified|not available|unknown|tbd|todo|pending|null|-+|—+|\?+|x+)$/i;

export function isPlaceholder(s: string) {
  const t = s.trim();
  return !t || PLACEHOLDER.test(t) || !/[a-z0-9]/i.test(t);
}

export function looksLikeSecret(s: string, requireDigit: boolean) {
  if (isPlaceholder(s)) return false;
  return requireDigit ? /\d/.test(s) : true;
}

export type ExistingCredential = { id: string; source: string; active: boolean; updated_at: string; secret: string | null };
export type CredentialDecision =
  | { op: "skip"; reason: "blank" | "placeholder" | "not a code" }
  | { op: "same" }
  | { op: "insert" }
  | { op: "update"; id: string; expectedUpdatedAt: string }
  | { op: "kept"; reason: string };

/**
 * One code field on one home. A blank or placeholder never clears a code. A code saved or archived in
 * Resolve (source not notion_pid, or no longer active) is never overwritten.
 */
export function planCredential(raw: string | null, rule: CredentialFieldRule, existing: ExistingCredential[]): CredentialDecision {
  if (!raw || !raw.trim()) return { op: "skip", reason: "blank" };
  if (isPlaceholder(raw)) return { op: "skip", reason: "placeholder" };
  if (!looksLikeSecret(raw, rule.requireDigit)) return { op: "skip", reason: "not a code" };
  if (existing.length === 0) return { op: "insert" };
  if (existing.some((e) => e.secret === raw)) return { op: "same" };
  const ours = existing.find((e) => e.source === "notion_pid" && e.active);
  const resolveOwned = existing.some((e) => e.source !== "notion_pid" || !e.active);
  if (ours && !resolveOwned) return { op: "update", id: ours.id, expectedUpdatedAt: ours.updated_at };
  return { op: "kept", reason: "changed in Resolve; the code there is kept" };
}

/** Best guess for the intake list, by the PID field the text came from. */
export function intakeCategory(field: string): CredentialCategory {
  const f = field.toLowerCase();
  if (/wifi|internet|router/.test(f)) return "wifi";
  if (/hoa|gate|pool|amenit|community/.test(f)) return "gate_community";
  if (/garage/.test(f)) return "garage";
  if (/alarm|security|camera/.test(f)) return "alarm_security";
  if (/supply|storage|closet/.test(f)) return "supply_storage";
  if (/tv|stream|roku/.test(f)) return "streaming";
  if (/access|entry|door|lock/.test(f)) return "property_access";
  return "other";
}
