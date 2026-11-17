/**
 * Browser reads for "What the homeowner has". Read only, under the existing access rules: every
 * staff role already reads plan cards, the card library, owner items, approvals, hours and the
 * team's roles. Nothing here writes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { HourEntry } from "@/lib/owner-portal-look";
import {
  approvalStatusLine,
  centralDay,
  submissionLines,
  reviewStatusLine,
  senderRole,
  taskSentLine,
  openedCardLine,
  type CardSubmission,
  type HasApproval,
  type HasFile,
  type HasPlanCard,
  type HasReview,
} from "@/lib/homeowner-has";

// Engine tables are not all in the generated types.
const db = supabase as unknown as {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

type Res<T> = { data: T[] | null; error: { message?: string } | null };
async function rows<T>(q: PromiseLike<Res<T>>, what: string): Promise<T[]> {
  const r = await q;
  if (r.error) throw new Error(`${what} could not load.`);
  return r.data ?? [];
}
async function chunked<T>(ids: string[], q: (ids: string[]) => PromiseLike<Res<T>>, what: string): Promise<T[]> {
  const out: T[] = [];
  const unique = [...new Set(ids)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 150) out.push(...(await rows(q(unique.slice(i, i + 150)), what)));
  return out;
}

export type HomeProgram = { id: string; ownerName: string; isDemo: boolean };

/** The home's current Active Owner program (primary home or an added home), or null. */
export async function loadHomeProgram(propertyId: string): Promise<HomeProgram | null> {
  const linked = await rows<{ program_id: string }>(
    db.from("owner_program_properties").select("program_id").eq("property_id", propertyId).is("archived_at", null),
    "The program",
  );
  const ids = linked.map((r) => r.program_id);
  const filter = ids.length ? `property_id.eq.${propertyId},id.in.(${ids.join(",")})` : `property_id.eq.${propertyId}`;
  const programs = await rows<{ id: string; owner_name: string | null; is_demo: boolean | null; status: string; created_at: string }>(
    db.from("owner_programs").select("id, owner_name, is_demo, status, created_at").or(filter).is("archived_at", null),
    "The program",
  );
  const pick = [...programs].sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed") || b.created_at.localeCompare(a.created_at))[0];
  return pick ? { id: pick.id, ownerName: pick.owner_name || "this homeowner", isDemo: Boolean(pick.is_demo) } : null;
}

type CardRow = {
  id: string; property_id: string; program_id: string; join_outcome: string; unlocked_at: string | null; deadline_at: string | null;
  expired_at: string | null; owner_completed_at: string | null; created_at: string | null; owner_review_id: string | null;
  card: { code: string | null; title: string; opens_text: string | null; stage_window: string | null; lane: string | null; output_fields?: unknown } | null;
};

/**
 * The homeowner's latest saved answer per plan card. Read under the existing access rule on saved
 * answers: a reader the rule does not cover gets no rows, and the card shows its status only.
 */
export async function loadCardSubmissions(planCardIds: string[]): Promise<Map<string, CardSubmission>> {
  const rowsOut = await chunked<{ plan_card_id: string; field_values: unknown; files: unknown; submitted_at: string }>(
    planCardIds,
    (ids) => db.from("ao_contributions").select("plan_card_id, field_values, files, submitted_at").in("plan_card_id", ids).order("submitted_at", { ascending: false }),
    "Homeowner answers",
  );
  const out = new Map<string, CardSubmission>();
  for (const r of rowsOut) {
    if (out.has(r.plan_card_id)) continue;
    const files = Array.isArray(r.files)
      ? (r.files as { document_id?: string; name?: string }[]).filter((f) => typeof f?.document_id === "string").map((f) => ({ id: f.document_id as string, name: f.name || "File" }))
      : [];
    out.set(r.plan_card_id, { values: (r.field_values ?? {}) as Record<string, unknown>, files, submittedAt: r.submitted_at });
  }
  return out;
}

export type HomeownerHasData = {
  cards: HasPlanCard[];
  planOn: Record<string, boolean>;
  hourEntries: HourEntry[];
  reviews: HasReview[];
  approvals: HasApproval[];
  roles: Record<string, string>;
};

