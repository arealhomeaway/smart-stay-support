import { formatPropertyLabel } from "@/lib/property-label";
/**
 * Resolve Help & Feedback — reports about the Resolve application itself.
 * Never an Operations ticket: writes only to help_tickets, never to tickets/work items.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  kind: z.enum(["issue", "suggestion"]),
  description: z.string().trim().min(1).max(5000),
  portal: z.string().max(80),
  pageTitle: z.string().max(300),
  route: z.string().max(1000),
  origin: z.string().url().max(300),
  propertyId: z.string().uuid().nullable(),
  workItemId: z.string().max(100).nullable(),
  userAgent: z.string().max(500).nullable(),
  attachments: z.array(z.object({ path: z.string().max(500), name: z.string().max(300) })).max(5),
});

export const submitHelpTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Attachments must live in the submitter's own folder.
    for (const a of data.attachments) {
      if (!a.path.startsWith(`${userId}/`)) throw new Error("Invalid attachment.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: roleRows }, propRes, { data: setting }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      data.propertyId
        ? supabaseAdmin.from("properties").select("name, address_line1, nickname, unit, city, state, postal_code, ownerrez_property_id").eq("id", data.propertyId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from("app_settings").select("value").eq("key", "help_feedback_recipient").maybeSingle(),
    ]);
    const prop = propRes.data as { name: string | null; address_line1: string | null } | null;
    const propertyLabel = prop ? formatPropertyLabel(prop).primary : null;
    const roles = (roleRows ?? []).map((r) => r.role).join(", ") || "—";
    const email = (profile as { email?: string } | null)?.email ?? (context.claims as { email?: string })?.email ?? null;
    const name = (profile as { full_name?: string } | null)?.full_name ?? email ?? "Unknown user";

    const { data: row, error } = await supabase
      .from("help_tickets")
      .insert({
        submitted_by: userId,
        submitter_name: name,
        submitter_email: email,
        user_role: roles,
        portal: data.portal,
        property_id: prop ? data.propertyId : null,
        property_label: propertyLabel,
        page_title: data.pageTitle,
        route: data.route,
        kind: data.kind,
        description: data.description,
        attachments: data.attachments,
        work_item_id: data.workItemId,
        user_agent: data.userAgent,
      })
      .select("id, ticket_number, submitted_at")
      .single();
    if (error || !row) throw new Error("Could not save your feedback.");

    // Email notification (never blocks the saved ticket).
    try {
      const { sendEmail, emailShell, escapeHtml } = await import("./email.server");
      const recipient =
        ((setting?.value as { email?: string } | null)?.email ?? "info@arealhomeaway.com").trim();
      const kindLabel = data.kind === "issue" ? "Issue" : "Suggestion";
      const links = await Promise.all(
        data.attachments.map(async (a) => {
          const s = await supabaseAdmin.storage.from("help-feedback").createSignedUrl(a.path, 60 * 60 * 24 * 7);
          return s.data?.signedUrl ? `<a href="${escapeHtml(s.data.signedUrl)}">${escapeHtml(a.name)}</a>` : escapeHtml(a.name);
        }),
      );
      const when = new Date(row.submitted_at).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT";
      const lines: [string, string][] = [
        ["Submitted by", `${name}${email ? ` (${email})` : ""}`],
        ["Role", roles],
        ["Portal", data.portal],
        ["Property", propertyLabel ?? "—"],
        ["Page", data.pageTitle],
        ["Submitted", when],
        ["Type", kindLabel],
      ];
      const body =
        lines.map(([k, v]) => `<strong>${k}:</strong> ${escapeHtml(v)}`).join("<br/>") +
        `<br/><br/><strong>Feedback:</strong><br/>${escapeHtml(data.description).replace(/\n/g, "<br/>")}` +
        (links.length ? `<br/><br/><strong>Attachments (links valid 7 days):</strong><br/>${links.join("<br/>")}` : "");
      const subject = `Resolve Help Ticket #${row.ticket_number} — ${kindLabel} — ${data.pageTitle}`.slice(0, 280);
      const html = emailShell(subject, "__BODY__", { label: "Open the page in Resolve", url: escapeHtml(`${data.origin}${data.route}`) }).replace(
        escapeHtml("__BODY__"),
        body,
      );
      const res = await sendEmail({
        to: recipient,
        subject,
        html,
        purpose: "help_feedback",
        entity: { type: "help_ticket", id: row.id },
        bodyText: data.description,
        sentBy: userId,
      });
      await supabaseAdmin.from("help_tickets").update({ email_status: res.status }).eq("id", row.id);
    } catch (e) {
      console.error("Help ticket email failed", e);
    }
    return { ticketNumber: row.ticket_number };
  });
