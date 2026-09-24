/**
 * Leadership responses to Resolve Help Tickets: status changes, replies to the
 * submitter, internal notes. Saves first, then emails once per saved action.
 * Never touches the original submission or the new-ticket Info inbox email.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const HELP_STATUSES = ["new", "reviewing", "planned", "in_progress", "resolved", "closed"] as const;
export const HELP_STATUS_LABEL: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  planned: "Planned",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed / Not Pursuing",
};

async function leadershipGuard(supabase: any, userId: string) {
  const [{ data: admin }, { data: director }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("is_director", { _user_id: userId }),
  ]);
  if (admin !== true && director !== true) throw new Error("Only leadership can manage help tickets.");
}

async function submitterEmail(ticket: { submitted_by: string | null; submitter_email: string | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (ticket.submitted_by) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(ticket.submitted_by);
    if (data?.user?.email) return data.user.email;
  }
  return ticket.submitter_email ?? null;
}

export const getHelpTicketRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await leadershipGuard(context.supabase, context.userId);
    const { data: t } = await context.supabase
      .from("help_tickets")
      .select("submitted_by, submitter_email")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!t) throw new Error("Ticket not found.");
    return { email: await submitterEmail(t) };
  });

const UpdateInput = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(HELP_STATUSES).nullable(),
  mode: z.enum(["reply", "note"]),
  message: z.string().trim().max(5000),
  origin: z.string().url().max(300),
});

export const updateHelpTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await leadershipGuard(supabase, userId);
    const { data: t, error: tErr } = await supabase.from("help_tickets").select("*").eq("id", data.ticketId).maybeSingle();
    if (tErr || !t) throw new Error("Ticket not found.");

    const statusChanged = data.status !== null && data.status !== t.status;
    const hasMessage = data.message.length > 0;
    if (!statusChanged && !hasMessage) throw new Error("Nothing to save.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
    const authorName = (me as any)?.full_name ?? (me as any)?.email ?? "ARHA leadership";
    const now = new Date().toISOString();

    // 1. Save status.
    if (statusChanged) {
      const { error } = await supabase
        .from("help_tickets")
        .update({ status: data.status!, updated_at: now, last_activity_at: now })
        .eq("id", t.id);
      if (error) throw new Error("Could not update status.");
    } else {
      await supabase.from("help_tickets").update({ last_activity_at: now }).eq("id", t.id);
    }

    // 2. Save history (append-only).
    const rows: any[] = [];
    if (statusChanged)
      rows.push({ ticket_id: t.id, kind: "status", from_status: t.status, to_status: data.status, author_id: userId, author_name: authorName });
    if (hasMessage)
      rows.push({ ticket_id: t.id, kind: data.mode, body: data.message, author_id: userId, author_name: authorName });
    const { data: saved, error: evErr } = await supabase.from("help_ticket_events").insert(rows).select("id, kind");
    if (evErr || !saved) throw new Error("Could not save ticket history.");

    // 3. One email per saved action, only for submitter-facing events.
    const publicReply = hasMessage && data.mode === "reply" ? data.message : null;
    if (!statusChanged && !publicReply) return { emailed: false, emailStatus: null };

    const emailEventIds = saved.filter((r) => r.kind === "status" || r.kind === "reply").map((r) => r.id);
    let emailStatus = "failed";
    let recipient: string | null = null;
    try {
      recipient = await submitterEmail(t);
      const { sendEmail, emailShell, emailText, escapeHtml } = await import("./email.server");
      const newStatus = HELP_STATUS_LABEL[(statusChanged ? data.status : t.status) as string] ?? t.status;
      const kindLabel = t.kind === "issue" ? "Issue" : "Suggestion";
      const reopened = statusChanged && ["resolved", "closed"].includes(t.status) && !["resolved", "closed"].includes(data.status!);
      const subject = publicReply
        ? `Resolve Help Ticket #${t.ticket_number} — Reply from ARHA${statusChanged ? ` (${newStatus})` : ""}`
        : reopened
          ? `Resolve Help Ticket #${t.ticket_number} — Reopened (${newStatus})`
          : `Resolve Help Ticket #${t.ticket_number} — Status updated to ${newStatus}`;
      const body = [
        `Ticket: #${t.ticket_number} (${kindLabel})`,
        t.property_label ? `Property: ${t.property_label}` : null,
        t.page_title ? `Page: ${t.page_title}` : null,
        `Status: ${newStatus}`,
        "",
        `Your feedback: ${t.description}`,
        publicReply ? `\n${authorName} replied:\n${publicReply}` : null,
      ]
        .filter((l) => l !== null)
        .join("\n");
      const action = t.route ? { label: "Open in Resolve", url: `${data.origin}${t.route}` } : undefined;
      const res = await sendEmail({
        to: recipient ?? "",
        subject,
        html: emailShell(subject, body, action ? { ...action, url: escapeHtml(action.url) } : undefined),
        text: emailText(subject, body, action),
        purpose: "help_ticket_response",
        entity: { type: "help_ticket", id: t.id },
        bodyText: body,
        sentBy: userId,
      } as any);
      emailStatus = res.status;
    } catch (e) {
      console.error("Help ticket response email failed", e);
    }
    // 4. Record delivery result.
    await supabaseAdmin
      .from("help_ticket_events")
      .update({ email_status: emailStatus, email_recipient: recipient })
      .in("id", emailEventIds);
    return { emailed: emailStatus === "sent", emailStatus };
  });
