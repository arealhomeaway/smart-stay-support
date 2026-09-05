/**
 * Evidence Quality Gate — server engine.
 *
 * The gate is the only place that decides whether a photo counts as proof. It
 * runs in two stages against one standard: "can a reasonable reviewer clearly
 * verify the work?" Stage A is technical (sharp, lit, framed, unobstructed).
 * Stage B is about the requirement itself (is this the serial label? is the
 * filter size readable? is this really the after shot?).
 *
 * Hard rules:
 *   - A rejection always names a reason code and gives a specific fix. There
 *     is no generic failure message.
 *   - Only a supervisor may accept a rejected photo, always with a written
 *     reason. The original rejection is kept, never overwritten.
 *   - Every decision writes an evidence event. The trail is the record.
 *   - The gate scores photos, not people. Nothing here is attributed to an
 *     individual in analytics.
 */
import { generateText } from "ai";
import { COACH_MODEL, createLovableAiGatewayProvider } from "./ai-gateway.server";
import { ATTACHMENT_BUCKET } from "./attachments";
import {
  KIND_CRITERIA,
  KIND_LABEL,
  isReasonCode,
  rejectionSteps,
  rejectionSummary,
  type EvidenceItemView,
  type EvidenceKind,
  type EvidenceRequirementView,
  type EvidenceSubject,
  type ItemStatus,
  type ReasonCode,
  type RequirementStatus,
} from "./evidence";
import { writeAudit } from "./audit.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const SIGNED_URL_SECONDS = 600;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export type Actor = { userId: string; name: string; isSupervisor: boolean };

/* ------------------------------------------------------------------ */
/* Requirements                                                        */
/* ------------------------------------------------------------------ */

export type RequirementSeed = {
  slotKey: string;
  label?: string | undefined;
  kind: EvidenceKind;
  instruction?: string | null | undefined;
  detail?: string | null | undefined;
  required?: boolean | undefined;
};

/**
 * Declares the evidence a record needs. Idempotent: an existing slot keeps its
 * status and its history, so re-running a work type's requirements never wipes
 * evidence that has already been verified.
 */
export async function ensureRequirements(
  subjectType: EvidenceSubject,
  subjectId: string,
  propertyId: string | null,
  seeds: RequirementSeed[],
  createdBy: string | null = null,
) {
  const db = await admin();
  for (const seed of seeds) {
    const existing = await db
      .from("evidence_requirements")
      .select("id")
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .eq("slot_key", seed.slotKey)
      .maybeSingle();
    if (existing.data) continue;
    await db.from("evidence_requirements").insert({
      subject_type: subjectType,
      subject_id: subjectId,
      property_id: propertyId,
      slot_key: seed.slotKey,
      label: seed.label ?? KIND_LABEL[seed.kind],
      requirement_kind: seed.kind,
      instruction: seed.instruction ?? null,
      detail: seed.detail ?? null,
      required: seed.required !== false,
      status: "awaiting",
      created_by: createdBy,
    } as never);
  }
  return listRequirements(subjectType, subjectId);
}

export async function removeRequirement(requirementId: string) {
  const db = await admin();
  await db.from("evidence_requirements").delete().eq("id", requirementId);
}

type ReqRow = {
  id: string;
  subject_type: EvidenceSubject;
  subject_id: string;
  property_id: string | null;
  slot_key: string;
  label: string;
  requirement_kind: EvidenceKind;
  instruction: string | null;
  detail: string | null;
  required: boolean;
  status: RequirementStatus;
};

type ItemRow = {
  id: string;
  requirement_id: string | null;
  document_id: string | null;
  source: "resolve_upload" | "breezeway_photo";
  external_url: string | null;
  status: ItemStatus;
  reason_codes: string[] | null;
  guidance: string | null;
  evaluated_at: string | null;
  created_at: string;
  uploaded_by: string | null;
  exception_by: string | null;
  exception_reason: string | null;
  exception_at: string | null;
  original_rejection: string | null;
  posted_to_breezeway_at: string | null;
};

