/**
 * Guest Access & Credentials — server-only.
 *
 * Secret values are encrypted with AES-256-GCM using a key that lives only in
 * the platform secret store. The ciphertext columns are granted to the service
 * role alone, so no browser session and no Data API query can read a value:
 * the only path to plaintext is `revealCredential` below, which re-checks the
 * caller and writes an audit row that never contains the secret.
 *
 * RBAC (ARHA role model, not a credential-specific one):
 *   read/reveal/copy  — every authenticated internal staff account
 *                       (admin, manager, tech/Staff, onboarding), any hour
 *   create/edit/verify — onboarding, manager/supervisor, admin
 *   owners and vendors — no access at all
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Viewer = { userId: string; roles: string[] };

const INTERNAL_ROLES = ["admin", "manager", "tech", "onboarding"];
const MANAGER_ROLES = ["admin", "manager", "onboarding"];

export function isInternalStaff(v: Viewer) {
  return v.roles.some((r) => INTERNAL_ROLES.includes(r));
}
export function canManageCredentials(v: Viewer) {
  return v.roles.some((r) => MANAGER_ROLES.includes(r));
}

export const DENY_READ = "Credentials are available to ARHA staff accounts only.";
export const DENY_WRITE = "Only Onboarding, Supervisors and Admins can add or edit credentials.";

export const CREDENTIAL_CATEGORIES = [
  "wifi",
  "gate_community",
  "property_access",
  "garage",
  "lockbox",
  "streaming",
  "supply_storage",
  "alarm_security",
  "other",
] as const;
export type CredentialCategory = (typeof CREDENTIAL_CATEGORIES)[number];

/** Display order is operational priority, not alphabetical. */
export const CATEGORY_ORDER: Record<CredentialCategory, number> = {
  wifi: 0,
  gate_community: 1,
  property_access: 2,
  garage: 3,
  streaming: 4,
  supply_storage: 5,
  alarm_security: 6,
  lockbox: 7,
  other: 8,
};

export const CATEGORY_LABEL: Record<CredentialCategory, string> = {
  wifi: "WiFi",
  gate_community: "Gate / community",
  property_access: "Property access",
  garage: "Garage",
  streaming: "Streaming",
  supply_storage: "Supply / storage",
  alarm_security: "Alarm / security",
  lockbox: "Lockbox",
  other: "Other",
};

export async function loadViewer(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Viewer> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return { userId, roles: (data ?? []).map((r) => r.role as string) };
}

/* ------------------------------------------------------------------ crypto */

async function keyMaterial() {
  const raw = process.env["CREDENTIAL_ENCRYPTION_KEY"];
  if (!raw) throw new Error("Credential storage is not configured.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toB64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plain: string) {
  const key = await keyMaterial();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    new TextEncoder().encode(plain),
  );
  return { ciphertext: toB64(new Uint8Array(buf)), nonce: toB64(nonce) };
}

export async function decryptSecret(ciphertext: string, nonce: string) {
  const key = await keyMaterial();
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(nonce) },
    key,
    fromB64(ciphertext),
  );
  return new TextDecoder().decode(buf);
}

/* -------------------------------------------------------------------- data */

export type CredentialRow = {
  id: string;
  category: CredentialCategory;
  categoryLabel: string;
  label: string;
  username: string | null;
  instructions: string | null;
  hasSecret: boolean;
  lastVerifiedOn: string | null;
  /** ok | stale (>180d) | overdue (>365d) | never */
  freshness: "ok" | "stale" | "overdue" | "never";
  source: string;
};

function freshnessOf(date: string | null): CredentialRow["freshness"] {
  if (!date) return "never";
  const days = (Date.now() - new Date(date).getTime()) / 86_400_000;
  if (days > 365) return "overdue";
  if (days > 180) return "stale";
  return "ok";
}