/** Shared files on the source Tasks: only what was shared with the homeowner. */
async function sharedTaskFiles(taskIds: string[], demo: boolean): Promise<Map<string, HasFile[]>> {
  const docs = await chunked<{ id: string; entity_id: string; title: string | null; original_filename: string | null; is_demo: boolean | null }>(
    taskIds,
    (ids) =>
      db.from("documents").select("id, entity_id, title, original_filename, is_demo")
        .eq("entity_type", "onboarding_task").in("entity_id", ids).eq("visibility", "owner_shared")
        .eq("upload_status", "stored").is("archived_at", null).is("deleted_at", null).order("created_at", { ascending: false }),
    "Shared files",
  );
  const out = new Map<string, HasFile[]>();
  for (const d of docs) {
    if (!demo && d.is_demo) continue;
    out.set(d.entity_id, [...(out.get(d.entity_id) ?? []), { id: d.id, name: d.original_filename || d.title || "Shared file" }]);
  }
  return out;
}

/** Role label per teammate id, never a name. */
export async function roleLabels(userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const [appRoles, seats, pools] = await Promise.all([
    chunked<{ user_id: string; role: string }>(ids, (x) => db.from("user_roles").select("user_id, role").in("user_id", x), "Roles"),
    chunked<{ code: string; current_seat_holder: string }>(ids, (x) => db.from("functional_roles").select("code, current_seat_holder").eq("active", true).in("current_seat_holder", x), "Roles"),
    chunked<{ user_id: string; role_code: string }>(ids, (x) => db.from("functional_role_members").select("user_id, role_code").in("user_id", x), "Roles"),
  ]);
  const out: Record<string, string> = {};
  for (const id of ids) {
    out[id] = senderRole({
      appRoles: appRoles.filter((r) => r.user_id === id).map((r) => String(r.role)),
      roleCodes: [
        ...seats.filter((s) => s.current_seat_holder === id).map((s) => s.code),
        ...pools.filter((p) => p.user_id === id).map((p) => p.role_code),
      ],
    });
  }
  return out;
}

/**
 * Everything the homeowner has for these homes in one program: plan cards, owner items and
 * approvals the team sent. `propertyIds` limits to one home (property page) or every home in the
 * program (Active Owner page). Program-wide owner items show with every home.
 */