async function signedUrlFor(documentId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();
  const path = (data as { storage_path: string | null } | null)?.storage_path;
  if (!path) return null;
  const signed = await db.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return signed.data?.signedUrl ?? null;
}

/** Requirements for one record, each with its submitted photos and viewing links. */
export async function listRequirements(
  subjectType: EvidenceSubject,
  subjectId: string,
): Promise<EvidenceRequirementView[]> {
  const db = await admin();
  const { data: reqs } = await db
    .from("evidence_requirements")
    .select(
      "id, subject_type, subject_id, property_id, slot_key, label, requirement_kind, instruction, detail, required, status",
    )
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });

  const rows = (reqs ?? []) as unknown as ReqRow[];
  if (rows.length === 0) return [];

  const { data: itemData } = await db
    .from("evidence_items")
    .select(
      "id, requirement_id, document_id, source, external_url, status, reason_codes, guidance, evaluated_at, created_at, uploaded_by, exception_by, exception_reason, exception_at, original_rejection, posted_to_breezeway_at",
    )
    .in(
      "requirement_id",
      rows.map((r) => r.id),
    )
    .order("created_at", { ascending: false });
  const items = (itemData ?? []) as unknown as ItemRow[];

  const people = new Map<string, string>();
  const ids = [
    ...new Set(items.flatMap((i) => [i.uploaded_by, i.exception_by]).filter(Boolean) as string[]),
  ];
  if (ids.length) {
    const { data } = await db.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (data ?? []) as {
      id: string;
      full_name: string | null;
      email: string | null;
    }[]) {
      people.set(p.id, p.full_name || p.email || "Unknown");
    }
  }

  const views: EvidenceRequirementView[] = [];
  for (const r of rows) {
    const mine = items.filter((i) => i.requirement_id === r.id);
    const shaped: EvidenceItemView[] = [];
    for (const i of mine) {
      shaped.push({
        id: i.id,
        status: i.status,
        source: i.source,
        url: i.document_id ? await signedUrlFor(i.document_id) : i.external_url,
        reasonCodes: (i.reason_codes ?? []).filter(isReasonCode),
        guidance: i.guidance,
        evaluatedAt: i.evaluated_at,
        createdAt: i.created_at,
        uploadedByName: i.uploaded_by ? (people.get(i.uploaded_by) ?? null) : null,
        exceptionReason: i.exception_reason,
        exceptionByName: i.exception_by ? (people.get(i.exception_by) ?? null) : null,
        exceptionAt: i.exception_at,
        originalRejection: i.original_rejection,
        postedToBreezewayAt: i.posted_to_breezeway_at,
      });
    }
    views.push({
      id: r.id,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      slotKey: r.slot_key,
      label: r.label,
      kind: r.requirement_kind,
      instruction: r.instruction,
      detail: r.detail,
      required: r.required,
      status: r.status,
      items: shaped,
    });
  }
  return views;
}

/** True when every required slot is verified or carries a supervisor exception. */
export async function evidenceComplete(subjectType: EvidenceSubject, subjectId: string) {
  const db = await admin();
  const { data } = await db
    .from("evidence_requirements")
    .select("status, required")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId);
  const rows = (data ?? []) as { status: RequirementStatus; required: boolean }[];
  const outstanding = rows.filter(
    (r) => r.required && r.status !== "verified" && r.status !== "accepted_exception",
  );
  return {
    complete: outstanding.length === 0,
    outstanding: outstanding.length,
    total: rows.length,
  };
}

/* ------------------------------------------------------------------ */
/* The gate                                                            */
/* ------------------------------------------------------------------ */

export type GateVerdict = {
  status: "verified" | "rejected";
  reasonCodes: ReasonCode[];
  guidance: string | null;
  stageA: Record<string, unknown>;
  stageB: Record<string, unknown>;
  evaluator: string;
};