export async function listCredentials(viewer: Viewer, propertyId: string) {
  if (!isInternalStaff(viewer)) throw new Error(DENY_READ);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("property_credentials")
    .select(
      "id, category, label, username, instructions, last_verified_on, source, sort_order, secret_ciphertext",
    )
    .eq("property_id", propertyId)
    .eq("active", true);
  if (error) throw new Error("Credentials could not be loaded.");

  const rows: CredentialRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    category: r.category as CredentialCategory,
    categoryLabel: CATEGORY_LABEL[r.category as CredentialCategory] ?? "Other",
    label: r.label as string,
    username: (r.username as string | null) ?? null,
    instructions: (r.instructions as string | null) ?? null,
    hasSecret: Boolean(r.secret_ciphertext),
    lastVerifiedOn: (r.last_verified_on as string | null) ?? null,
    freshness: freshnessOf((r.last_verified_on as string | null) ?? null),
    source: (r.source as string) ?? "staff_entry",
  }));

  rows.sort(
    (a, b) =>
      CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || a.label.localeCompare(b.label),
  );

  let pendingIntake = 0;
  if (canManageCredentials(viewer)) {
    const { count } = await supabaseAdmin
      .from("credential_intake_queue")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "pending");
    pendingIntake = count ?? 0;
  }

  return { rows, canManage: canManageCredentials(viewer), pendingIntake };
}

/** The only path to plaintext. Audited; the audit row never holds the value. */
export async function revealCredential(
  viewer: Viewer,
  credentialId: string,
  action: "reveal" | "copy",
  userAgentHash?: string | null,
) {
  if (!isInternalStaff(viewer)) throw new Error(DENY_READ);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("property_credentials")
    .select("id, property_id, secret_ciphertext, secret_nonce, active")
    .eq("id", credentialId)
    .maybeSingle();
  if (error || !data || !data.active) throw new Error("That credential could not be found.");
  if (!data.secret_ciphertext || !data.secret_nonce) {
    throw new Error("No value has been recorded for this credential yet.");
  }

  let value: string;
  try {
    value = await decryptSecret(data.secret_ciphertext as string, data.secret_nonce as string);
  } catch {
    // Never echo ciphertext, key state or the failed value.
    throw new Error("This credential could not be unlocked. Ask an Admin to re-enter it.");
  }

  await supabaseAdmin.from("credential_access_log").insert({
    credential_id: data.id as string,
    property_id: data.property_id as string,
    user_id: viewer.userId,
    action,
    user_agent_hash: userAgentHash ?? null,
  });

  return { value };
}

export type CredentialInput = {
  id?: string;
  propertyId: string;
  category: CredentialCategory;
  label: string;
  username?: string | null;
  secret?: string | null;
  instructions?: string | null;
  lastVerifiedOn?: string | null;
};

export async function saveCredential(viewer: Viewer, input: CredentialInput) {
  if (!canManageCredentials(viewer)) throw new Error(DENY_WRITE);
  if (!input.label.trim()) throw new Error("A label is required.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const patch: Record<string, unknown> = {
    property_id: input.propertyId,
    category: input.category,
    label: input.label.trim(),
    username: input.username?.trim() || null,
    instructions: input.instructions?.trim() || null,
    last_verified_on: input.lastVerifiedOn || null,
  };

  if (input.secret && input.secret.length > 0) {
    const { ciphertext, nonce } = await encryptSecret(input.secret);
    patch["secret_ciphertext"] = ciphertext;
    patch["secret_nonce"] = nonce;
    patch["last_verified_on"] = input.lastVerifiedOn || new Date().toISOString().slice(0, 10);
    patch["verified_by"] = viewer.userId;
  }

  if (input.id) {
    const { error } = await supabaseAdmin
      .from("property_credentials")
      .update(patch)
      .eq("id", input.id);
    if (error) throw new Error("That credential could not be saved.");
    return { id: input.id };
  }

  patch["created_by"] = viewer.userId;
  patch["source"] = "staff_entry";
  const { data, error } = await supabaseAdmin
    .from("property_credentials")
    .insert(patch as any)
    .select("id")
    .single();
  if (error) throw new Error("That credential could not be saved.");
  return { id: data.id as string };
}

/** Confirms the recorded value is still correct, without changing it. */
export async function verifyCredential(viewer: Viewer, credentialId: string) {
  if (!canManageCredentials(viewer)) throw new Error(DENY_WRITE);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("property_credentials")
    .update({
      last_verified_on: new Date().toISOString().slice(0, 10),
      verified_by: viewer.userId,
    })
    .eq("id", credentialId);
  if (error) throw new Error("That credential could not be verified.");
  return { ok: true };
}

export async function archiveCredential(viewer: Viewer, credentialId: string) {
  if (!canManageCredentials(viewer)) throw new Error(DENY_WRITE);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("property_credentials")
    .update({ active: false })
    .eq("id", credentialId);
  if (error) throw new Error("That credential could not be removed.");
  return { ok: true };
}
