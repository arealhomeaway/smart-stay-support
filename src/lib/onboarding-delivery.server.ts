import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { SendEmailResult } from "./email.server";

/** Keep an uncertain attempt claimed: a retry must never silently send it again. */
export async function guardedDelivery(input: {
  claim: () => Promise<void>;
  send: () => Promise<SendEmailResult>;
  releaseSkipped: () => Promise<void>;
  recordSent: () => Promise<void>;
  recordUncertain?: (providerAccepted: boolean) => Promise<void>;
}) {
  await input.claim();
  let result: SendEmailResult;
  try {
    result = await input.send();
  } catch {
    await input.recordUncertain?.(false);
    throw new Error("Delivery is uncertain. Verify the shared mailbox before retrying.");
  }
  if (result.status === "skipped") {
    await input.releaseSkipped();
    throw new Error(`Email was not attempted: ${result.error}`);
  }
  if (result.status !== "sent") {
    await input.recordUncertain?.(false);
    throw new Error(
      `Delivery is uncertain. Verify the shared mailbox before retrying. ${result.error}`,
    );
  }
  try {
    await input.recordSent();
  } catch {
    await input.recordUncertain?.(true);
    throw new Error(
      "Email was sent, but its record could not be updated. Verify delivery before retrying.",
    );
  }
  return result;
}

export function deliveryClaim(
  db: SupabaseClient<Database>,
  input: {
    table: "approvals" | "financial_requests";
    id: string;
    recipient: string;
    actor: string;
  },
) {
  const attemptId = crypto.randomUUID();
  const attempt = {
    id: attemptId,
    recipient: input.recipient,
    actor: input.actor,
    attemptedAt: new Date().toISOString(),
  };
  return {
    claim: async () => {
      const { data, error } = await db
        .from(input.table)
        .update({
          onboarding_delivery_attempt: { ...attempt, state: "sending" },
        })
        .eq("id", input.id)
        .eq("status", input.table === "approvals" ? "pending" : "invoiced")
        .is(input.table === "approvals" ? "owner_email_sent_at" : "accounting_sent_at", null)
        .is("onboarding_delivery_attempt", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "A delivery attempt already exists or the request changed. Refresh and verify delivery before retrying.",
        );
    },
    recordUncertain: async (providerAccepted: boolean) => {
      const { data, error } = await db
        .from(input.table)
        .update({
          onboarding_delivery_attempt: {
            ...attempt,
            state: providerAccepted ? "sent_unrecorded" : "uncertain",
            finishedAt: new Date().toISOString(),
          },
        })
        .eq("id", input.id)
        .eq("onboarding_delivery_attempt->>id", attemptId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Delivery requires reconciliation; the attempt record changed.");
    },
    releaseSkipped: async () => {
      const { data, error } = await db
        .from(input.table)
        .update({ onboarding_delivery_attempt: null })
        .eq("id", input.id)
        .eq("onboarding_delivery_attempt->>id", attemptId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "The skipped delivery attempt could not be released. Refresh before retrying.",
        );
    },
  };
}
