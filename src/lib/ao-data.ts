/**
 * Browser reads/writes for the Active Owner plan engine. Every call returns
 * { available: false } while the staged database objects do not exist, so
 * screens can show "Not set up yet" instead of breaking.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, unwrap, type Available } from "@/lib/ao-ui";
import type { LinkSuggestionRow, MapRow } from "@/lib/ao-dedupe";

// The engine tables are staged and not in generated types yet.
const db = supabase as unknown as {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type LibraryCardRow = {
  id: string; code: string; title: string; version: number; status: string; card_group: string; lane: string;
  stage_window: string; what_text: string; why_text: string; how_text: string; required_output: string;
  documentation_note: string; opens_text: string; deadline_text: string; takeover_text: string;
  est_hours_min: number | null; est_hours_max: number | null; team_needs_this: boolean; lock_rule: string;
  event_triggered: boolean; deadline_business_days: number | null; deadline_calendar_days: number | null;
  output_fields: unknown; updated_at: string;
};

export async function loadLibrary(): Promise<Available<LibraryCardRow[]>> {
  return unwrap(await db.from("ao_library_cards").select("*").order("code"));
}
export async function loadCardHistory(cardId: string): Promise<Available<{ id: number; version: number; changed_at: string; changed_by: string | null; snapshot: Record<string, unknown> }[]>> {
  return unwrap(await db.from("ao_library_card_history").select("id,version,changed_at,changed_by,snapshot").eq("card_id", cardId).order("changed_at", { ascending: false }));
}
export async function saveCard(cardId: string, patch: Record<string, unknown>) {
  const r = unwrap<number>(await db.rpc("ao_card_save", { _card_id: cardId, _patch: patch }));
  if (!r.available) throw new Error("The card library is not set up yet");
  return r.data;
}
export async function setCardStatus(cardId: string, status: string) {
  const r = unwrap<number>(await db.rpc("ao_card_set_status", { _card_id: cardId, _status: status }));
  if (!r.available) throw new Error("The card library is not set up yet");
  return r.data;
}

export type HomePlanRow = {
  id: string; join_outcome: string; unlocked_at: string | null; deadline_at: string | null; reminder_sent_at: string | null;
  expired_at: string | null; owner_completed_at: string | null; linked_task_id: string | null; owner_review_id: string | null;
  card: { code: string; title: string } | null; covered_reason?: string | null;
};
export async function loadHomePlan(propertyId: string) {
  const settings = unwrap<{ automated: boolean } | null>(await db.from("ao_home_plan_settings").select("automated").eq("property_id", propertyId).maybeSingle());
  if (!settings.available) return { available: false as const };
  const [cards, history] = await Promise.all([
    db.from("ao_home_plan_cards").select("*,card:ao_library_cards(code,title)").eq("property_id", propertyId),
    db.from("ao_home_plan_settings_history").select("id,automated,changed_by,changed_at").eq("property_id", propertyId).order("changed_at", { ascending: false }),
  ]);
  const c = unwrap<HomePlanRow[]>(cards); const h = unwrap<{ id: number; automated: boolean; changed_by: string | null; changed_at: string }[]>(history);
  if (!c.available || !h.available) return { available: false as const };
  const plan = [...(c.data ?? [])].sort((a, b) => (a.card?.code ?? "").localeCompare(b.card?.code ?? ""));
  return { available: true as const, automated: Boolean(settings.data?.automated), plan, history: h.data ?? [] };
}
export async function previewHomeAutomation(propertyId: string) {
  return unwrap<{ ready: boolean; reason?: string; stage?: string; outcomes?: Record<string, number>; already_on_plan?: number;
    covered?: { code: string; title: string; reason: string; item_title?: string }[] }>(
    await db.rpc("ao_preview_home_automation", { _property: propertyId }));
}
export async function setHomeAutomation(propertyId: string, on: boolean) {
  const r = unwrap(await db.rpc("ao_set_home_automation", { _property: propertyId, _on: on }));
  if (!r.available) throw new Error("The automated plan is not set up yet");
  return r.data;
}
export async function unlockNow(planCardId: string) {
  const r = unwrap(await db.rpc("ao_unlock_now", { _plan_card: planCardId }));
  if (!r.available) throw new Error("The automated plan is not set up yet");
  return r.data;
}

export async function loadTaskPlanCard(taskId: string) {
  return unwrap<{ id: string; owner_completed_at: string | null; owner_review_id: string | null } | null>(
    await db.from("ao_home_plan_cards").select("id,owner_completed_at,owner_review_id").eq("linked_task_id", taskId).order("created_at").limit(1).maybeSingle());
}

export async function loadOwnerPlan(programId: string) {
  return unwrap<import("@/lib/ao-ui").PortalPlanCard[]>(await db.rpc("ao_owner_plan", { _program: programId }));
}
export async function submitCard(planCardId: string, values: Record<string, unknown>) {
  const r = unwrap<string>(await db.rpc("ao_submit_card", { _plan_card: planCardId, _values: values }));
  if (!r.available) throw new Error("This item is not set up yet");
  return r.data;
}

type ContributionDbRow = { id: string; plan_card_id: string; submitted_at: string; submitted_by: string; field_values: Record<string, unknown>; property_id: string; card: { code: string; title: string } | null };

async function inChunks<T>(ids: string[], q: (ids: string[]) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) out.push(...(((await q(ids.slice(i, i + 200))).data) ?? []));
  return { data: out };
}

export async function loadContributions() {
  const r = await fetchAllPages<ContributionDbRow>((from, to) =>
    db.from("ao_contributions").select("id,plan_card_id,submitted_at,submitted_by,field_values,property_id,card:ao_library_cards(code,title)")
      .order("submitted_at", { ascending: false }).order("id").range(from, to));
  if (!r.available) return r;
  const rows = r.data;
  const propIds = [...new Set(rows.map((x) => x.property_id))];
  const userIds = [...new Set(rows.map((x) => x.submitted_by))];
  const [props, people] = await Promise.all([
    inChunks(propIds, (ids) => supabase.from("properties").select("id,name").in("id", ids)),
    inChunks(userIds, (ids) => supabase.from("profiles").select("id,full_name").in("id", ids)),
  ]);
  const pName = new Map((props.data ?? []).map((p) => [p.id, p.name]));
  const uName = new Map((people.data ?? []).map((p) => [p.id, p.full_name ?? "Homeowner"]));
  return {
    available: true as const,
    data: rows.map((x) => ({
      id: x.id, planCardId: x.plan_card_id, card: x.card?.title ?? "", cardCode: x.card?.code ?? "", home: pName.get(x.property_id) ?? "Home",
      member: uName.get(x.submitted_by) ?? "Homeowner", submittedAt: x.submitted_at, values: x.field_values ?? {},
    })),
  };
}

export async function loadHomeProgramStatus(propertyId: string): Promise<string | null> {
  // The program's primary home, or any home added to the program (owner_program_properties).
  const linked = await db
    .from("owner_program_properties")
    .select("program_id")
    .eq("property_id", propertyId)
    .is("archived_at", null);
  const programIds = ((linked.data ?? []) as { program_id: string }[]).map((r) => r.program_id);
  const filter = programIds.length ? `property_id.eq.${propertyId},id.in.(${programIds.join(",")})` : `property_id.eq.${propertyId}`;
  const { data } = await supabase
    .from("owner_programs")
    .select("status")
    .or(filter)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  const statuses = ((data ?? []) as { status?: string | null }[]).map((r) => r.status ?? null);
  // A live program wins over a closed one on the same home.
  return statuses.find((s) => s && s !== "closed" && s !== "archived") ?? statuses[0] ?? null;
}

// ---- De-duplication: confirmed map, step-link suggestions, one-off sends ----

export async function loadItemMap(): Promise<Available<MapRow[]>> {
  return unwrap(await db.from("ao_card_item_map").select("id,match_kind,match_value,card_code,status,note").order("card_code").order("match_value"));
}
export async function decideItemMap(id: string, status: "confirmed" | "rejected" | "suggested") {
  const r = unwrap<string>(await db.rpc("ao_card_item_map_decide", { _id: id, _status: status }));
  if (!r.available) throw new Error("This list is not set up yet");
  return r.data;
}
export async function loadStepLinkSuggestions(): Promise<Available<LinkSuggestionRow[]>> {
  return unwrap(await db.from("ao_card_step_link_suggestions").select("id,card_code,suggestion_kind,template_task_ids,proposed_lock,confidence,note,status").order("card_code"));
}
export async function decideStepLink(id: string, accept: boolean) {
  const r = unwrap<string>(await db.rpc("ao_step_link_decide", { _id: id, _accept: accept }));
  if (!r.available) throw new Error("This list is not set up yet");
  return r.data;
}
export async function loadStepTitles(ids: string[]): Promise<Record<string, { title: string; template: string }>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.from("onboarding_template_tasks").select("id,title,template_id,onboarding_templates(name)").in("id", ids);
  return Object.fromEntries(((data ?? []) as unknown as { id: string; title: string; onboarding_templates: { name: string } | null }[])
    .map((r) => [r.id, { title: r.title, template: r.onboarding_templates?.name ?? "" }]));
}
export async function loadMapTemplateTitles(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const [a, b] = await Promise.all([
    supabase.from("owner_task_templates").select("id,title").in("id", ids),
    supabase.from("owner_opportunity_library").select("id,title").in("id", ids),
  ]);
  return Object.fromEntries([...(a.data ?? []), ...(b.data ?? [])].map((r) => [r.id, r.title]));
}
/** Staff confirm the next send is a clearly different one-off for this home. */
export async function confirmOneOff(propertyId: string, taskId: string | null, title: string) {
  const r = unwrap<string>(await db.rpc("ao_confirm_one_off", { _property: propertyId, _task: taskId, _title: title }));
  if (!r.available) throw new Error("This check is not set up yet");
  return r.data;
}

