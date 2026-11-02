/**
 * "Email work order to vendor": for accepted vendors Breezeway cannot reach.
 * Sends through the shared staff email path (safety guard + email_log), then
 * records one Work Order event. Never creates or calls a Breezeway task.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = { supabase: SupabaseClient; userId: string; claims?: { email?: string } };

async function loadFacts(ctx: Ctx, workOrderId: string) {
  const sb = ctx.supabase;
  const { data: staff } = await sb.rpc("is_staff", { _user_id: ctx.userId });
  if (!staff) throw new Error("Only the internal team can email vendors.");
  const { vendorEmailOffered, pickVendorEmail, buildVendorWorkOrderEmail, VENDOR_EMAIL_EVENT } = await import("./vendor-email");
  const { data: wo } = await sb
    .from("work_orders")
    .select("id, title, scope, property_id, ticket_id, scheduled_for, phase, is_demo")
    .eq("id", workOrderId)
    .maybeSingle();
  if (!wo) throw new Error("Work Order not found.");
  const { data: accepted } = await sb
    .from("work_order_vendor_candidates")
    .select("vendor_org_id, vendor_name, vendor_orgs:vendor_org_id (name, breezeway_person_id, work_order_email, primary_contact_email)")
    .eq("work_order_id", workOrderId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const vendor = (accepted?.vendor_orgs ?? null) as { name: string | null; breezeway_person_id: unknown; work_order_email: string | null; primary_contact_email: string | null } | null;
  let homeAllowed = true;
  try {
    const { assertPilotHome } = await import("./pilot-dispatch.server");
    if (wo.property_id) await assertPilotHome(wo.property_id);
  } catch {
    homeAllowed = false;
  }
  const offered = vendorEmailOffered({ hasAcceptedVendor: Boolean(accepted), vendorBreezewayPersonId: vendor?.breezeway_person_id, homeAllowedForBreezeway: homeAllowed });
  const { data: contacts } = accepted?.vendor_org_id
    ? await sb.from("vendor_contacts").select("email").eq("org_id", accepted.vendor_org_id)
    : { data: [] as { email: string | null }[] };
  const email = pickVendorEmail({ work_order_email: vendor?.work_order_email, primary_contact_email: vendor?.primary_contact_email, contacts: (contacts ?? []).map((c) => c.email) });
  const { data: home } = wo.property_id
    ? await sb.from("properties").select("formatted_address, address_line1, city, state").eq("id", wo.property_id).maybeSingle()
    : { data: null };
  const address = home?.formatted_address ?? ([home?.address_line1, home?.city, home?.state].filter(Boolean).join(", ") || null);
  const { data: ticket } = wo.ticket_id ? await sb.from("tickets").select("guest_name").eq("id", wo.ticket_id).maybeSingle() : { data: null };
  const { data: me } = await sb.from("profiles").select("full_name, email").eq("id", ctx.userId).maybeSingle();
  const { data: last } = await sb
    .from("work_order_events")
    .select("created_at")
    .eq("work_order_id", workOrderId)
    .eq("event_type", VENDOR_EMAIL_EVENT)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const draft = buildVendorWorkOrderEmail({
    vendorName: vendor?.name ?? accepted?.vendor_name ?? null,
    address,
    title: wo.title ?? "Work Order",
    scope: wo.scope ?? null,
    scheduledFor: wo.scheduled_for ?? null,
    timeWindow: null,
    photoLinks: [],
    senderName: me?.full_name ?? null,
  });
  return { wo, offered, email, draft, guestName: ticket?.guest_name ?? null, replyTo: me?.email ?? ctx.claims?.email ?? null, lastSentAt: last?.created_at ?? null };
}

export const prepareVendorWorkOrderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workOrderId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const f = await loadFacts(context as never as Ctx, data.workOrderId);
    return { offered: f.offered, email: f.email, subject: f.draft.subject, body: f.draft.body, lastSentAt: f.lastSentAt };
  });

export const sendVendorWorkOrderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ workOrderId: z.string().uuid(), subject: z.string().trim().min(3).max(200), body: z.string().trim().min(10).max(10000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as never as Ctx;
    const f = await loadFacts(ctx, data.workOrderId);
    const { vendorEmailProblems, NO_VENDOR_EMAIL, VENDOR_EMAIL_EVENT, VENDOR_EMAIL_PURPOSE } = await import("./vendor-email");
    if (!f.offered) throw new Error("This vendor is reached through Breezeway. Use Breezeway dispatch instead.");
    if (["closed", "cancelled"].includes(String(f.wo.phase ?? ""))) throw new Error("This Work Order is closed. Nothing was sent.");
    if (!f.email) throw new Error(NO_VENDOR_EMAIL);
    const problems = vendorEmailProblems(`${data.subject}\n${data.body}`, { guestNames: [f.guestName] });
    if (problems.length) throw new Error(problems.join(" "));
    const { sendEmail, emailShell } = await import("./email.server");
    const result = await sendEmail({
      to: f.email,
      subject: data.subject,
      html: emailShell(data.subject, data.body, undefined, "vendor" as never),
      bodyText: data.body,
      purpose: VENDOR_EMAIL_PURPOSE,
      entity: { type: "work_order", id: data.workOrderId },
      ...(f.replyTo ? { replyTo: f.replyTo } : {}),
      sentBy: ctx.userId,
    } as never);
    const status = (result as { status?: string }).status ?? "unknown";
    if (status !== "sent") return { ok: false as const, status, message: "The email was not sent. It is recorded in the email log." };
    const { error } = await ctx.supabase.from("work_order_events").insert({
      work_order_id: data.workOrderId,
      event_type: VENDOR_EMAIL_EVENT,
      author_id: ctx.userId,
      body: `Sent to vendor by email (${f.email}).`,
      is_demo: Boolean(f.wo.is_demo),
    } as never);
    if (error) return { ok: true as const, status, message: "Sent. The Work Order note could not be saved; the email log has the record." };
    return { ok: true as const, status, message: "Sent to vendor by email." };
  });
