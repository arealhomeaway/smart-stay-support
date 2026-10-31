/**
 * Browser reads/writes for the Active Owner plan engine. Every call returns
 * { available: false } while the staged database objects do not exist, so
 * screens can show "Not set up yet" instead of breaking.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, type Available } from "@/lib/ao-ui";

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
  card: { code: string; title: string } | null;
};
export async function loadHomePlan(propertyId: string) {
  const settings = unwrap<{ automated: boolean } | null>(await db.from("ao_home_plan_settings").select("automated").eq("property_id", propertyId).maybeSingle());
  if (!settings.available) return { available: false as const };
  const [cards, history] = await Promise.all([
    db.from("ao_home_plan_cards").select("id,join_outcome,unlocked_at,deadline_at,reminder_sent_at,expired_at,owner_completed_at,linked_task_id,owner_review_id,card:ao_library_cards(code,title)").eq("property_id", propertyId),
    db.from("ao_home_plan_settings_history").select("id,automated,changed_by,changed_at").eq("property_id", propertyId).order("changed_at", { ascending: false }),
  ]);
  const c = unwrap<HomePlanRow[]>(cards); const h = unwrap<{ id: number; automated: boolean; changed_by: string | null; changed_at: string }[]>(history);
  if (!c.available || !h.available) return { available: false as const };
  const plan = [...(c.data ?? [])].sort((a, b) => (a.card?.code ?? "").localeCompare(b.card?.code ?? ""));
  return { available: true as const, automated: Boolean(settings.data?.automated), plan, history: h.data ?? [] };
}
export async function previewHomeAutomation(propertyId: string) {
  return unwrap<{ ready: boolean; reason?: string; stage?: string; outcomes?: Record<string, number>; already_on_plan?: number }>(
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
  return unwrap<import("@/lib/ao-ui").PortalPlanCard[] & { property_id?: string }[]>(await db.rpc("ao_owner_plan", { _program: programId }));
}
export async function submitCard(planCardId: string, values: Record<string, unknown>) {
  const r = unwrap<string>(await db.rpc("ao_submit_card", { _plan_card: planCardId, _values: values }));
  if (!r.available) throw new Error("This item is not set up yet");
  return r.data;
}

export async function loadContributions() {
  const r = unwrap<{ id: string; submitted_at: string; submitted_by: string; field_values: Record<string, unknown>; property_id: string; card: { code: string; title: string } | null }[]>(
    await db.from("ao_contributions").select("id,submitted_at,submitted_by,field_values,property_id,card:ao_library_cards(code,title)").order("submitted_at", { ascending: false }).limit(2000));
  if (!r.available) return r;
  const rows = r.data ?? [];
  const propIds = [...new Set(rows.map((x) => x.property_id))];
  const userIds = [...new Set(rows.map((x) => x.submitted_by))];
  const [props, people] = await Promise.all([
    propIds.length ? supabase.from("properties").select("id,name").in("id", propIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    userIds.length ? supabase.from("profiles").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);
  const pName = new Map((props.data ?? []).map((p) => [p.id, p.name]));
  const uName = new Map((people.data ?? []).map((p) => [p.id, p.full_name ?? "Homeowner"]));
  return {
    available: true as const,
    data: rows.map((x) => ({
      id: x.id, card: x.card?.title ?? "", cardCode: x.card?.code ?? "", home: pName.get(x.property_id) ?? "Home",
      member: uName.get(x.submitted_by) ?? "Homeowner", submittedAt: x.submitted_at, values: x.field_values ?? {},
    })),
  };
}

export async function loadHomeProgramStatus(propertyId: string): Promise<string | null> {
  const { data } = await supabase.from("owner_programs").select("status").eq("property_id", propertyId).is("archived_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as { status?: string } | null)?.status ?? null;
}