const SYSTEM = `You are the evidence reviewer for a short- and mid-term rental management company. Field staff and vendors send photos as proof that work was done, that a part is what they say it is, or that a home is in a given condition.

You apply one standard: can a reasonable reviewer clearly verify the work from this photo, without guessing?

Judge in two stages.

STAGE A — is the photo usable at all?
Look for: out-of-focus or motion blur, resolution too low to read detail, underexposure (too dark), overexposure or blown highlights, glare or reflection covering the subject, an obstruction in front of the subject, framing that is too far away, too close, or cuts the subject off.

STAGE B — does it show what was asked for?
You are given the requirement and its criteria. Decide whether the photo satisfies that exact requirement. A technically perfect photo of the wrong thing fails.

Be practical, not precious. A slightly imperfect photo that a reviewer can plainly verify PASSES. Reject only when a reviewer would genuinely have to guess, or would have to take the sender's word for it.

Use only these reason codes:
Stage A: blurry, low_resolution, too_dark, overexposed, glare, obstructed, too_far, too_close, cut_off, motion_blur
Stage B: wrong_subject, text_unreadable, dimensions_unreadable, state_not_shown, work_not_visible, context_missing, duplicate_of_before

Reply with ONLY a JSON object, no prose and no code fence:
{
  "stage_a_pass": boolean,
  "stage_a_notes": string,
  "stage_b_pass": boolean,
  "stage_b_notes": string,
  "reason_codes": string[],
  "what_i_see": string,
  "extracted_text": string
}
"reason_codes" is empty when both stages pass. "extracted_text" holds any serial number, model number, filter size or reading you could read, or "" if none.`;

function provider() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Photo checking is not configured for this workspace.");
  return createLovableAiGatewayProvider(key);
}

async function fetchImage(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not open that photo for checking.");
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error("That photo is empty.");
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error("That photo is too large to check.");
  return buf;
}

/** Runs both stages against one image. Pure of the database — unit-testable. */
export async function runGate(input: {
  imageUrl: string;
  kind: EvidenceKind;
  label: string;
  instruction?: string | null;
  detail?: string | null;
}): Promise<GateVerdict> {
  const bytes = await fetchImage(input.imageUrl);
  const requirement = [
    `REQUIREMENT: ${input.label}`,
    `KIND: ${input.kind}`,
    `CRITERIA: ${KIND_CRITERIA[input.kind]}`,
    input.instruction ? `INSTRUCTION GIVEN TO THE SENDER: ${input.instruction}` : "",
    input.detail ? `SPECIFIC DETAIL TO CONFIRM: ${input.detail}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateText({
    model: provider()(COACH_MODEL),
    system: SYSTEM,
    maxOutputTokens: 900,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${requirement}\n\nReview the attached photo.` },
          { type: "image", image: bytes },
        ],
      },
    ],
  });

  const parsed = parseVerdict(text);
  const codes = parsed.reason_codes.filter(isReasonCode);
  const pass = parsed.stage_a_pass && parsed.stage_b_pass && codes.length === 0;

  return {
    status: pass ? "verified" : "rejected",
    reasonCodes: pass ? [] : codes.length ? codes : (["work_not_visible"] as ReasonCode[]),
    guidance: pass ? null : null,
    stageA: { pass: parsed.stage_a_pass, notes: parsed.stage_a_notes, whatISee: parsed.what_i_see },
    stageB: {
      pass: parsed.stage_b_pass,
      notes: parsed.stage_b_notes,
      extractedText: parsed.extracted_text,
    },
    evaluator: COACH_MODEL,
  };
}

type RawVerdict = {
  stage_a_pass: boolean;
  stage_a_notes: string;
  stage_b_pass: boolean;
  stage_b_notes: string;
  reason_codes: string[];
  what_i_see: string;
  extracted_text: string;
};

