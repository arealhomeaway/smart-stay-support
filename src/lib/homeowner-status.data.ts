/**
 * Browser reads for homeowner status on My Tasks and Needs you now. Read only, under the existing
 * access rules (the same tables "What the homeowner has" reads). Nothing here writes.
 */
import { supabase } from "@/integrations/supabase/client";
import { formatPropertyLabel } from "@/lib/property-label";
import { UNSENT_REVIEW, GONE_APPROVAL } from "@/lib/homeowner-has";
import { loadCardSubmissions, loadHomeownerUpdates } from "@/lib/homeowner-has.data";
import { handedOffHomes, type HomeownerStatusData, type StatusReview } from "@/lib/homeowner-status";

const db = supabase as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Res<T> = { data: T[] | null; error: { message?: string } | null };
async function rows<T>(q: PromiseLike<Res<T>>, what: string): Promise<T[]> {
  const r = await q;
  if (r.error) throw new Error(`${what} could not load.`);
  return r.data ?? [];
}
const PAGE = 1000;
/** Reads in id groups and in pages, so no list is cut short by the 1,000-row read limit. Each query sets its own order. */
async function chunked<T>(ids: string[], q: (ids: string[]) => { range: (from: number, to: number) => PromiseLike<Res<T>> }, what: string): Promise<T[]> {
  const out: T[] = [];
  const unique = [...new Set(ids)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 100) {
    const slice = unique.slice(i, i + 100);
    for (let from = 0; ; from += PAGE) {
      const page = await rows(q(slice).range(from, from + PAGE - 1), what);
      out.push(...page);
      if (page.length < PAGE) break;
    }
  }
  return out;
}

type Program = { id: string; property_id: string | null; is_demo: boolean | null; status: string; created_at: string };

/** Each home's current Active Owner program, picked the same way as loadHomeProgram. */
async function currentPrograms(propertyIds: string[], demo: boolean): Promise<Map<string, Program>> {
  const linked = await chunked<{ program_id: string; property_id: string }>(propertyIds, (ids) =>
    db.from("owner_program_properties").select("program_id, property_id").in("property_id", ids).is("archived_at", null).order("program_id").order("property_id"), "Programs");
  const byPrimary = await chunked<Program>(propertyIds, (ids) =>
    db.from("owner_programs").select("id, property_id, is_demo, status, created_at").in("property_id", ids).is("archived_at", null).order("id"), "Programs");
  const byLink = await chunked<Program>(linked.map((l) => l.program_id), (ids) =>
    db.from("owner_programs").select("id, property_id, is_demo, status, created_at").in("id", ids).is("archived_at", null).order("id"), "Programs");
  const programs = new Map<string, Program>([...byPrimary, ...byLink].map((p) => [p.id, p]));
  const candidates = new Map<string, Program[]>();
  const add = (home: string, p: Program | undefined) => {
    if (!p || (!demo && p.is_demo)) return;
    candidates.set(home, [...(candidates.get(home) ?? []), p]);
  };
  for (const p of byPrimary) if (p.property_id) add(p.property_id, p);
  for (const l of linked) add(l.property_id, programs.get(l.program_id));
  const out = new Map<string, Program>();
  for (const [home, list] of candidates) {
    const pick = [...new Map(list.map((p) => [p.id, p])).values()].sort(
      (a, b) => Number(a.status === "closed") - Number(b.status === "closed") || b.created_at.localeCompare(a.created_at),
    )[0];
    if (pick) out.set(home, pick);
  }
  return out;
}

type ReviewRow = {
  id: string; program_id: string; title: string; status: string; property_id: string | null; created_at: string | null; available_from: string | null;
  created_by: string | null; responded_at: string | null; closed_at: string | null; owner_decision: string | null; owner_response: string | null;
  onboarding_task_id: string | null; is_demo: boolean | null;
};

