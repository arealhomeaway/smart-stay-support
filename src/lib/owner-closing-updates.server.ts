/**
 * Owner updates after closing (Nov 22): reads each home's facts, keeps its three updates in line with
 * the Resolve Closing Date, sends the Project Manager preview the business day before, and sends each
 * update at 9:00 AM home time. Active Owners get it in the portal and by email (primary login only);
 * other owners by email. Every email goes from the shared mailbox with the Project Manager as Reply-To and on Cc. While the test inbox setting is on,
 * every update goes only to that inbox. Quiet until docs/pending/owner-closing-updates is applied.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatPropertyLabel } from "@/lib/property-label";
import { testInbox } from "@/lib/onboarding-daily-reminder";
import {
  UPDATE_NUMBERS,
  homeTimeZone,
  localNow,
  ownerFirstNames,
  ownerNickname,
  plannedSends,
  previewDue,
  reconcileHome,
  renderUpdate,
  resolveClosingDate,
  sendDecision,
  stopReason,
  updateDelivery,
  type HomeFacts,
  type StoredUpdate,
  type UpdateNo,
  type UpdateStatus,
} from "@/lib/owner-closing-updates";

type Db = SupabaseClient<Database>;
type Loose = { from: (t: string) => any; rpc: (fn: string, args?: unknown) => any };
const loose = (db: Db) => db as unknown as Loose;
const APP_URL = "https://smart-stay-support.lovable.app";

function missing(e: { code?: string; message?: string } | null | undefined) {
  return Boolean(e && (e.code === "42P01" || e.code === "42703" || e.code === "PGRST205" || /does not exist|could not find/i.test(e.message ?? "")));
}

export type HomeUpdateContext = {
  propertyId: string;
  isDemo: boolean;
  address: string;
  nickname: string;
  facts: HomeFacts;
  stop: string | null;
  startedAt: string | null;
  ownerFirstNames: string;
  ownerEmails: string[];
  pm: { id: string; name: string; email: string | null } | null;
  program: { id: string; ownerUserId: string; ownerEmail: string | null } | null;
  /** Portal (Active Owners) and the email addresses this update goes to. */
  delivery: { portal: boolean; emails: string[] };
};

export type StoredRow = StoredUpdate & {
  timeZone: string;
  editedSubject: string | null;
  editedBody: string | null;
  editedBy: string | null;
  editedAt: string | null;
  heldBy: string | null;
  heldAt: string | null;
  previewNotifiedAt: string | null;
  channel: "portal" | "email" | null;
  sentSubject: string | null;
  sentBody: string | null;
  sentTo: string[] | null;
  sentAt: string | null;
};

function toStored(r: Record<string, any>): StoredRow {
  return {
    id: r["id"], no: r["update_no"] as UpdateNo, status: r["status"] as UpdateStatus, closingOn: r["closing_on"], sendOn: r["send_on"],
    sendAt: new Date(r["send_at"]).toISOString(), reason: r["status_reason"] ?? null, timeZone: r["time_zone"],
    editedSubject: r["edited_subject"] ?? null, editedBody: r["edited_body"] ?? null, editedBy: r["edited_by"] ?? null, editedAt: r["edited_at"] ?? null,
    heldBy: r["held_by"] ?? null, heldAt: r["held_at"] ?? null, previewNotifiedAt: r["preview_notified_at"] ?? null,
    channel: r["channel"] ?? null, sentSubject: r["sent_subject"] ?? null, sentBody: r["sent_body"] ?? null, sentTo: r["sent_to"] ?? null, sentAt: r["sent_at"] ?? null,
  };
}

/** The extra business holidays saved in Resolve (ao_business_holidays), added to the federal ones. */
async function savedHolidays(db: Db): Promise<string[]> {
  const r = await loose(db).from("ao_business_holidays").select("day").limit(500);
  return ((r.data ?? []) as { day: string }[]).map((h) => h.day);
}