export function parseVerdict(text: string): RawVerdict {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  let raw: Record<string, unknown> = {};
  if (start >= 0 && end > start) {
    try {
      raw = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      raw = {};
    }
  }
  const bool = (v: unknown, fallback = false) => (typeof v === "boolean" ? v : fallback);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    stage_a_pass: bool(raw["stage_a_pass"]),
    stage_a_notes: str(raw["stage_a_notes"]),
    stage_b_pass: bool(raw["stage_b_pass"]),
    stage_b_notes: str(raw["stage_b_notes"]),
    reason_codes: Array.isArray(raw["reason_codes"])
      ? (raw["reason_codes"] as unknown[]).map((c) => String(c))
      : [],
    what_i_see: str(raw["what_i_see"]),
    extracted_text: str(raw["extracted_text"]),
  };
}

function guidanceText(codes: ReasonCode[]) {
  return [rejectionSummary(codes), ...rejectionSteps(codes)].join("\n");
}

async function logEvent(
  itemId: string | null,
  requirementId: string | null,
  event: string,
  actorId: string | null,
  detail: Record<string, unknown> = {},
) {
  const db = await admin();
  await db.from("evidence_events").insert({
    item_id: itemId,
    requirement_id: requirementId,
    event,
    actor_id: actorId,
    detail,
  } as never);
}

async function refreshRequirementStatus(requirementId: string) {
  const db = await admin();
  const { data } = await db
    .from("evidence_items")
    .select("id, status, created_at")
    .eq("requirement_id", requirementId)
    .order("created_at", { ascending: false });
  const items = (data ?? []) as { id: string; status: ItemStatus }[];

  let status: RequirementStatus = "awaiting";
  let accepted: string | null = null;
  const good = items.find((i) => i.status === "verified" || i.status === "accepted_exception");
  if (good) {
    status = good.status === "verified" ? "verified" : "accepted_exception";
    accepted = good.id;
  } else if (items.some((i) => i.status === "checking")) {
    status = "checking";
  } else if (items.length > 0) {
    status = "rejected";
  }

  const previous = await db
    .from("evidence_requirements")
    .select("subject_type, subject_id, label, status")
    .eq("id", requirementId)
    .maybeSingle();

  await db
    .from("evidence_requirements")
    .update({ status, accepted_item_id: accepted } as never)
    .eq("id", requirementId);

  // A requirement newly reaching a satisfied state is meaningful to a person
  // reading the Ticket, not just the technical evidence log — write it once,
  // on the actual transition, never on every recheck that changes nothing.
  const satisfied = status === "verified" || status === "accepted_exception";
  const wasSatisfied =
    previous.data?.status === "verified" || previous.data?.status === "accepted_exception";
  if (previous.data?.subject_type === "ticket" && satisfied && !wasSatisfied) {
    await db.from("ticket_activity").insert({
      ticket_id: previous.data.subject_id,
      author_id: null,
      kind: "evidence",
      event_type: "evidence_requirement_satisfied",
      internal: false,
      body:
        status === "accepted_exception"
          ? `Evidence exception accepted — ${previous.data.label}.`
          : `Evidence requirement satisfied — ${previous.data.label}.`,
    });
  }

  return status;
}

/* ------------------------------------------------------------------ */
/* Submission                                                          */
/* ------------------------------------------------------------------ */

/**
 * Puts one photo through the gate. Works for a Resolve upload (a stored
 * document) and for a photo that arrived from Breezeway — incoming Breezeway
 * photos must clear the same bar before they satisfy a Resolve requirement.
 */