export async function loadHomeownerHas(input: { programId: string; propertyIds: string[]; demo: boolean }): Promise<HomeownerHasData> {
  const { programId, propertyIds, demo } = input;
  const homes = new Set(propertyIds);

  const [cardRows, settings, reviewRows, entryRows, approvalRows] = await Promise.all([
    chunked<CardRow>(propertyIds, (ids) =>
      db.from("ao_home_plan_cards")
        .select("id, property_id, program_id, join_outcome, unlocked_at, deadline_at, expired_at, owner_completed_at, created_at, owner_review_id, card:ao_library_cards(code, title, opens_text, stage_window, lane, output_fields)")
        .eq("program_id", programId).in("property_id", ids), "Homeowner cards"),
    chunked<{ property_id: string; automated: boolean }>(propertyIds, (ids) =>
      db.from("ao_home_plan_settings").select("property_id, automated").in("property_id", ids), "Homeowner cards"),
    rows<{
      id: string; title: string; status: string; property_id: string | null; created_at: string | null; available_from: string | null;
      created_by: string | null; responded_at: string | null; closed_at: string | null; owner_decision: string | null;
      owner_response: string | null; onboarding_task_id: string | null; is_demo: boolean | null;
    }>(
      db.from("owner_reviews")
        .select("id, title, status, property_id, created_at, available_from, created_by, responded_at, closed_at, owner_decision, owner_response, onboarding_task_id, is_demo")
        .eq("program_id", programId).is("archived_at", null),
      "Owner items",
    ),
    rows<{ id: string; minutes: number; activity: string | null; review_id: string | null; amends_entry_id: string | null; entry_date: string | null; reviewed_at: string | null }>(
      db.from("owner_time_entries").select("id, minutes, activity, review_id, amends_entry_id, entry_date, reviewed_at").eq("program_id", programId),
      "Hours",
    ),
    chunked<{
      id: string; entity_id: string | null; title: string | null; status: string; created_at: string | null; requested_by: string | null;
      decided_at: string | null; decision_note: string | null; property_id: string | null; is_demo: boolean | null;
    }>(propertyIds, (ids) =>
      db.from("approvals")
        .select("id, entity_id, title, status, created_at, requested_by, decided_at, decision_note, property_id, is_demo")
        .eq("entity_type", "onboarding_task").eq("approver_role", "owner").in("property_id", ids), "Approvals"),
  ]);

  // Owner items for these homes: by their own home, their added homes, or program-wide.
  const reviewHomes = await chunked<{ review_id: string; property_id: string }>(
    reviewRows.map((r) => r.id),
    (ids) => db.from("owner_review_properties").select("review_id, property_id").in("review_id", ids),
    "Owner items",
  );
  const homesOf = new Map<string, Set<string>>();
  for (const r of reviewRows) if (r.property_id) homesOf.set(r.id, new Set([r.property_id]));
  for (const x of reviewHomes) homesOf.set(x.review_id, new Set([...(homesOf.get(x.review_id) ?? []), x.property_id]));
  // Items a plan card created show as that card, never twice (same as the homeowner portal).
  const cardItems = new Set(cardRows.map((c) => c.owner_review_id).filter(Boolean) as string[]);
  const mine = reviewRows.filter((r) => {
    if (cardItems.has(r.id)) return false;
    if (!demo && r.is_demo) return false;
    const h = homesOf.get(r.id);
    return !h || h.size === 0 || [...h].some((p) => homes.has(p));
  });

  const [sends, messages] = await Promise.all([
    chunked<{ review_id: string; task_id: string; sent_by: string | null; sent_at: string }>(mine.map((r) => r.id), (ids) =>
      db.from("owner_item_task_sends").select("review_id, task_id, sent_by, sent_at").in("review_id", ids).order("sent_at", { ascending: false }), "Owner items"),
    chunked<{ review_id: string; body: string; created_at: string }>(
      mine.filter((r) => r.responded_at || r.status === "answered").map((r) => r.id),
      (ids) => db.from("owner_request_messages").select("review_id, body, created_at").eq("author_type", "homeowner").in("review_id", ids).order("created_at", { ascending: false }),
      "Owner answers",
    ),
  ]);
  const firstSend = new Map<string, { task_id: string; sent_by: string | null; sent_at: string }>();
  for (const s of sends) if (!firstSend.has(s.review_id)) firstSend.set(s.review_id, s);
  const lastMessage = new Map<string, string>();
  for (const m of messages) if (!lastMessage.has(m.review_id)) lastMessage.set(m.review_id, m.body);

  const myApprovals = approvalRows.filter((a) => demo || !a.is_demo);
  const taskIds = [
    ...mine.map((r) => r.onboarding_task_id ?? firstSend.get(r.id)?.task_id ?? ""),
    ...myApprovals.map((a) => a.entity_id ?? ""),
  ];
  const [files, roles, submissions] = await Promise.all([
    sharedTaskFiles(taskIds, demo),
    roleLabels([
      ...mine.map((r) => firstSend.get(r.id)?.sent_by ?? r.created_by ?? ""),
      ...myApprovals.map((a) => a.requested_by ?? ""),
    ]),
    loadCardSubmissions(cardRows.filter((c) => c.owner_completed_at).map((c) => c.id)),
  ]);

  const amended = new Set(entryRows.map((e) => e.amends_entry_id).filter(Boolean) as string[]);
  const entryHomes = await chunked<{ entry_id: string; property_id: string }>(entryRows.map((e) => e.id), (ids) =>
    db.from("owner_time_entry_properties").select("entry_id, property_id").in("entry_id", ids), "Hours");

  return {
    cards: cardRows.map((c) => ({
      id: c.id,
      propertyId: c.property_id,
      code: c.card?.code ?? null,
      title: c.card?.title ?? "Homeowner card",
      opensText: c.card?.opens_text ?? null,
      stageWindow: c.card?.stage_window ?? null,
      lane: c.card?.lane ?? null,
      joinOutcome: c.join_outcome,
      unlockedAt: c.unlocked_at,
      deadlineAt: c.deadline_at,
      expiredAt: c.expired_at,
      ownerCompletedAt: c.owner_completed_at,
      createdAt: c.created_at,
      ownerReviewId: c.owner_review_id,
      outputFields: c.card?.output_fields ?? null,
      submission: submissions.get(c.id) ?? null,
    })),
    planOn: Object.fromEntries(settings.map((s) => [s.property_id, Boolean(s.automated)])),
    hourEntries: entryRows.map((e) => ({
      minutes: e.minutes,
      activity: e.activity,
      review_id: e.review_id,
      superseded: amended.has(e.id),
      propertyIds: entryHomes.filter((x) => x.entry_id === e.id).map((x) => x.property_id),
      entry_date: e.entry_date,
      reviewed_at: e.reviewed_at,
    })),
    reviews: mine.map((r) => {
      const send = firstSend.get(r.id);
      const task = r.onboarding_task_id ?? send?.task_id ?? null;
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        sentAt: send?.sent_at ?? r.available_from ?? r.created_at,
        sentBy: send?.sent_by ?? r.created_by,
        respondedAt: r.responded_at,
        closedAt: r.closed_at,
        decision: r.owner_decision,
        response: r.owner_response,
        lastOwnerMessage: lastMessage.get(r.id) ?? null,
        files: task ? files.get(task) ?? [] : [],
      };
    }),
    approvals: myApprovals.map((a) => ({
      id: a.id,
      title: a.title ?? "Onboarding decision",
      status: a.status,
      createdAt: a.created_at,
      requestedBy: a.requested_by,
      decidedAt: a.decided_at,
      decisionNote: a.decision_note,
      files: a.entity_id ? files.get(a.entity_id) ?? [] : [],
    })),
    roles,
  };
}