// ---- Active Owner fix (Nov 11): staged functions; each returns { available: false } until applied.

export type EnrolledHomeRow = {
  property_id: string; home: string; program_id: string | null; stage: string;
  open: number | null; locked: number | null; already_covered: number | null; skipped: number | null; reason: string | null;
};
/** Admin: what Start plans for enrolled homes would do. Writes nothing. */
export async function previewEnrolledHomes() {
  return unwrap<{ homes: EnrolledHomeRow[]; blocked: boolean; token: string }>(await db.rpc("ao_preview_enrolled_homes"));
}
/** Admin: starts every previewed home in one step, all or none. */
export async function startEnrolledHomes(token: string) {
  const r = unwrap<{ started: number }>(await db.rpc("ao_start_enrolled_homes", { _token: token }));
  if (!r.available) throw new Error("Starting plans for enrolled homes is not set up yet");
  return r.data;
}
/** Admin: the daily homeowner email time (Central). */
export async function loadOwnerDigestTime(): Promise<string> {
  const r = await supabase.from("app_settings").select("value").eq("key", "owner_digest_time").maybeSingle();
  const v = (r.data?.value ?? null) as { time?: string } | null;
  return v?.time ?? "09:00";
}
export async function setOwnerDigestTime(time: string) {
  const r = unwrap<string>(await db.rpc("set_owner_digest_time", { _time: time }));
  if (!r.available) throw new Error("The daily homeowner email is not set up yet");
  return r.data;
}