export async function submitEvidence(
  actor: Actor,
  input: {
    requirementId: string;
    documentId?: string | null;
    externalUrl?: string | null;
    breezewayPhotoId?: number | null;
    breezewayTaskId?: number | null;
    source?: "resolve_upload" | "breezeway_photo";
  },
): Promise<{
  ok: boolean;
  itemId?: string;
  status?: ItemStatus;
  message?: string;
  guidance?: string | null;
}> {
  const db = await admin();
  const { data: reqData } = await db
    .from("evidence_requirements")
    .select(
      "id, subject_type, subject_id, property_id, label, requirement_kind, instruction, detail",
    )
    .eq("id", input.requirementId)
    .maybeSingle();
  const req = reqData as unknown as ReqRow | null;
  if (!req) return { ok: false, message: "That evidence request no longer exists." };

  const source = input.source ?? (input.documentId ? "resolve_upload" : "breezeway_photo");

  // A Breezeway photo is only ingested once per requirement.
  if (source === "breezeway_photo" && input.breezewayPhotoId) {
    const dupe = await db
      .from("evidence_items")
      .select("id, status")
      .eq("requirement_id", req.id)
      .eq("breezeway_photo_id", input.breezewayPhotoId)
      .maybeSingle();
    if (dupe.data) {
      const row = dupe.data as { id: string; status: ItemStatus };
      return { ok: true, itemId: row.id, status: row.status };
    }
  }

  const insert = await db
    .from("evidence_items")
    .insert({
      requirement_id: req.id,
      document_id: input.documentId ?? null,
      property_id: req.property_id,
      source,
      external_url: input.externalUrl ?? null,
      breezeway_photo_id: input.breezewayPhotoId ?? null,
      breezeway_task_id: input.breezewayTaskId ?? null,
      status: "checking",
      uploaded_by: actor.userId,
    } as never)
    .select("id")
    .single();
  if (insert.error) return { ok: false, message: "Could not record that photo." };
  const itemId = (insert.data as { id: string }).id;

  await refreshRequirementStatus(req.id);
  await logEvent(itemId, req.id, "submitted", actor.userId, { source });

  const url = input.documentId ? await signedUrlFor(input.documentId) : (input.externalUrl ?? null);
  if (!url) {
    await markUnchecked(itemId, req.id, "Resolve could not open the photo to check it.");
    return {
      ok: true,
      itemId,
      status: "unchecked",
      message: "Photo saved, but it could not be checked.",
    };
  }

  let verdict: GateVerdict;
  try {
    verdict = await runGate({
      imageUrl: url,
      kind: req.requirement_kind,
      label: req.label,
      instruction: req.instruction,
      detail: req.detail,
    });
  } catch {
    await markUnchecked(
      itemId,
      req.id,
      "The photo check could not run. A supervisor can review it by eye.",
    );
    return {
      ok: true,
      itemId,
      status: "unchecked",
      message: "Photo saved. The automatic check could not run, so a supervisor will review it.",
    };
  }

  const guidance = verdict.status === "rejected" ? guidanceText(verdict.reasonCodes) : null;
  await db
    .from("evidence_items")
    .update({
      status: verdict.status,
      stage_a: verdict.stageA,
      stage_b: verdict.stageB,
      reason_codes: verdict.reasonCodes,
      guidance,
      evaluator: verdict.evaluator,
      evaluated_at: new Date().toISOString(),
    } as never)
    .eq("id", itemId);

  await refreshRequirementStatus(req.id);
  await logEvent(itemId, req.id, verdict.status === "verified" ? "verified" : "rejected", null, {
    reasonCodes: verdict.reasonCodes,
    stageA: verdict.stageA,
    stageB: verdict.stageB,
  });

  return { ok: true, itemId, status: verdict.status, guidance };
}

async function markUnchecked(itemId: string, requirementId: string, note: string) {
  const db = await admin();
  await db
    .from("evidence_items")
    .update({
      status: "unchecked",
      guidance: note,
      evaluated_at: new Date().toISOString(),
    } as never)
    .eq("id", itemId);
  await refreshRequirementStatus(requirementId);
  await logEvent(itemId, requirementId, "check_unavailable", null, { note });
}