/** The two Task drawer lines: the card finishing it opened, and its owner item or approval. */
export async function loadTaskHomeownerLines(input: { taskId: string; done: boolean; completedAt: string | null }): Promise<{ opened: string[]; sent: string | null; answers: { title: string; line: string; lines: string[]; files: HasFile[] }[] }> {
  const { taskId } = input;
  const [cards, sends, items, approvals] = await Promise.all([
    rows<{ id: string; unlocked_at: string | null; owner_completed_at: string | null; card: { title: string; output_fields?: unknown } | null }>(
      db.from("ao_home_plan_cards").select("id, unlocked_at, owner_completed_at, card:ao_library_cards(title, output_fields)").eq("linked_task_id", taskId),
      "The homeowner card",
    ),
    rows<{ review_id: string; sent_at: string }>(
      db.from("owner_item_task_sends").select("review_id, sent_at").eq("task_id", taskId).order("sent_at", { ascending: false }).limit(1),
      "The owner item",
    ),
    rows<{ id: string; status: string; created_at: string | null; available_from: string | null; responded_at: string | null; closed_at: string | null; owner_decision: string | null; owner_response: string | null; archived_at: string | null }>(
      db.from("owner_reviews").select("id, status, created_at, available_from, responded_at, closed_at, owner_decision, owner_response, archived_at").eq("onboarding_task_id", taskId).is("archived_at", null).order("created_at", { ascending: false }),
      "The owner item",
    ),
    rows<{ status: string; created_at: string | null; decided_at: string | null; decision_note: string | null; title: string | null; id: string; requested_by: string | null }>(
      db.from("approvals").select("id, status, created_at, decided_at, decision_note, title, requested_by").eq("entity_type", "onboarding_task").eq("entity_id", taskId).eq("approver_role", "owner").order("created_at", { ascending: false }),
      "The approval",
    ),
  ]);
  const opened = cards
    .map((c) => openedCardLine(c.card ? { title: c.card.title, unlockedAt: c.unlocked_at } : null, { done: input.done, completedAt: input.completedAt }))
    .filter((x): x is string => Boolean(x));

  // The item the Task was sent as (Send to the homeowner) wins; else an item made for the Task.
  let review = items.find((r) => r.id === sends[0]?.review_id) ?? null;
  if (sends[0] && !review) {
    const own = await rows<(typeof items)[number]>(
      db.from("owner_reviews").select("id, status, created_at, available_from, responded_at, closed_at, owner_decision, owner_response, archived_at").eq("id", sends[0].review_id).is("archived_at", null),
      "The owner item",
    );
    review = own[0] ?? null;
  }
  review ??= items.find((r) => r.status !== "prepared" && r.status !== "draft") ?? null;
  let sent: string | null = null;
  if (review && review.status !== "prepared" && review.status !== "draft") {
    const msg = review.responded_at
      ? await rows<{ body: string }>(
          db.from("owner_request_messages").select("body").eq("review_id", review.id).eq("author_type", "homeowner").order("created_at", { ascending: false }).limit(1),
          "The owner answer",
        )
      : [];
    const sentAt = sends[0]?.sent_at ?? review.available_from ?? review.created_at;
    const s = reviewStatusLine({
      id: review.id, title: "", status: review.status, sentAt, sentBy: null, respondedAt: review.responded_at, closedAt: review.closed_at,
      decision: review.owner_decision, response: review.owner_response, lastOwnerMessage: msg[0]?.body ?? null, files: [],
    });
    sent = s.waiting ? taskSentLine({ sentAt, answered: false, answeredAt: null, answer: "" }) : s.line;
  } else {
    const a = approvals.find((x) => x.status !== "withdrawn" && x.status !== "cancelled");
    if (a) {
      const s = approvalStatusLine({ id: a.id, title: a.title ?? "", status: a.status, createdAt: a.created_at, requestedBy: a.requested_by, decidedAt: a.decided_at, decisionNote: a.decision_note, files: [] });
      sent = s.waiting ? taskSentLine({ sentAt: a.created_at, answered: false, answeredAt: null, answer: "" }) : s.line;
    }
  }
  // What the homeowner sent on the linked cards she finished.
  const finishedCards = cards.filter((c) => c.owner_completed_at);
  const subs = finishedCards.length ? await loadCardSubmissions(finishedCards.map((c) => c.id)) : new Map<string, CardSubmission>();
  const answers = finishedCards.map((c) => {
    const sub = subs.get(c.id) ?? null;
    return {
      title: c.card?.title ?? "Homeowner card",
      line: `Homeowner finished ${c.card?.title ?? "the card"} ${centralDay(c.owner_completed_at)}`,
      lines: submissionLines(c.card?.output_fields, sub),
      files: sub?.files ?? [],
    };
  });
  return { opened, sent, answers };
}