export type OwnerItemMessage = { id: string; author_type: "homeowner" | "staff" | "system"; author_name: string; event: string | null; body: string; created_at: string };
export type OwnerItemDetail = { conversation: boolean; open: boolean; status: string; updated_at: string; messages: OwnerItemMessage[] };
export async function loadOwnerItemDetail(reviewId: string) {
  return unwrap<OwnerItemDetail>(await db.rpc("owner_item_detail", { _review_id: reviewId }));
}
/** The homeowner writes back in the same item. */
export async function replyToOwnerItem(reviewId: string, body: string) {
  const r = unwrap<string>(await db.rpc("owner_item_reply", { _review_id: reviewId, _body: body }));
  if (!r.available) throw new Error("Replies are not set up yet");
  return r.data;
}
/** Staff reply, resolve or reopen through the existing conversation action. */
export async function manageOwnerItem(reviewId: string, action: "reply" | "resolve" | "reopen", body = "") {
  const r = unwrap(await db.rpc("manage_owner_review_conversation", { _id: reviewId, _action: action, _body: body }));
  if (!r.available) throw new Error("Replies are not set up yet");
}
/** The owner item a Task was sent as, when it was sent through Send to the owner. */
export async function loadTaskOwnerItem(taskId: string) {
  return unwrap<{ review_id: string; sent_at: string } | null>(
    await db.from("owner_item_task_sends").select("review_id,sent_at").eq("task_id", taskId).order("sent_at", { ascending: false }).limit(1).maybeSingle());
}
export type OwnerItemNeed = { review_id: string; property_id: string; task_id: string | null; title: string; why: string; since: string };
export async function loadMyOwnerItemNeeds(): Promise<OwnerItemNeed[]> {
  const r = unwrap<OwnerItemNeed[]>(await db.rpc("my_owner_item_needs"));
  return r.available ? r.data ?? [] : [];
}
