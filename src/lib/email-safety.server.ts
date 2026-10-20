/** Shared final boundary: all recipients and saved record context must pass. */
import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailSafetyContext = {
  to: string;
  toAdditional?: string[];
  cc?: string[];
  bcc?: string[];
  isDemo?: boolean;
  ticketId?: string | null;
  entity?: { type: string; id: string } | null;
  sentBy?: string | null;
};

export function isTestEmail(address: string) {
  const domain = address.trim().toLowerCase().split("@").at(-1) ?? "";
  return domain === "invalid" || domain.endsWith(".invalid") ||
    domain === "test" || domain.endsWith(".test") || domain.endsWith(".example") ||
    domain === "example.com";
}

export function localEmailBlock(input: EmailSafetyContext): string | null {
  if (input.isDemo) return "Demo record — external delivery blocked.";
  if ([input.to, ...(input.toAdditional ?? []), ...(input.cc ?? []), ...(input.bcc ?? [])].some(isTestEmail))
    return "Demo/test address — external delivery blocked.";
  return null;
}

export async function verifyEmailSafety(input: EmailSafetyContext, db?: SupabaseClient): Promise<string | null> {
  const blocked = localEmailBlock(input);
  if (blocked) return blocked;
  try {
    const client = db ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data, error } = await client.rpc("email_delivery_allowed" as never, {
      _recipients: [input.to, ...(input.toAdditional ?? []), ...(input.cc ?? []), ...(input.bcc ?? [])],
      _entity_type: input.entity?.type ?? null,
      _entity_id: input.entity?.id ?? null,
      _ticket_id: input.ticketId ?? null,
      _actor_id: input.sentBy ?? null,
    } as never);
    if (error || data !== true) return "Email safety verification refused or unavailable — external delivery blocked.";
    return null;
  } catch {
    return "Email safety verification unavailable — external delivery blocked.";
  }
}