/** Proof on finished Tasks: their files, when they were sent to the homeowner, and who finished them (role). */
export async function loadTaskProof(input: { taskIds: string[]; completerIds: string[] }): Promise<{
  files: Record<string, string[]>;
  sentAt: Record<string, string>;
  roles: Record<string, string>;
}> {
  const [docs, sends, approvals, roles] = await Promise.all([
    chunked<{ entity_id: string; title: string | null; original_filename: string | null }>(input.taskIds, (ids) =>
      db.from("documents").select("entity_id, title, original_filename").eq("entity_type", "onboarding_task").in("entity_id", ids)
        .eq("upload_status", "stored").is("archived_at", null).is("deleted_at", null).order("created_at"), "Task files"),
    chunked<{ task_id: string; sent_at: string }>(input.taskIds, (ids) =>
      db.from("owner_item_task_sends").select("task_id, sent_at").in("task_id", ids).order("sent_at", { ascending: false }), "Sent to the homeowner"),
    chunked<{ entity_id: string; created_at: string | null; status: string }>(input.taskIds, (ids) =>
      db.from("approvals").select("entity_id, created_at, status").eq("entity_type", "onboarding_task").eq("approver_role", "owner").in("entity_id", ids), "Sent to the homeowner"),
    roleLabels(input.completerIds),
  ]);
  const files: Record<string, string[]> = {};
  for (const d of docs) (files[d.entity_id] ??= []).push(d.original_filename || d.title || "File");
  const sentAt: Record<string, string> = {};
  for (const s of sends) if (!sentAt[s.task_id]) sentAt[s.task_id] = s.sent_at;
  for (const a of approvals) if (!sentAt[a.entity_id] && a.created_at && a.status !== "withdrawn" && a.status !== "cancelled") sentAt[a.entity_id] = a.created_at;
  return { files, sentAt, roles };
}
