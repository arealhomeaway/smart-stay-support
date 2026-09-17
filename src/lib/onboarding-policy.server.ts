import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readAuthorityPolicy } from "./maintenance-policy";
import { writeAudit } from "./audit.server";

type Client = SupabaseClient<Database>;
const KEY = "onboarding_authority_policy";

export async function loadOnboardingPolicySnapshot(supabase: Client) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  if (error) throw error;
  return { policy: readAuthorityPolicy(data?.value ?? null), storedValue: data?.value ?? null };
}

export async function loadOnboardingPolicy(supabase: Client) {
  return (await loadOnboardingPolicySnapshot(supabase)).policy;
}

export async function setOnboardingPolicy(
  supabase: Client,
  userId: string,
  input: {
    version: string;
    supervisorApprovalThreshold: number;
    ownerApprovalThreshold: number;
    reason: string;
  },
) {
  const admin = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (admin.error) throw admin.error;
  if (!admin.data)
    throw new Error("Only an administrator can record an approved authority policy.");
  if (input.reason.trim().length < 5)
    throw new Error("Record the approval reference for this policy change.");
  const policy = readAuthorityPolicy(input);
  const previous = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  if (previous.error) throw previous.error;
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: KEY, value: policy, updated_by: userId, updated_at: new Date().toISOString() });
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_authority_policy_set",
    entityType: "app_setting",
    entityId: KEY,
    entityLabel: policy.version,
    reason: input.reason.trim(),
    before: previous.data?.value ?? null,
    after: policy,
  });
  return policy;
}