/** Re-runs the gate on a photo already on file, e.g. after a transient failure. */
export async function recheckEvidence(actor: Actor, itemId: string) {
  const db = await admin();
  const { data } = await db
    .from("evidence_items")
    .select("id, requirement_id, document_id, external_url")
    .eq("id", itemId)
    .maybeSingle();
  const item = data as {
    id: string;
    requirement_id: string | null;
    document_id: string | null;
    external_url: string | null;
  } | null;
  if (!item?.requirement_id) return { ok: false, message: "That photo is no longer on file." };

  await db
    .from("evidence_items")
    .update({ status: "checking" } as never)
    .eq("id", itemId);
  const { data: reqData } = await db
    .from("evidence_requirements")
    .select("id, label, requirement_kind, instruction, detail")
    .eq("id", item.requirement_id)
    .maybeSingle();
  const req = reqData as unknown as ReqRow | null;
  if (!req) return { ok: false, message: "That evidence request no longer exists." };

  const url = item.document_id ? await signedUrlFor(item.document_id) : item.external_url;
  if (!url) return { ok: false, message: "Resolve could not open that photo." };

  try {
    const verdict = await runGate({
      imageUrl: url,
      kind: req.requirement_kind,
      label: req.label,
      instruction: req.instruction,
      detail: req.detail,
    });
    const guidance = verdict.status === "rejected" ? guidanceText(verdict.reasonCodes) : null;
    await db
      .from("evidence_items")
      .update({
        status: verdict.status,
        stage_a: verdict.stageA,
        stage_b: verdict.stageB,
        reason_codes: verdict.reasonCodes,
        guidance,
        evaluator: verdict.evaluator,
        evaluated_at: new Date().toISOString(),
      } as never)
      .eq("id", itemId);
    await refreshRequirementStatus(req.id);
    await logEvent(itemId, req.id, "rechecked", actor.userId, { status: verdict.status });
    return { ok: true, status: verdict.status, guidance };
  } catch {
    await markUnchecked(
      itemId,
      req.id,
      "The photo check could not run. A supervisor can review it by eye.",
    );
    return { ok: false, message: "The photo check could not run just now." };
  }
}

/* ------------------------------------------------------------------ */
/* Supervisor override                                                 */
/* ------------------------------------------------------------------ */

/**
 * "Accept with exception" — a supervisor takes responsibility for a photo the
 * gate turned down. The reason is mandatory, the original rejection is kept,
 * and the audit log records who did it and when.
 */