/** Everything the homeowner has, for many homes at once. */
export async function loadHomeownerStatus(input: { propertyIds: string[]; demo: boolean }): Promise<HomeownerStatusData> {
  const empty: HomeownerStatusData = { cards: [], reviews: [], cardReviews: {}, approvals: [], planOn: {}, homeLabels: {} };
  const ids = [...new Set(input.propertyIds)].filter(Boolean);
  if (ids.length === 0) return empty;
  const programOf = await currentPrograms(ids, input.demo);
  const programIds = [...new Set([...programOf.values()].map((p) => p.id))];
  const homesOfProgram = new Map<string, string[]>();
  for (const [home, p] of programOf) homesOfProgram.set(p.id, [...(homesOfProgram.get(p.id) ?? []), home]);

  const [cardRows, settings, reviewRows, approvalRows, props] = await Promise.all([
    chunked<{
      id: string; property_id: string; program_id: string; join_outcome: string; unlocked_at: string | null; deadline_at: string | null;
      expired_at: string | null; owner_completed_at: string | null; created_at: string | null; owner_review_id: string | null; linked_task_id: string | null;
      card: { code: string | null; title: string; opens_text: string | null; stage_window: string | null; lane: string | null; owner_needed: boolean | null; output_fields?: unknown } | null;
    }>(ids, (x) =>
      db.from("ao_home_plan_cards")
        .select("id, property_id, program_id, join_outcome, unlocked_at, deadline_at, expired_at, owner_completed_at, created_at, owner_review_id, linked_task_id, card:ao_library_cards(code, title, opens_text, stage_window, lane, owner_needed, output_fields)")
        .in("property_id", x).order("id"), "Homeowner cards"),
    chunked<{ property_id: string; automated: boolean }>(ids, (x) =>
      db.from("ao_home_plan_settings").select("property_id, automated").in("property_id", x).order("property_id"), "Homeowner cards"),
    chunked<ReviewRow>(programIds, (x) =>
      db.from("owner_reviews")
        .select("id, program_id, title, status, property_id, created_at, available_from, created_by, responded_at, closed_at, owner_decision, owner_response, onboarding_task_id, is_demo")
        .in("program_id", x).is("archived_at", null).order("id"), "Owner items"),
    chunked<{
      id: string; entity_id: string | null; title: string | null; status: string; created_at: string | null; requested_by: string | null;
      decided_at: string | null; decision_note: string | null; property_id: string | null; is_demo: boolean | null;
    }>(ids, (x) =>
      db.from("approvals")
        .select("id, entity_id, title, status, created_at, requested_by, decided_at, decision_note, property_id, is_demo")
        .eq("entity_type", "onboarding_task").eq("approver_role", "owner").in("property_id", x).order("id"), "Approvals"),
    chunked<{ id: string; name: string | null; nickname: string | null; address_line1: string | null; unit: string | null; city: string | null; state: string | null; postal_code: string | null }>(ids, (x) =>
      db.from("properties").select("id, name, nickname, address_line1, unit, city, state, postal_code").in("id", x).order("id"), "Homes"),
  ]);

  // Only the home's current program, as on the home page.
  const cards = cardRows.filter((c) => programOf.get(c.property_id)?.id === c.program_id);
  const cardItems = new Set(cards.map((c) => c.owner_review_id).filter(Boolean) as string[]);
  const live = reviewRows.filter((r) => (input.demo || !r.is_demo) && !UNSENT_REVIEW.has(r.status));

  const reviewHomes = await chunked<{ review_id: string; property_id: string }>(live.map((r) => r.id), (x) =>
    db.from("owner_review_properties").select("review_id, property_id").in("review_id", x).order("review_id").order("property_id"), "Owner items");
  const [sends, messages] = await Promise.all([
    chunked<{ review_id: string; task_id: string; sent_by: string | null; sent_at: string }>(live.map((r) => r.id), (x) =>
      db.from("owner_item_task_sends").select("review_id, task_id, sent_by, sent_at").in("review_id", x).order("sent_at", { ascending: false }).order("task_id"), "Owner items"),
    chunked<{ review_id: string; body: string; created_at: string }>(
      live.filter((r) => r.responded_at || r.status === "answered").map((r) => r.id),
      (x) => db.from("owner_request_messages").select("review_id, body, created_at").eq("author_type", "homeowner").in("review_id", x).order("created_at", { ascending: false }),
      "Owner answers"),
  ]);
  const firstSend = new Map<string, (typeof sends)[number]>();
  for (const s of sends) if (!firstSend.has(s.review_id)) firstSend.set(s.review_id, s);
  const lastMessage = new Map<string, string>();
  for (const m of messages) if (!lastMessage.has(m.review_id)) lastMessage.set(m.review_id, m.body);
  const extraHomes = new Map<string, string[]>();
  for (const x of reviewHomes) extraHomes.set(x.review_id, [...(extraHomes.get(x.review_id) ?? []), x.property_id]);

  // What the homeowner sent on cards finished in the last 7 days (existing read rule on saved answers).
  const recentSince = Date.now() - 8 * 86_400_000;
  const updatesP = loadHomeownerUpdates({ propertyIds: ids, since: new Date(recentSince).toISOString() });
  const submissions = await loadCardSubmissions(
    cards.filter((c) => c.owner_completed_at && Date.parse(c.owner_completed_at) >= recentSince).map((c) => c.id),
  );

  const toReview = (r: ReviewRow): StatusReview => {
    const send = firstSend.get(r.id);
    // The home it is about: its own home, an added home in this list, else the program's first home here.
    const home = (r.property_id && programOf.has(r.property_id) ? r.property_id : null)
      ?? (extraHomes.get(r.id) ?? []).find((h) => programOf.has(h))
      ?? (homesOfProgram.get(r.program_id) ?? [])[0]
      ?? null;
    return {
      id: r.id, title: r.title, status: r.status,
      sentAt: send?.sent_at ?? r.available_from ?? r.created_at,
      sentBy: send?.sent_by ?? r.created_by,
      respondedAt: r.responded_at, closedAt: r.closed_at, decision: r.owner_decision, response: r.owner_response,
      lastOwnerMessage: lastMessage.get(r.id) ?? null, files: [],
      propertyId: home, taskId: send?.task_id ?? r.onboarding_task_id,
    };
  };

  return {
    cards: cards.map((c) => ({
      id: c.id, propertyId: c.property_id, code: c.card?.code ?? null, title: c.card?.title ?? "Homeowner card",
      opensText: c.card?.opens_text ?? null, stageWindow: c.card?.stage_window ?? null, lane: c.card?.lane ?? null,
      joinOutcome: c.join_outcome, unlockedAt: c.unlocked_at, deadlineAt: c.deadline_at, expiredAt: c.expired_at,
      ownerCompletedAt: c.owner_completed_at, createdAt: c.created_at, ownerReviewId: c.owner_review_id,
      linkedTaskId: c.linked_task_id, ownerNeeded: Boolean(c.card?.owner_needed),
      outputFields: c.card?.output_fields ?? null, submission: submissions.get(c.id) ?? null,
    })),
    reviews: live.filter((r) => !cardItems.has(r.id)).map(toReview),
    cardReviews: Object.fromEntries(live.filter((r) => cardItems.has(r.id)).map((r) => [r.id, toReview(r)])),
    approvals: approvalRows
      .filter((a) => (input.demo || !a.is_demo) && !GONE_APPROVAL.has(a.status))
      .map((a) => ({
        id: a.id, title: a.title ?? "Onboarding decision", status: a.status, createdAt: a.created_at, requestedBy: a.requested_by,
        decidedAt: a.decided_at, decisionNote: a.decision_note, files: [], propertyId: a.property_id, taskId: a.entity_id,
      })),
    planOn: Object.fromEntries(settings.map((s) => [s.property_id, Boolean(s.automated)])),
    homeLabels: Object.fromEntries(props.map((p) => [p.id, formatPropertyLabel(p).primary])),
    updates: (await updatesP)
      .filter((u) => (input.demo || !u.isDemo) && u.propertyId && programOf.has(u.propertyId))
      .map((u) => ({ id: u.id, propertyId: u.propertyId, title: u.title, taskId: u.taskId, at: u.at })),
  };
}

/** Homes handed off to Operations that have a current Active Owner program. */
export async function loadHandedOffProgramHomes(demo: boolean): Promise<string[]> {
  const programs = await rows<{ id: string; property_id: string | null; is_demo: boolean | null }>(
    db.from("owner_programs").select("id, property_id, is_demo").is("archived_at", null).neq("status", "closed").order("id").limit(PAGE), "Programs");
  const live = programs.filter((p) => demo || !p.is_demo);
  const linked = await chunked<{ property_id: string }>(live.map((p) => p.id), (x) =>
    db.from("owner_program_properties").select("property_id").in("program_id", x).is("archived_at", null).order("property_id"), "Programs");
  const homes = [...new Set([...live.map((p) => p.property_id ?? ""), ...linked.map((l) => l.property_id)])].filter(Boolean);
  const projects = await chunked<{ property_id: string; status: string; ops_accepted_at: string | null; created_at: string }>(homes, (x) =>
    db.from("onboarding_projects").select("property_id, status, ops_accepted_at, created_at").in("property_id", x).order("created_at").order("property_id"), "Homes");
  return [...handedOffHomes(projects)];
}
