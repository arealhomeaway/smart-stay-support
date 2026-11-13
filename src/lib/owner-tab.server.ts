/**
 * Property page Part 2: server reads and the scheduled parts for the Owner tab, the project chat,
 * weekly owner updates and owner reminders. Every write goes through the caller-authenticated RPCs
 * staged in docs/pending/property-page-part2; until they are applied the reads report `staged` and
 * the scheduled parts skip quietly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ownerChatWaiting,
  ownerTabRights,
  weekStartOf,
  weeklyAutoSendDue,
  weeklyDraft,
  weeklyDraftDue,
  centralParts,
  type OwnerTabViewer,
  type TimelineRow,
} from "@/lib/owner-tab";
import { splitOwnerName } from "@/lib/onboarding-home-page";

type Db = SupabaseClient;
type Err = { code?: string; message?: string } | null | undefined;

/** A staged table or function that is not in the database yet. */
export function isStagedMissing(e: Err): boolean {
  if (!e) return false;
  const m = e.message ?? "";
  return e.code === "42P01" || e.code === "42883" || e.code === "PGRST202" || e.code === "PGRST205" || e.code === "42703"
    || /does not exist|Could not find the (table|function)/i.test(m);
}

export async function loadOwnerTabViewer(sb: Db, uid: string, propertyId: string): Promise<OwnerTabViewer> {
  const [admin, manager, onboarding, director, project] = await Promise.all([
    sb.rpc("has_role" as never, { _user_id: uid, _role: "admin" } as never),
    sb.rpc("has_role" as never, { _user_id: uid, _role: "manager" } as never),
    sb.rpc("has_role" as never, { _user_id: uid, _role: "onboarding" } as never),
    sb.rpc("is_onboarding_director" as never, { _user_id: uid } as never),
    sb.from("onboarding_projects").select("project_manager, director, utility_manager, role_assignments")
      .eq("property_id", propertyId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const p = (project.data ?? null) as { project_manager?: string | null; director?: string | null; utility_manager?: string | null; role_assignments?: Record<string, string> | null } | null;
  const ra = p?.role_assignments ?? {};
  const team = [p?.director, p?.utility_manager, ra["lead_designer"], ra["designer"], ra["design_staging"], ra["utilities"]];
  const isAdmin = admin.data === true;
  return {
    userId: uid,
    isAdmin,
    isOnboardingDirector: director.data === true,
    isHomePm: p?.project_manager === uid,
    isHomeTeam: team.includes(uid),
    isStaff: isAdmin || manager.data === true || onboarding.data === true,
  };
}

async function names(sb: Db, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const list = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!list.length) return new Map();
  const { data } = await sb.from("profiles").select("id, full_name, email").in("id", list);
  return new Map((data ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p.full_name?.trim() || p.email || "A teammate"]));
}

export type OwnerTabData = Awaited<ReturnType<typeof readOwnerTab>>;

/** One read for the Owner tab (2.1), under the caller's row level security. */
export async function readOwnerTab(sb: Db, uid: string, propertyId: string) {
  const viewer = await loadOwnerTabViewer(sb, uid, propertyId);
  const rights = ownerTabRights(viewer);
  const staged = { chat: true, notes: true, weekly: true, reminders: true, goodToKnow: true };

  const home = await sb.from("properties").select("id, owner_record_id, is_demo").eq("id", propertyId).maybeSingle();
  const ownerId = (home.data as { owner_record_id?: string | null } | null)?.owner_record_id ?? null;

  const [ownerRec, itemMsgs, emails, approvals, chats, notes, weekly, reminders, settings, otherHomes] = await Promise.all([
    ownerId
      ? sb.from("property_owners").select("id, name, preferred_method, team_notes, team_notes_updated_at, team_notes_updated_by").eq("id", ownerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sb.from("owner_request_messages").select("id, body, author_name, author_type, created_at, work_item_id, event").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(200),
    sb.from("email_log").select("id, subject, recipient, sent_by, status, created_at, sent_at").eq("entity_type", "property").eq("entity_id", propertyId).in("status", ["sent", "scheduled"]).order("created_at", { ascending: false }).limit(100),
    sb.from("approvals").select("id, title, status, decided_at, created_at, responded_at, response_channel").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(100),
    sb.from("home_chats" as never).select("id, kind").eq("property_id", propertyId),
    sb.from("onboarding_notes").select("id, body, author_id, created_at, kind" as never).eq("property_id", propertyId).in("kind" as never, ["call", "text"] as never).is("archived_at", null).order("created_at", { ascending: false }).limit(200),
    sb.from("owner_weekly_updates" as never).select("id, week_start, draft_text, edited_text, status, sent_at, sent_by, sent_text, sent_automatically, created_at").eq("property_id", propertyId).order("week_start", { ascending: false }).limit(30),
    sb.from("owner_decision_reminders" as never).select("work_item_id, sent_at, due_on").order("sent_at", { ascending: false }).limit(500),
    sb.from("owner_weekly_update_settings" as never).select("auto_send, paused, updated_at, updated_by").eq("property_id", propertyId).maybeSingle(),
    ownerId ? sb.from("properties").select("id, nickname, name, address_line1, unit, city, state, postal_code, ownerrez_property_id").eq("owner_record_id", ownerId).neq("id", propertyId).limit(20) : Promise.resolve({ data: [], error: null }),
  ]);
  if (isStagedMissing(ownerRec.error)) staged.goodToKnow = false;
  if (isStagedMissing(chats.error)) staged.chat = false;
  if (isStagedMissing(notes.error)) staged.notes = false;
  if (isStagedMissing(weekly.error) || isStagedMissing(settings.error)) staged.weekly = false;
  if (isStagedMissing(reminders.error)) staged.reminders = false;

  // Good to know reads the plain owner record when the staged columns are not there yet.
  let owner = ownerRec.data as null | { id: string; name: string | null; preferred_method: string | null; team_notes?: string | null; team_notes_updated_at?: string | null; team_notes_updated_by?: string | null };
  if (!staged.goodToKnow && ownerId) {
    const plain = await sb.from("property_owners").select("id, name, preferred_method").eq("id", ownerId).maybeSingle();
    owner = (plain.data ?? null) as typeof owner;
  }

  const chatRows = (chats.data ?? []) as { id: string; kind: string }[];
  const ownerChat = chatRows.find((c) => c.kind === "owner") ?? null;
  const chatMsgs = ownerChat
    ? ((await sb.from("home_chat_messages" as never).select("id, author_id, author_type, body, created_at").eq("chat_id", ownerChat.id).order("created_at", { ascending: false }).limit(200)).data ?? []) as { id: string; author_id: string; author_type: string; body: string; created_at: string }[]
    : [];
  const noteRows = (staged.notes ? notes.data ?? [] : []) as unknown as { id: string; body: string; author_id: string | null; created_at: string; kind: "call" | "text" }[];
  const weeklyRows = (staged.weekly ? weekly.data ?? [] : []) as unknown as { id: string; week_start: string; draft_text: string; edited_text: string | null; status: string; sent_at: string | null; sent_by: string | null; sent_text: string | null; sent_automatically: boolean; created_at: string }[];
  const reminderRows = (staged.reminders ? reminders.data ?? [] : []) as unknown as { work_item_id: string; sent_at: string; due_on: string }[];
  const who = await names(sb, [
    ...chatMsgs.map((m) => m.author_id),
    ...noteRows.map((n) => n.author_id),
    ...weeklyRows.map((w) => w.sent_by),
    ...((emails.data ?? []) as { sent_by: string | null }[]).map((e) => e.sent_by),
    owner?.team_notes_updated_by,
  ]);

  const timeline: TimelineRow[] = [
    ...chatMsgs.map((m) => ({ id: `chat-${m.id}`, kind: "portal" as const, text: m.body || "Sent a file", who: m.author_type === "owner" ? who.get(m.author_id) ?? "The owner" : who.get(m.author_id) ?? "A teammate", at: m.created_at })),
    ...((itemMsgs.data ?? []) as { id: string; body: string | null; author_name: string | null; author_type: string; created_at: string; event: string | null }[])
      .filter((m) => (m.body ?? "").trim())
      .map((m) => ({ id: `item-${m.id}`, kind: "portal" as const, text: m.body ?? "", who: m.author_name ?? (m.author_type === "homeowner" ? "The owner" : "A teammate"), at: m.created_at })),
    ...((emails.data ?? []) as { id: string; subject: string; recipient: string; sent_by: string | null; created_at: string; sent_at: string | null; status: string }[])
      .map((e) => ({ id: `email-${e.id}`, kind: "email" as const, text: `${e.subject}${e.status === "scheduled" ? " (scheduled)" : ""}`, who: e.sent_by ? who.get(e.sent_by) ?? "A teammate" : "Resolve", at: e.sent_at ?? e.created_at })),
    ...noteRows.map((n) => ({ id: `note-${n.id}`, kind: n.kind, text: n.body, who: (n.author_id && who.get(n.author_id)) || "A teammate", at: n.created_at })),
    ...((approvals.data ?? []) as { id: string; title: string; status: string; decided_at: string | null; created_at: string }[])
      .map((a) => ({ id: `approval-${a.id}`, kind: "approval" as const, text: `${a.title}: ${a.status === "approved" ? "Approved" : a.status === "rejected" || a.status === "declined" ? "Declined" : "Asked"}`, who: a.decided_at ? "The owner" : "A teammate", at: a.decided_at ?? a.created_at })),
    ...weeklyRows.filter((w) => w.status === "sent" && w.sent_at).map((w) => ({ id: `weekly-${w.id}`, kind: "weekly" as const, text: w.sent_text ?? w.draft_text, who: w.sent_automatically ? "Resolve" : (w.sent_by && who.get(w.sent_by)) || "A teammate", at: w.sent_at! })),
  ];

  // 2.1 item 2: owner decisions holding up an open Task, with their due dates.
  const decisionItems = await sb
    .from("work_items")
    .select("id, title, due_on, source_task_id, linked_task_id, response_types, responded_at, completed_at, status")
    .eq("property_id", propertyId)
    .eq("kind", "opportunity")
    .not("status", "in", "(archived,draft,complete,completed)")
    .is("responded_at", null);
  const decRows = ((decisionItems.data ?? []) as { id: string; title: string; due_on: string | null; source_task_id: string | null; linked_task_id: string | null; response_types: string[] | null; completed_at: string | null }[])
    .filter((d) => (d.response_types ?? []).includes("decision") && !d.completed_at && (d.source_task_id || d.linked_task_id));
  const taskIds = [...new Set(decRows.map((d) => (d.source_task_id ?? d.linked_task_id)!))];
  const openTasks = taskIds.length
    ? (((await sb.from("onboarding_tasks").select("id, title, status").in("id", taskIds).is("archived_at", null)).data ?? []) as { id: string; title: string; status: string }[])
        .filter((t) => !["complete", "carryover", "not_required", "void"].includes((t.status ?? "").toLowerCase()))
    : [];
  const taskTitle = new Map(openTasks.map((t) => [t.id, t.title]));
  const decisions = decRows
    .map((d) => ({ id: d.id, title: d.title, dueOn: d.due_on, taskTitle: taskTitle.get((d.source_task_id ?? d.linked_task_id)!) ?? null }))
    .filter((d): d is { id: string; title: string; dueOn: string | null; taskTitle: string } => !!d.taskTitle);

  const hol = await sb.from("ao_business_holidays").select("day").gte("day", new Date(Date.now() - 86400000 * 30).toISOString().slice(0, 10)).limit(200);
  const holidays = ((hol.data ?? []) as { day: string }[]).map((h) => h.day);

  const draft = weeklyRows.find((w) => w.status === "draft") ?? null;
  return {
    decisions,
    holidays,
    staged,
    rights,
    viewer,
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          preferredMethod: owner.preferred_method,
          teamNotes: owner.team_notes ?? null,
          teamNotesAt: owner.team_notes_updated_at ?? null,
          teamNotesBy: owner.team_notes_updated_by ? who.get(owner.team_notes_updated_by) ?? "A teammate" : null,
        }
      : null,
    otherHomes: ((otherHomes.data ?? []) as { id: string; nickname: string | null; name: string | null; address_line1: string | null; unit: string | null; city: string | null; state: string | null; postal_code: string | null; ownerrez_property_id: string | null }[]).map((h) => ({
      id: h.id,
      home: { id: h.id, nickname: h.nickname, name: h.name, address_line1: h.address_line1, unit: h.unit, city: h.city, state: h.state, postal_code: h.postal_code, ownerrez_property_id: h.ownerrez_property_id == null ? null : String(h.ownerrez_property_id) },
    })),
    timeline,
    ownerChatId: ownerChat?.id ?? null,
    ownerChatWaiting: ownerChatWaiting(chatMsgs),
    lastOwnerChatMessage: chatMsgs.find((m) => m.author_type === "owner") ?? null,
    weekly: draft ? { id: draft.id, weekStart: draft.week_start, text: draft.edited_text ?? draft.draft_text } : null,
    weeklySettings: (staged.weekly ? settings.data : null) as null | { auto_send: boolean; paused: boolean },
    reminders: Object.fromEntries(reminderRows.map((r) => [r.work_item_id, r.sent_at])),
  };
}

/* ------------------------------------------------------------------ chat */

export async function readHomeChat(sb: Db, uid: string, propertyId: string, kind: "owner" | "team") {
  const chat = await sb.from("home_chats" as never).select("id").eq("property_id", propertyId).eq("kind", kind).maybeSingle();
  if (isStagedMissing(chat.error)) return { staged: false as const, chatId: null, messages: [], readMarks: [], tasks: [] };
  if (chat.error) throw new Error(chat.error.message);
  const chatId = (chat.data as { id: string } | null)?.id ?? null;
  if (!chatId) return { staged: true as const, chatId: null, messages: [], readMarks: [], tasks: [] };
  const [msgs, reads] = await Promise.all([
    sb.from("home_chat_messages" as never).select("id, author_id, author_type, body, attachments, mentions, created_at").eq("chat_id", chatId).order("created_at", { ascending: true }).limit(500),
    sb.from("home_chat_reads" as never).select("user_id, last_read_at").eq("chat_id", chatId),
  ]);
  if (msgs.error) throw new Error(msgs.error.message);
  const rows = (msgs.data ?? []) as unknown as { id: string; author_id: string; author_type: "staff" | "owner"; body: string; attachments: { document_id: string; name?: string; folder?: string }[]; mentions: string[]; created_at: string }[];
  const tasks = kind && rows.length
    ? (((await sb.from("home_chat_message_tasks" as never).select("message_id, task_id").in("message_id", rows.map((r) => r.id))).data ?? []) as { message_id: string; task_id: string }[])
    : [];
  // Author names: owners cannot read staff profiles, so names come from the privileged reader,
  // limited to the authors of messages this caller could already read.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const authorNames = await names(supabaseAdmin as never, rows.map((r) => r.author_id));
  return {
    staged: true as const,
    chatId,
    messages: rows.map((r) => ({ ...r, authorName: authorNames.get(r.author_id) ?? (r.author_type === "owner" ? "The owner" : "A teammate"), mine: r.author_id === uid })),
    readMarks: ((reads.data ?? []) as { user_id: string; last_read_at: string }[]),
    tasks,
  };
}

/* ------------------------------------------------------------------ scheduled parts */

/** Five-minute job (Part 2): unread chat alerts, owner reminders, Friday drafts and auto-send. Never throws. */
export async function runOwnerCommsJobs(db: Db, now: Date = new Date()) {
  const out: Record<string, unknown> = {};
  const call = async (name: string, fn: string) => {
    const r = await db.rpc(fn as never, { _now: now.toISOString() } as never);
    out[name] = isStagedMissing(r.error) ? "waiting for the staged change" : r.error ? `error: ${r.error.message}` : r.data;
  };
  try { await call("chat_unread", "home_chat_unread_alert_run"); } catch (e) { out["chat_unread"] = String(e); }
  try { await call("owner_reminders", "owner_decision_reminder_run"); } catch (e) { out["owner_reminders"] = String(e); }
  try { out["weekly_drafts"] = weeklyDraftDue(now) ? await writeWeeklyDrafts(db, now) : "not Friday morning"; } catch (e) { out["weekly_drafts"] = String(e); }
  try { out["weekly_auto_send"] = weeklyAutoSendDue(now) ? await autoSendWeekly(db) : "not Friday 3 PM"; } catch (e) { out["weekly_auto_send"] = String(e); }
  return { ok: true as const, ...out };
}

async function writeWeeklyDrafts(db: Db, now: Date) {
  const today = centralParts(now).date;
  const weekStart = weekStartOf(today);
  const probe = await db.from("owner_weekly_updates" as never).select("id").eq("week_start", weekStart).limit(1);
  if (isStagedMissing(probe.error)) return "waiting for the staged change";
  const { data: projects } = await db.from("onboarding_projects")
    .select("property_id, project_manager, committed_handoff_on, target_handoff_on, is_demo, properties!inner(id, nickname, name, address_line1, unit, city, state, postal_code, ownerrez_property_id, owner_record_id, is_demo, property_owners:owner_record_id(name))")
    .in("status", ["planning", "active"]);
  let written = 0;
  const { formatPropertyLabel } = await import("@/lib/property-label");
  for (const p of (projects ?? []) as unknown as { property_id: string; project_manager: string | null; committed_handoff_on: string | null; target_handoff_on: string | null; is_demo: boolean; properties: Record<string, unknown> & { owner_record_id: string | null; property_owners: { name: string | null } | null } }[]) {
    if (!p.properties.owner_record_id) continue;
    const exists = await db.from("owner_weekly_updates" as never).select("id").eq("property_id", p.property_id).eq("week_start", weekStart).maybeSingle();
    if (exists.data) continue;
    const [tasks, decisions] = await Promise.all([
      db.from("onboarding_tasks").select("title, status, completed_at, due_on, parent_task_id, archived_at").eq("property_id", p.property_id),
      db.from("work_items").select("title, due_on").eq("property_id", p.property_id).eq("kind", "opportunity").contains("response_types", ["decision"]).is("responded_at", null).is("retired_at", null).not("status", "in", "(draft,complete,closed,archived)"),
    ]);
    const handoffOn = p.committed_handoff_on ?? p.target_handoff_on ?? null;
    const taskRows = (tasks.data ?? []) as { title: string; status: string; completed_at: string | null; due_on: string | null; parent_task_id: string | null; archived_at: string | null }[];
    const behind = taskRows.some((t) => !["complete", "done", "void"].includes(t.status) && !t.parent_task_id && !t.archived_at && t.due_on && t.due_on < today);
    const split = splitOwnerName(p.properties.property_owners?.name ?? null);
    const first = (split.people ?? p.properties.property_owners?.name ?? "").replace(/\s+[A-Z][a-z'-]+$/, "").trim();
    const text = weeklyDraft({
      ownerFirstNames: first,
      homeName: formatPropertyLabel(p.properties as never).primary,
      weekStart, today, tasks: taskRows, decisions: (decisions.data ?? []) as { title: string; due_on: string | null }[], handoffOn, behind,
    });
    const ins = await db.from("owner_weekly_updates" as never).insert({ property_id: p.property_id, week_start: weekStart, draft_text: text, is_demo: Boolean(p.is_demo || p.properties["is_demo"]) } as never).select("id").maybeSingle();
    if (ins.error || !ins.data) continue;
    // Older drafts for this home are replaced by this week's.
    await db.from("owner_weekly_updates" as never).update({ status: "skipped", skipped_at: now.toISOString(), skip_reason: "Replaced by a newer week" } as never)
      .eq("property_id", p.property_id).eq("status", "draft").lt("week_start", weekStart);
    if (p.project_manager) {
      await db.from("staff_notifications").insert({
        user_id: p.project_manager, kind: "weekly_update_ready", title: "This week's owner update is ready",
        body: `Review and send it · ${formatPropertyLabel(p.properties as never).primary}`, entity_type: "property", entity_id: p.property_id,
        link_path: `/onboarding/${p.property_id}?tab=owner`, priority: "normal", is_demo: Boolean(p.is_demo), email_status: p.is_demo ? "none" : "pending",
      } as never);
    }
    written++;
  }
  return { written };
}

async function autoSendWeekly(db: Db) {
  const { data } = await db.from("owner_weekly_update_settings" as never).select("property_id").eq("auto_send", true).eq("paused", false);
  let sent = 0;
  for (const s of (data ?? []) as { property_id: string }[]) {
    const { data: draft } = await db.from("owner_weekly_updates" as never).select("id, draft_text, edited_text").eq("property_id", s.property_id).eq("status", "draft").order("week_start", { ascending: false }).limit(1).maybeSingle();
    const d = draft as { id: string; draft_text: string; edited_text: string | null } | null;
    if (!d) continue;
    const r = await db.rpc("weekly_update_send_internal" as never, { _id: d.id, _text: d.edited_text ?? d.draft_text, _actor: null, _auto: true, _email_log_id: null } as never);
    if (!r.error) sent++;
  }
  return { sent };
}
