import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSupervisor(context: { supabase: { rpc: Function }; userId: string }) {
  const { data } = await (context.supabase as any).rpc("is_supervisor", {
    _user_id: context.userId,
  });
  if (!data) throw new Error("Only supervisors and platform owners can see email delivery.");
}

export const getEmailDelivery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSupervisor(context as never);
    const { data } = await context.supabase
      .from("email_log")
      .select(
        "id, recipient, subject, purpose, status, attempts, error_message, sent_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = data ?? [];
    return {
      rows,
      sent: rows.filter((r) => r.status === "sent").length,
      failed: rows.filter((r) => r.status === "failed").length,
      skipped: rows.filter((r) => r.status === "skipped").length,
    };
  });

export const resendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { logId: string }) => {
    if (!input?.logId) throw new Error("Pick a message to resend.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSupervisor(context as never);
    const { data: row } = await context.supabase
      .from("email_log")
      .select("recipient, subject, purpose")
      .eq("id", data.logId)
      .maybeSingle();
    if (!row) throw new Error("That message is no longer in the log.");

    const { sendEmail, emailShell } = await import("@/lib/email.server");
    const result = await sendEmail({
      to: row.recipient,
      subject: row.subject,
      html: emailShell(
        row.subject,
        "Resending this message — the first attempt did not go through. Open Resolve for the full details.",
        undefined,
        row.purpose === "owner_alert" ? "owner" : "staff",
      ),
      purpose: `${row.purpose}_resend`,
    });
    return result;
  });