/** The owner update test inbox, else the onboarding test inbox; null means real sends. */
export async function ownerUpdateTestInbox(db: Db): Promise<{ email: string | null; staged: boolean }> {
  const r = await loose(db).from("app_settings").select("key, value").in("key", ["owner_update_test_inbox", "onboarding_email_test_inbox"]);
  const rows = (r.data ?? []) as { key: string; value: unknown }[];
  const own = rows.find((x) => x.key === "owner_update_test_inbox");
  const fallback = rows.find((x) => x.key === "onboarding_email_test_inbox");
  return { email: testInbox(own?.value) ?? testInbox(fallback?.value), staged: !!own };
}

/** The facts every update needs, for one home or every onboarding home. Read with the given client. */
export async function loadHomeContexts(db: Db, propertyIds?: string[]): Promise<HomeUpdateContext[]> {
  const sb = loose(db);
  let q = sb.from("onboarding_projects")
    .select("property_id, project_manager, status, project_status, planned_closing_on, is_demo, created_at, properties!inner(id, nickname, name, address_line1, unit, city, state, postal_code, time_zone, actual_closing_on, planned_closing_on, lifecycle_status, is_demo, owner_record_id)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (propertyIds) q = q.in("property_id", propertyIds);
  const projects = await q;
  if (projects.error) throw new Error(projects.error.message);
  // One project per home: the newest one not cancelled.
  const seen = new Set<string>();
  const rows = ((projects.data ?? []) as any[]).filter((p) => !seen.has(p.property_id) && seen.add(p.property_id));
  if (!rows.length) return [];
  const homeIds = rows.map((p) => p.property_id as string);
  const ownerIds = [...new Set(rows.map((p) => p.properties?.owner_record_id).filter(Boolean))] as string[];
  const pmIds = [...new Set(rows.map((p) => p.project_manager).filter(Boolean))] as string[];
  const [owners, pms, links] = await Promise.all([
    ownerIds.length ? sb.from("property_owners").select("id, name, email, co_owner_name, co_owner_email").in("id", ownerIds) : { data: [] },
    pmIds.length ? sb.from("profiles").select("id, full_name, email").in("id", pmIds) : { data: [] },
    sb.from("owner_program_properties").select("program_id, property_id").in("property_id", homeIds).is("archived_at", null),
  ]);
  const programIds = [...new Set(((links.data ?? []) as { program_id: string }[]).map((l) => l.program_id))];
  const [programs, members] = await Promise.all([
    programIds.length ? sb.from("owner_programs").select("id, owner_user_id, status").in("id", programIds) : { data: [] },
    programIds.length ? sb.from("program_members").select("program_id, user_id").in("program_id", programIds).is("removed_at", null) : { data: [] },
  ]);
  const memberIds = [...new Set([
    ...((programs.data ?? []) as { owner_user_id: string | null }[]).map((p) => p.owner_user_id),
    ...((members.data ?? []) as { user_id: string }[]).map((m) => m.user_id),
  ].filter(Boolean))] as string[];
  const memberProfiles = memberIds.length ? await sb.from("profiles").select("id, full_name, email").in("id", memberIds) : { data: [] };
  const nameOf = new Map(((memberProfiles.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name?.trim() ?? ""]));
  const emailOf = new Map(((memberProfiles.data ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email ?? null]));
  const ownerById = new Map(((owners.data ?? []) as any[]).map((o) => [o.id, o]));
  const pmById = new Map(((pms.data ?? []) as any[]).map((p) => [p.id, p]));
  const progById = new Map(((programs.data ?? []) as any[]).map((p) => [p.id, p]));

  return rows.map((p) => {
    const h = p.properties;
    const owner = h.owner_record_id ? ownerById.get(h.owner_record_id) : null;
    const homeLinks = ((links.data ?? []) as { program_id: string; property_id: string }[]).filter((l) => l.property_id === p.property_id);
    const active = homeLinks.map((l) => progById.get(l.program_id)).find((g) => g && g.status === "active" && g.owner_user_id) ?? null;
    const people: string[] = [];
    for (const l of homeLinks) {
      const g = progById.get(l.program_id);
      if (!g || g.status === "archived") continue;
      if (g.owner_user_id && nameOf.get(g.owner_user_id)) people.push(nameOf.get(g.owner_user_id)!);
      for (const m of (members.data ?? []) as { program_id: string; user_id: string }[]) if (m.program_id === g.id && nameOf.get(m.user_id)) people.push(nameOf.get(m.user_id)!);
    }
    if (owner?.co_owner_name?.trim()) people.push(owner.co_owner_name.trim());
    const facts: HomeFacts = {
      closingOn: resolveClosingDate(h.actual_closing_on, h.planned_closing_on, p.planned_closing_on),
      timeZone: homeTimeZone(h.time_zone, h.state),
      lifecycleStatus: h.lifecycle_status ?? null,
      projectStatus: p.status ?? null,
      notionStatus: p.project_status ?? null,
    };
    const address = formatPropertyLabel(h).primary;
    const pm = p.project_manager ? pmById.get(p.project_manager) : null;
    const ownerEmails = [owner?.email, owner?.co_owner_email].map((e: string | null | undefined) => e?.trim()).filter((e): e is string => !!e && /@/.test(e));
    const program = active ? { id: active.id as string, ownerUserId: active.owner_user_id as string, ownerEmail: emailOf.get(active.owner_user_id) ?? null } : null;
    return {
      propertyId: p.property_id,
      isDemo: Boolean(p.is_demo || h.is_demo),
      address,
      nickname: ownerNickname(h.nickname, address),
      facts,
      stop: stopReason(facts),
      startedAt: p.created_at ?? null,
      ownerFirstNames: ownerFirstNames(people, owner?.name ?? null),
      ownerEmails,
      pm: pm ? { id: pm.id, name: pm.full_name?.trim() || "Your Project Manager", email: pm.email ?? null } : null,
      program,
      delivery: updateDelivery({ activeOwner: !!program, primaryLoginEmail: program?.ownerEmail ?? null, ownerEmails }),
    };
  });
}

/** The subject and message that would go out now: the Project Manager's edit, else the template. */
export function messageFor(ctx: HomeUpdateContext, no: UpdateNo, row?: Pick<StoredRow, "editedSubject" | "editedBody"> | null) {
  const t = renderUpdate(no, { address: ctx.address, nickname: ctx.nickname, ownerFirstNames: ctx.ownerFirstNames, projectManager: ctx.pm?.name ?? "Your Project Manager" });
  return { subject: row?.editedSubject ?? t.subject, body: row?.editedBody ?? t.body, edited: !!(row?.editedSubject || row?.editedBody) };
}

/** What the Owner tab shows: the three updates, planned or stored, with their message. */
export async function readHomeUpdates(sb: Db, propertyId: string, now: Date = new Date()) {
  const [ctx] = await loadHomeContexts(sb, [propertyId]);
  if (!ctx) return null;
  const stored = await loose(sb).from("owner_closing_updates").select("*").eq("property_id", propertyId);
  const staged = !missing(stored.error);
  const rows = staged ? ((stored.data ?? []) as any[]).map(toStored) : [];
  const holidays = await savedHolidays(sb);
  const today = localNow(now, ctx.facts.timeZone).date;
  const plan = ctx.facts.closingOn ? plannedSends(ctx.facts.closingOn, ctx.facts.timeZone, holidays) : [];
  const ids = [...new Set(rows.flatMap((r) => [r.editedBy, r.heldBy]).filter(Boolean))] as string[];
  const who = ids.length ? await loose(sb).from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nameOf = new Map(((who.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "A teammate"]));
  const items = UPDATE_NUMBERS.map((no) => {
    const row = rows.find((r) => r.no === no) ?? null;
    const p = plan.find((x) => x.no === no) ?? null;
    const sendOn = row && !["scheduled", "stopped"].includes(row.status) ? row.sendOn : p?.sendOn ?? row?.sendOn ?? null;
    const sendAt = row && !["scheduled", "stopped"].includes(row.status) ? row.sendAt : p?.sendAt ?? row?.sendAt ?? null;
    const msg = row?.sentSubject ? { subject: row.sentSubject, body: row.sentBody ?? "", edited: !!row.editedBody } : messageFor(ctx, no, row);
    let status: UpdateStatus | "planned" | "not_scheduled" = row?.status ?? "planned";
    let reason = row?.reason ?? null;
    if (!row) {
      if (ctx.stop) { status = "stopped"; reason = ctx.stop; }
      else if (!sendOn) { status = "not_scheduled"; reason = "No closing date."; }
      else if (sendOn < today) { status = "not_scheduled"; reason = "This date passed before it could be scheduled. It is not sent late."; }
    }
    return {
      no, id: row?.id ?? null, status, reason, sendOn, sendAt, previewOn: p?.previewOn ?? null,
      subject: msg.subject, body: msg.body, edited: msg.edited,
      editedBy: row?.editedBy ? nameOf.get(row.editedBy) ?? "A teammate" : null, editedAt: row?.editedAt ?? null,
      heldBy: row?.heldBy ? nameOf.get(row.heldBy) ?? "A teammate" : null, heldAt: row?.heldAt ?? null,
      sentAt: row?.sentAt ?? null, channel: row?.channel ?? null, sentTo: row?.sentTo ?? null,
    };
  });
  const inbox = await ownerUpdateTestInbox(sb);
  return {
    staged,
    testing: !!inbox.email,
    closingOn: ctx.facts.closingOn,
    timeZone: ctx.facts.timeZone,
    stop: ctx.stop,
    channel: ctx.program ? ("portal" as const) : ("email" as const),
    portal: ctx.delivery.portal,
    to: ctx.delivery.emails,
    projectManager: ctx.pm ? { name: ctx.pm.name, email: ctx.pm.email } : null,
    ownerFirstNames: ctx.ownerFirstNames,
    startedAt: ctx.startedAt,
    today,
    items,
  };
}

/* ------------------------------------------------------------------ the five-minute job */

async function event(db: Db, updateId: string, propertyId: string, action: string, detail: Record<string, unknown>) {
  await loose(db).from("owner_closing_update_events").insert({ update_id: updateId, property_id: propertyId, action, detail });
}

/** One pass: schedule, preview notices, sends. Never throws; reports what it did. */
export async function runOwnerClosingUpdates(db: Db, now: Date = new Date()) {
  const sb = loose(db);
  const probe = await sb.from("owner_closing_updates").select("*").limit(2000);
  if (probe.error) return missing(probe.error) ? "waiting for the staged change" : `error: ${probe.error.message}`;
  const out = { created: 0, moved: 0, stopped: 0, missed: 0, previews: 0, sent: 0, testSent: 0, failed: 0 };
  const stored = ((probe.data ?? []) as any[]).map((r) => ({ ...toStored(r), propertyId: r.property_id as string }));
  const holidays = await savedHolidays(db);
  const inbox = await ownerUpdateTestInbox(db);

  // Every onboarding home not demo, plus any home that already has updates (so they can stop).
  const active = await sb.from("onboarding_projects").select("property_id").eq("status", "active").eq("is_demo", false);
  const ids = [...new Set([...((active.data ?? []) as { property_id: string }[]).map((p) => p.property_id), ...stored.map((s) => s.propertyId)])];
  const contexts = ids.length ? (await loadHomeContexts(db, ids)).filter((c) => !c.isDemo) : [];

  for (const ctx of contexts) {
    const mine = stored.filter((s) => s.propertyId === ctx.propertyId);
    const today = localNow(now, ctx.facts.timeZone).date;
    for (const ch of reconcileHome({ facts: ctx.facts, today, stored: mine, extraHolidays: holidays })) {
      if (ch.kind === "create") {
        const ins = await sb.from("owner_closing_updates").insert({ property_id: ctx.propertyId, update_no: ch.no, closing_on: ch.closingOn, send_on: ch.sendOn, send_at: ch.sendAt, time_zone: ch.timeZone }).select("id").maybeSingle();
        if (ins.data?.id) { out.created++; await event(db, ins.data.id, ctx.propertyId, "scheduled", { update_no: ch.no, send_on: ch.sendOn, closing_on: ch.closingOn }); }
      } else if (ch.kind === "move") {
        const up = await sb.from("owner_closing_updates").update({ closing_on: ch.closingOn, send_on: ch.sendOn, send_at: ch.sendAt, time_zone: ch.timeZone, status: "scheduled", status_reason: null, preview_notified_at: null }).eq("id", ch.id).in("status", ["scheduled", "stopped"]);
        if (!up.error) { out.moved++; await event(db, ch.id, ctx.propertyId, "moved", { update_no: ch.no, from: ch.from, to: ch.sendOn, closing_on: ch.closingOn }); }
      } else {
        const status = ch.kind === "stop" ? "stopped" : "missed";
        const up = await sb.from("owner_closing_updates").update({ status, status_reason: ch.reason }).eq("id", ch.id).eq("status", "scheduled");
        if (!up.error) { out[ch.kind === "stop" ? "stopped" : "missed"]++; await event(db, ch.id, ctx.propertyId, status, { update_no: ch.no, reason: ch.reason }); }
      }
    }
  }

  // Previews and sends read the rows again so they see this pass's changes.
  const due = await sb.from("owner_closing_updates").select("*").eq("status", "scheduled").lte("send_at", new Date(now.getTime() + 4 * 86_400_000).toISOString());
  const ctxById = new Map(contexts.map((c) => [c.propertyId, c]));
  for (const raw of (due.data ?? []) as any[]) {
    const row = toStored(raw);
    const ctx = ctxById.get(raw.property_id);
    if (!ctx) continue;
    const plan = plannedSends(row.closingOn, row.timeZone, holidays).find((p) => p.no === row.no);

    // The business day before: the Project Manager sees the message with Edit and Hold.
    if (!row.previewNotifiedAt && plan && previewDue({ previewAt: plan.previewAt, sendAt: row.sendAt, now }) && ctx.pm) {
      const msg = messageFor(ctx, row.no, row);
      const claim = await sb.from("owner_closing_updates").update({ preview_notified_at: now.toISOString() }).eq("id", row.id).is("preview_notified_at", null).select("id").maybeSingle();
      if (claim.data?.id) {
        await sb.from("staff_notifications").insert({
          user_id: ctx.pm.id, kind: "owner_update_preview", title: `Owner update ${row.no} sends tomorrow`,
          body: `${msg.subject}. Open it to Edit or Hold. If you do nothing, it sends as scheduled.`,
          entity_type: "property", entity_id: ctx.propertyId, link_path: `/onboarding/${ctx.propertyId}?tab=owner`,
          priority: "normal", is_demo: false, email_status: inbox.email ? "held" : "pending",
        });
        await event(db, row.id, ctx.propertyId, "preview_sent", { update_no: row.no, to_role: "Project Manager" });
        out.previews++;
      }
    }

    const decision = sendDecision({ sendOn: row.sendOn, sendAt: row.sendAt, timeZone: row.timeZone, now });
    if (decision === "wait") continue;
    if (decision === "missed" || !ctx.pm || (!ctx.delivery.portal && !ctx.delivery.emails.length && !inbox.email)) {
      const reason = decision === "missed" ? "Its send time passed. It is not sent late." : !ctx.pm ? "No Project Manager on the home at send time." : "No owner email on file at send time.";
      const up = await sb.from("owner_closing_updates").update({ status: "missed", status_reason: reason }).eq("id", row.id).eq("status", "scheduled");
      if (!up.error) { out.missed++; await event(db, row.id, ctx.propertyId, "missed", { update_no: row.no, reason }); }
      continue;
    }
    const claim = await sb.from("owner_closing_updates").update({ status: "sending" }).eq("id", row.id).eq("status", "scheduled").select("id").maybeSingle();
    if (!claim.data?.id) continue;
    const r = await deliver(db, ctx, row, inbox.email);
    const up = await sb.from("owner_closing_updates").update({
      status: r.status, status_reason: r.error, channel: r.channel, sent_subject: r.status === "failed" ? null : r.subject,
      sent_body: r.status === "failed" ? null : r.body, sent_to: r.to, sent_at: r.status === "failed" ? null : now.toISOString(),
    }).eq("id", row.id).eq("status", "sending");
    if (!up.error) await event(db, row.id, ctx.propertyId, r.status, { update_no: row.no, channel: r.channel, to: r.to, error: r.error });
    if (r.status === "sent") out.sent++; else if (r.status === "test_sent") out.testSent++; else out.failed++;
  }
  return out;
}

type Delivery = { status: "sent" | "test_sent" | "failed"; channel: "portal" | "email"; to: string[]; subject: string; body: string; error: string | null };

/**
 * One update to its owners, or only to the test inbox while testing. Active Owners: portal first, then the
 * email; a portal post that lands counts as sent and an email failure is kept as the reason.
 */
async function deliver(db: Db, ctx: HomeUpdateContext, row: Pick<StoredRow, "no" | "editedSubject" | "editedBody">, testTo: string | null): Promise<Delivery> {
  const msg = messageFor(ctx, row.no, row);
  const channel = ctx.delivery.portal ? ("portal" as const) : ("email" as const);
  const emails = ctx.delivery.emails;
  const { sendEmail, emailShell, emailText } = await import("@/lib/email.server");
  const pmEmail = ctx.pm?.email ?? undefined;
  if (testTo) {
    const subject = `[RESOLVE TEST] ${msg.subject}`;
    const emailPart = emails.length ? `by email to ${emails.join(", ")}` : "by email, but no owner email is on file";
    const note = channel === "portal"
      ? `Test copy. This owner is an Active Owner: the real update goes to their Resolve portal and ${emailPart}, with the Project Manager on Cc and as Reply-To.`
      : `Test copy. The real update goes ${emailPart}, with the Project Manager on Cc and as Reply-To.`;
    const body = `${note}\n\n${msg.body}`;
    const r = await sendEmail({ to: testTo, subject, html: emailShell(subject, body, undefined, "owner"), bodyText: emailText(subject, body), purpose: "owner_update_test_copy", entity: { type: "property", id: ctx.propertyId } });
    return { status: r.status === "sent" ? "test_sent" : "failed", channel, to: [testTo], subject: msg.subject, body: msg.body, error: r.status === "sent" ? null : r.error };
  }
  const sendOwnerEmail = async () => {
    const [to, ...more] = emails;
    if (!to) return { ok: false, error: "No owner email on file." };
    const r = await sendEmail({
      to, toAdditional: more, cc: pmEmail ? [pmEmail] : [], ...(pmEmail ? { replyTo: pmEmail, staffReplyTo: true } : {}),
      subject: msg.subject, html: emailShell(msg.subject, msg.body, undefined, "owner"), bodyText: msg.body,
      purpose: "owner_closing_update", entity: { type: "property", id: ctx.propertyId },
    });
    return { ok: r.status === "sent", error: r.status === "sent" ? null : r.error ?? "The email could not be sent." };
  };
  if (channel === "portal") {
    const ins = await loose(db).from("owner_notifications").insert({
      program_id: ctx.program!.id, owner_user_id: ctx.program!.ownerUserId, kind: "owner_update", priority: "p3",
      title: msg.subject, body: msg.body, action_path: `/owner?home=${ctx.propertyId}`, email_status: "skipped", is_demo: false,
    }).select("id").maybeSingle();
    if (ins.error) return { status: "failed", channel, to: [], subject: msg.subject, body: msg.body, error: ins.error.message };
    const e = await sendOwnerEmail();
    return {
      status: "sent", channel, to: e.ok ? ["portal", ...emails] : ["portal"], subject: msg.subject, body: msg.body,
      error: e.ok ? null : `Posted in the portal. The email did not send: ${e.error}`,
    };
  }
  const e = await sendOwnerEmail();
  return { status: e.ok ? "sent" : "failed", channel, to: emails, subject: msg.subject, body: msg.body, error: e.error };
}

/** Send a test copy of one update to the test inbox now (Project Manager, Director, Admin). Never to an owner. */
export async function sendTestCopy(db: Db, propertyId: string, no: UpdateNo) {
  const inbox = await ownerUpdateTestInbox(db);
  if (!inbox.email) throw new Error("No test inbox is set, so no test copy was sent.");
  const [ctx] = await loadHomeContexts(db, [propertyId]);
  if (!ctx) throw new Error("This home has no onboarding project.");
  const stored = await loose(db).from("owner_closing_updates").select("*").eq("property_id", propertyId).eq("update_no", no).maybeSingle();
  const row = stored.data ? toStored(stored.data) : { no, editedSubject: null, editedBody: null };
  const r = await deliver(db, ctx, row, inbox.email);
  if (r.status === "failed") throw new Error(r.error ?? "The test copy could not be sent.");
  return { ok: true as const };
}