export async function acceptWithException(actor: Actor, itemId: string, reason: string) {
  if (!actor.isSupervisor) {
    return {
      ok: false as const,
      message: "Only a supervisor can accept a photo with an exception.",
    };
  }
  const text = reason.trim();
  if (text.length < 10) {
    return {
      ok: false as const,
      message: "Write a short reason (at least a sentence) for the exception.",
    };
  }

  const db = await admin();
  const { data } = await db
    .from("evidence_items")
    .select("id, requirement_id, status, guidance, reason_codes")
    .eq("id", itemId)
    .maybeSingle();
  const item = data as {
    id: string;
    requirement_id: string | null;
    status: ItemStatus;
    guidance: string | null;
    reason_codes: string[] | null;
  } | null;
  if (!item) return { ok: false as const, message: "That photo is no longer on file." };
  if (item.status === "verified") {
    return { ok: false as const, message: "That photo already passed — no exception is needed." };
  }

  const at = new Date().toISOString();
  await db
    .from("evidence_items")
    .update({
      status: "accepted_exception",
      exception_by: actor.userId,
      exception_reason: text,
      exception_at: at,
      original_rejection:
        item.guidance ?? rejectionSummary((item.reason_codes ?? []).filter(isReasonCode)),
    } as never)
    .eq("id", itemId);

  if (item.requirement_id) await refreshRequirementStatus(item.requirement_id);
  await logEvent(itemId, item.requirement_id, "accepted_with_exception", actor.userId, {
    reason: text,
    priorStatus: item.status,
    reasonCodes: item.reason_codes ?? [],
  });
  await writeAudit({
    actorId: actor.userId,
    action: "evidence.accepted_with_exception",
    entityType: "evidence_item",
    entityId: itemId,
    entityLabel: "Photo accepted with exception",
    after: { reason: text, by: actor.name, at },
  });

  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Analytics — system quality, never staff scoring                     */
/* ------------------------------------------------------------------ */

export type EvidenceQualityStats = {
  windowDays: number;
  submitted: number;
  firstAttemptPassRate: number | null;
  verified: number;
  rejected: number;
  acceptedWithException: number;
  unchecked: number;
  medianAttemptsToPass: number | null;
  topReasons: { code: ReasonCode; label: string; count: number; share: number }[];
  bySubject: { subject: EvidenceSubject; requirements: number; satisfied: number }[];
};

/**
 * A control metric on the capture experience: when the standard is unclear or
 * the instruction is bad, first-attempt pass rate falls and one reason code
 * dominates. It is never read as a measure of an individual.
 */
export async function evidenceQualityStats(windowDays = 30): Promise<EvidenceQualityStats> {
  const db = await admin();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const { data: itemData } = await db
    .from("evidence_items")
    .select("id, requirement_id, status, reason_codes, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  const items = (itemData ?? []) as {
    id: string;
    requirement_id: string | null;
    status: ItemStatus;
    reason_codes: string[] | null;
    created_at: string;
  }[];

  const byReq = new Map<string, typeof items>();
  for (const i of items) {
    if (!i.requirement_id) continue;
    const list = byReq.get(i.requirement_id) ?? [];
    list.push(i);
    byReq.set(i.requirement_id, list);
  }

  let firstPass = 0;
  const attempts: number[] = [];
  for (const list of byReq.values()) {
    if (list[0] && list[0].status === "verified") firstPass += 1;
    const idx = list.findIndex((i) => i.status === "verified");
    if (idx >= 0) attempts.push(idx + 1);
  }
  attempts.sort((a, b) => a - b);
  const median = attempts.length
    ? attempts.length % 2
      ? attempts[(attempts.length - 1) / 2]!
      : (attempts[attempts.length / 2 - 1]! + attempts[attempts.length / 2]!) / 2
    : null;

  const counts = new Map<ReasonCode, number>();
  for (const i of items) {
    for (const c of (i.reason_codes ?? []).filter(isReasonCode)) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const totalReasons = [...counts.values()].reduce((a, b) => a + b, 0);
  const { REASON_GUIDANCE } = await import("./evidence");
  const topReasons = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, count]) => ({
      code,
      label: REASON_GUIDANCE[code].title,
      count,
      share: totalReasons ? count / totalReasons : 0,
    }));

  const { data: reqData } = await db
    .from("evidence_requirements")
    .select("subject_type, status")
    .gte("created_at", since);
  const reqs = (reqData ?? []) as { subject_type: EvidenceSubject; status: RequirementStatus }[];
  const subjects = new Map<EvidenceSubject, { requirements: number; satisfied: number }>();
  for (const r of reqs) {
    const entry = subjects.get(r.subject_type) ?? { requirements: 0, satisfied: 0 };
    entry.requirements += 1;
    if (r.status === "verified" || r.status === "accepted_exception") entry.satisfied += 1;
    subjects.set(r.subject_type, entry);
  }

  return {
    windowDays,
    submitted: items.length,
    firstAttemptPassRate: byReq.size ? firstPass / byReq.size : null,
    verified: items.filter((i) => i.status === "verified").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    acceptedWithException: items.filter((i) => i.status === "accepted_exception").length,
    unchecked: items.filter((i) => i.status === "unchecked").length,
    medianAttemptsToPass: median,
    topReasons,
    bySubject: [...subjects.entries()].map(([subject, v]) => ({ subject, ...v })),
  };
}
