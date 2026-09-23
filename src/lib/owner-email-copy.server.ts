/**
 * Storage for the homeowner email wording (server-only).
 *
 * Reading is onboarding staff so the settings screen can show it; changing it
 * is the onboarding director, and every change is audited like any other
 * template edit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { writeAudit } from "./audit.server";
import {
  OWNER_EMAIL_COPY_KEY,
  readOwnerEmailCopy,
  type OwnerEmailCopyConfig,
} from "./owner-email-copy";

type Client = SupabaseClient<Database>;

async function assertOnboardingStaff(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_onboarding_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("You do not have access to this action.");
}

async function assertSupervisor(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_supervisor", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only the onboarding director can change homeowner email wording.");
}

/** The wording currently in use. Falls back to the shipped defaults. */
export async function loadOwnerEmailCopy(supabase: Client): Promise<OwnerEmailCopyConfig> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", OWNER_EMAIL_COPY_KEY)
    .maybeSingle();
  if (error) throw error;
  return readOwnerEmailCopy(data?.value ?? null);
}

export async function readOwnerEmailCopySettings(supabase: Client, userId: string) {
  await assertOnboardingStaff(supabase, userId);
  return loadOwnerEmailCopy(supabase);
}

export async function saveOwnerEmailCopySettings(
  supabase: Client,
  userId: string,
  input: unknown,
): Promise<OwnerEmailCopyConfig> {
  await assertSupervisor(supabase, userId);
  const config = readOwnerEmailCopy(input);
  const previous = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", OWNER_EMAIL_COPY_KEY)
    .maybeSingle();
  if (previous.error) throw previous.error;

  const { error } = await supabase.from("app_settings").upsert({
    key: OWNER_EMAIL_COPY_KEY,
    value: config,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  await writeAudit({
    actorId: userId,
    actorLabel: "supervisor",
    action: "owner_email_copy_configured",
    entityType: "app_setting",
    entityId: OWNER_EMAIL_COPY_KEY,
    entityLabel: "Homeowner email wording",
    before: previous.data?.value ?? null,
    after: config,
  });
  return config;
}
