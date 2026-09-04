/**
 * Transitional Breezeway Work Order read model + lifecycle (server-only).
 *
 * Boundary rules that must not drift:
 *   - Resolve is the operational source of truth. A Breezeway status change
 *     never rewrites a Resolve Ticket; it only updates the mirrored Work Order
 *     and may raise attention on a linked Ticket's activity.
 *   - Only properties whose mapping state is `verified` are read or written.
 *   - Only CURRENT work is mirrored. Closed/approved Breezeway history is not
 *     imported: this is an operating view, not an archive.
 *   - A Breezeway comment never creates a Ticket. It attaches to the existing
 *     Work Order and, when one exists, the linked Ticket's activity.
 */
import { BreezewayError, breezewayRequest } from "./breezeway.server";
import {
  propertyForHomeId,
  propertyWriteEligibility,
  verifiedHomeIds,
} from "./breezeway-mapping.server";
import {
  isCurrentWorkOrder,
  type BreezewayWorkOrder,
  type BreezewayWorkOrderComment,
  type BreezewayWorkOrderPhoto,
} from "./breezeway-workorders";
import { BREEZEWAY_OUTBOUND_FLAG } from "./breezeway-outbound";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const SELECT =
  "id, breezeway_task_id, property_id, breezeway_home_id, name, description, department, priority, status, stage, scheduled_date, scheduled_time, assignees, photo_count, comment_count, linked_ticket_id, needs_attention, breezeway_created_at, breezeway_updated_at, last_synced_at";

type Row = {
  id: string;
  breezeway_task_id: number;
  property_id: string | null;
  breezeway_home_id: string;
  name: string | null;
  description: string | null;
  department: string | null;
  priority: string | null;
  status: string | null;
  stage: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  assignees: unknown;
  photo_count: number;
  comment_count: number;
  linked_ticket_id: string | null;
  needs_attention: boolean;
  breezeway_created_at: string | null;
  breezeway_updated_at: string | null;
  last_synced_at: string;
};

function toWorkOrder(row: Row, propertyName: string | null = null): BreezewayWorkOrder {
  return {
    id: row.id,
    breezewayTaskId: row.breezeway_task_id,
    propertyId: row.property_id,
    propertyName,
    breezewayHomeId: row.breezeway_home_id,
    name: row.name,
    description: row.description,
    department: row.department,
    priority: row.priority,
    status: row.status,
    stage: row.stage,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    assignees: Array.isArray(row.assignees)
      ? (row.assignees as { name?: string | null; status?: string | null }[]).map((a) => ({
          name: a?.name ?? null,
          status: a?.status ?? null,
        }))
      : [],
    photoCount: row.photo_count,
    commentCount: row.comment_count,
    linkedTicketId: row.linked_ticket_id,
    needsAttention: row.needs_attention,
    breezewayCreatedAt: row.breezeway_created_at,
    breezewayUpdatedAt: row.breezeway_updated_at,
    lastSyncedAt: row.last_synced_at,
    source: "breezeway",
  };
}

/* ------------------------------------------------------------------ */
/* Raw task shape                                                      */
/* ------------------------------------------------------------------ */

type RawTask = {
  id: number;
  name?: string | null;
  description?: string | null;
  home_id?: number | null;
  type_department?: string | null;
  type_priority?: string | null;
  type_task_status?: { code?: string | null; name?: string | null; stage?: string | null } | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  assignments?:
    { id?: number; name?: string | null; type_task_user_status?: string | null }[] | null;
  photos?: unknown[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  modified_at?: string | null;
};

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/* ------------------------------------------------------------------ */
/* Read / sync                                                         */
/* ------------------------------------------------------------------ */

/**
 * Mirrors CURRENT Breezeway work orders for one verified property.
 * Read-only against Breezeway; nothing is written back and no Ticket is made.
 */
export async function syncPropertyWorkOrders(
  propertyId: string,
): Promise<{ ok: boolean; message?: string; synced: number; removed: number }> {
  const gate = await propertyWriteEligibility(propertyId);
  if (!gate.homeId || gate.state !== "verified") {
    return {
      ok: false,
      message: gate.reason ?? "This property is not verified against Breezeway.",
      synced: 0,
      removed: 0,
    };
  }

  let tasks: RawTask[] = [];
  let page = 1;
  let pages = 1;
  try {
    do {
      const data = await breezewayRequest<{ results?: RawTask[]; total_pages?: number }>("/task/", {
        params: { home_id: gate.homeId, limit: 100, page },
      });
      pages = data.total_pages || 1;
      tasks.push(...(data.results ?? []));
      page += 1;
    } while (page <= pages && page <= 5);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof BreezewayError
          ? `Breezeway refused the read (${error.status}).`
          : "Could not reach Breezeway.",
      synced: 0,
      removed: 0,
    };
  }

  // Current work only — no historical dump.
  tasks = tasks.filter((t) =>
    isCurrentWorkOrder(t.type_task_status?.stage ?? null, t.type_task_status?.code ?? null),
  );

  const db = await admin();
  const now = new Date().toISOString();
  for (const t of tasks) {
    await db.from("breezeway_work_orders").upsert(
      {
        breezeway_task_id: t.id,
        property_id: propertyId,
        breezeway_home_id: String(gate.homeId),
        name: t.name ?? null,
        description: t.description ?? null,
        department: t.type_department ?? null,
        priority: t.type_priority ?? null,
        status: t.type_task_status?.name ?? t.type_task_status?.code ?? null,
        stage: t.type_task_status?.stage ?? t.type_task_status?.code ?? null,
        scheduled_date: t.scheduled_date ?? null,
        scheduled_time: t.scheduled_time ?? null,
        assignees: (t.assignments ?? []).map((a) => ({
          name: a?.name ?? null,
          status: a?.type_task_user_status ?? null,
        })),
        photo_count: Array.isArray(t.photos) ? t.photos.length : 0,
        breezeway_created_at: normalizeDate(t.created_at),
        breezeway_updated_at: normalizeDate(t.updated_at ?? t.modified_at),
        last_synced_at: now,
      } as never,
      { onConflict: "breezeway_task_id" },
    );
  }

  // Anything mirrored earlier that is no longer current drops out of the view.
  const keep = tasks.map((t) => t.id);
  const stale = await db
    .from("breezeway_work_orders")
    .delete()
    .eq("property_id", propertyId)
    .is("linked_ticket_id", null)
    .not("breezeway_task_id", "in", `(${keep.length ? keep.join(",") : "0"})`)
    .select("id");

  return { ok: true, synced: tasks.length, removed: (stale.data ?? []).length };
}

/** Mirrored current work orders for one property. Never calls Breezeway. */
export async function listPropertyWorkOrders(propertyId: string): Promise<BreezewayWorkOrder[]> {
  const db = await admin();
  const { data, error } = await db
    .from("breezeway_work_orders")
    .select(SELECT)
    .eq("property_id", propertyId)
    .order("scheduled_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error("Could not read the Breezeway work orders.");
  return ((data ?? []) as unknown as Row[]).map((r) => toWorkOrder(r));
}

export async function getWorkOrder(workOrderId: string): Promise<BreezewayWorkOrder | null> {
  const db = await admin();
  const { data } = await db
    .from("breezeway_work_orders")
    .select(SELECT)
    .eq("id", workOrderId)
    .maybeSingle();
  const row = data as unknown as Row | null;
  return row ? toWorkOrder(row) : null;
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

type RawComment = {
  id?: number;
  comment?: string | null;
  created_at?: string | null;
  author?: string | null;
};

/**
 * Pulls Breezeway comments for one mirrored work order and deduplicates them
 * on the external comment id. A comment never creates a Ticket.
 */
export async function syncWorkOrderComments(
  workOrderId: string,
): Promise<{ ok: boolean; message?: string; added: number; total: number }> {
  const wo = await getWorkOrder(workOrderId);
  if (!wo) return { ok: false, message: "That work order is not in Resolve.", added: 0, total: 0 };

  let raw: RawComment[] = [];
  try {
    const data = await breezewayRequest<RawComment[] | { results?: RawComment[] }>(
      `/task/${wo.breezewayTaskId}/comments`,
    );
    raw = Array.isArray(data) ? data : (data.results ?? []);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof BreezewayError
          ? `Breezeway refused the comment read (${error.status}).`
          : "Could not reach Breezeway.",
      added: 0,
      total: 0,
    };
  }

  const db = await admin();
  let added = 0;
  for (const c of raw) {
    const body = (c.comment ?? "").trim();
    if (!body) continue;
    const insert = await db.from("breezeway_work_order_comments").insert({
      work_order_id: wo.id,
      breezeway_task_id: wo.breezewayTaskId,
      breezeway_comment_id: typeof c.id === "number" ? c.id : null,
      // Breezeway's public comment payload carries no author identity; any
      // named person appears inline in the body as a mention.
      author: c.author ?? null,
      body,
      commented_at: normalizeDate(c.created_at),
      direction: "inbound",
    } as never);
    if (!insert.error) added += 1;
    // 23505 = already mirrored. Deduplication, not an error.
  }

  const { count } = await db
    .from("breezeway_work_order_comments")
    .select("id", { count: "exact", head: true })
    .eq("work_order_id", wo.id);
  await db
    .from("breezeway_work_orders")
    .update({ comment_count: count ?? 0, needs_attention: added > 0 ? true : undefined } as never)
    .eq("id", wo.id);

  return { ok: true, added, total: count ?? 0 };
}

export async function listWorkOrderComments(
  workOrderId: string,
): Promise<BreezewayWorkOrderComment[]> {
  const db = await admin();
  const { data } = await db
    .from("breezeway_work_order_comments")
    .select(
      "id, breezeway_comment_id, author, body, commented_at, direction, resolve_author_name, identity_mode, delivery_state, delivery_error, posted_at",
    )
    .eq("work_order_id", workOrderId)
    .order("commented_at", { ascending: true, nullsFirst: true });
  return (
    (data ?? []) as unknown as {
      id: string;
      breezeway_comment_id: number | null;
      author: string | null;
      body: string;
      commented_at: string | null;
      direction: "inbound" | "outbound";
      resolve_author_name: string | null;
      identity_mode: string | null;
      delivery_state: "mirrored" | "sending" | "delivered" | "failed";
      delivery_error: string | null;
      posted_at: string | null;
    }[]
  ).map((c) => ({
    id: c.id,
    breezewayCommentId: c.breezeway_comment_id,
    author: c.author,
    body: c.body,
    commentedAt: c.commented_at,
    direction: c.direction,
    resolveAuthorName: c.resolve_author_name,
    identityMode: (c.identity_mode as "staff" | "integration" | null) ?? null,
    deliveryState: c.delivery_state,
    deliveryError: c.delivery_error,
    postedAt: c.posted_at,
  }));
}

/**
 * Posts a reply as a Breezeway task comment. Documented endpoint:
 *   POST /task/{task_id}/comments  { comment, company_people_id }
 *
 * Identity is deterministic (see breezeway-people.server): the staff member's
 * own Breezeway person when one exists, otherwise the shared ARHA Resolve
 * integration identity with their name in the body. Resolve never posts under
 * an unrelated colleague's account.
 *
 * The row is written BEFORE the call, in `sending`, and settled afterwards, so
 * a reply that half-succeeded is visible rather than lost. The returning
 * webhook reconciles on the external comment id, so nothing is mirrored twice.
 */
export async function replyToWorkOrder(
  workOrderId: string,
  body: string,
  authorLabel: string,
  authorUserId: string,
): Promise<{ ok: boolean; message?: string; identityMode?: "staff" | "integration" }> {
  const wo = await getWorkOrder(workOrderId);
  if (!wo) return { ok: false, message: "That work order is not in Resolve." };
  if (!(await outboundEnabled()))
    return { ok: false, message: "Breezeway writes are switched off." };
  if (!wo.propertyId) return { ok: false, message: "That work order has no Resolve property." };
  const gate = await propertyWriteEligibility(wo.propertyId);
  if (!gate.eligible) return { ok: false, message: gate.reason ?? "Property not eligible." };

  const text = body.trim().slice(0, 4000);
  if (!text) return { ok: false, message: "Write something first." };

  const { commentIdentityFor } = await import("./breezeway-people.server");
  const identity = await commentIdentityFor(authorUserId);
  if (!identity.ok) return { ok: false, message: identity.message };

  // Under the shared identity the person's name has to be in the text, or the
  // Breezeway thread cannot tell who is speaking.
  const outbound = identity.mode === "staff" ? text : `${authorLabel} (ARHA Resolve): ${text}`;

  const db = await admin();
  const startedAt = new Date().toISOString();
  const pending = await db
    .from("breezeway_work_order_comments")
    .insert({
      work_order_id: wo.id,
      breezeway_task_id: wo.breezewayTaskId,
      author: authorLabel,
      body: text,
      commented_at: startedAt,
      direction: "outbound",
      source: "resolve",
      resolve_author_id: authorUserId,
      resolve_author_name: authorLabel,
      breezeway_person_id: identity.peopleId,
      identity_mode: identity.mode,
      delivery_state: "sending",
    } as never)
    .select("id")
    .single();
  const rowId = (pending.data as { id: string } | null)?.id ?? null;

  try {
    const created = await breezewayRequest<{ id?: number }>(
      `/task/${wo.breezewayTaskId}/comments`,
      {
        method: "POST",
        allowWrite: true,
        retry: false,
        body: { comment: outbound, company_people_id: identity.peopleId },
      },
    );
    if (rowId) {
      await db
        .from("breezeway_work_order_comments")
        .update({
          breezeway_comment_id: typeof created?.id === "number" ? created.id : null,
          delivery_state: "delivered",
          posted_at: new Date().toISOString(),
        } as never)
        .eq("id", rowId);
    }
    return { ok: true, identityMode: identity.mode };
  } catch (error) {
    const message =
      error instanceof BreezewayError
        ? `Breezeway refused the comment (${error.status}).`
        : "Could not reach Breezeway.";
    if (rowId) {
      await db
        .from("breezeway_work_order_comments")
        .update({ delivery_state: "failed", delivery_error: message } as never)
        .eq("id", rowId);
    }
    return { ok: false, message };
  }
}

/* ------------------------------------------------------------------ */
/* Photos                                                             */
/* ------------------------------------------------------------------ */

type RawPhoto = {
  id?: number;
  url?: string | null;
  photo_url?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  caption?: string | null;
  description?: string | null;
  type?: string | null;
  photo_type?: string | null;
  created_by?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
};

function photoUrl(p: RawPhoto) {
  return p.url ?? p.photo_url ?? p.image_url ?? p.thumbnail_url ?? null;
}

/**
 * Mirrors the photos on one work order. Breezeway returns them on the task
 * payload (`GET /task/{id}`), so this is the per-task read rather than a
 * portfolio sweep — Operations opens a work order, and its photos are there.
 *
 * Uploading INTO Breezeway IS available and implemented below in
 * `uploadWorkOrderPhoto` (multipart POST /task/{id}/photos). An earlier audit
 * concluded otherwise only because the shared helper could send JSON alone.
 */
export async function syncWorkOrderPhotos(
  workOrderId: string,
): Promise<{ ok: boolean; message?: string; photos: number }> {
  const wo = await getWorkOrder(workOrderId);
  if (!wo) return { ok: false, message: "That work order is not in Resolve.", photos: 0 };

  let raw: RawPhoto[] = [];
  try {
    const task = await breezewayRequest<{ photos?: RawPhoto[] | null }>(
      `/task/${wo.breezewayTaskId}`,
    );
    raw = (task.photos ?? []).filter((p): p is RawPhoto => Boolean(p));
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof BreezewayError
          ? `Breezeway refused the photo read (${error.status}).`
          : "Could not reach Breezeway.",
      photos: 0,
    };
  }

  const db = await admin();
  const now = new Date().toISOString();
  let kept = 0;
  let writeError: string | null = null;
  for (const p of raw) {
    const url = photoUrl(p);
    if (!url) continue;
    kept += 1;
    if (typeof p.id === "number") {
      const up = await db.from("breezeway_work_order_photos").upsert(
        {
          work_order_id: wo.id,
          breezeway_task_id: wo.breezewayTaskId,
          breezeway_photo_id: p.id,
          property_id: wo.propertyId,
          url,
          caption: p.caption ?? p.description ?? null,
          photo_type: p.photo_type ?? p.type ?? null,
          uploader: p.created_by ?? p.uploaded_by ?? null,
          breezeway_created_at: normalizeDate(p.created_at),
          source: "breezeway",
          last_synced_at: now,
        } as never,
        { onConflict: "breezeway_photo_id" },
      );
      if (up.error && !writeError) writeError = up.error.message;
    } else {
      const existing = await db
        .from("breezeway_work_order_photos")
        .select("id")
        .eq("work_order_id", wo.id)
        .eq("url", url)
        .maybeSingle();
      if (!existing.data) {
        await db.from("breezeway_work_order_photos").insert({
          work_order_id: wo.id,
          breezeway_task_id: wo.breezewayTaskId,
          property_id: wo.propertyId,
          url,
          caption: p.caption ?? p.description ?? null,
          photo_type: p.photo_type ?? p.type ?? null,
          uploader: p.created_by ?? p.uploaded_by ?? null,
          breezeway_created_at: normalizeDate(p.created_at),
          source: "breezeway",
          last_synced_at: now,
        } as never);
      }
    }
  }

  await db
    .from("breezeway_work_orders")
    .update({ photo_count: kept } as never)
    .eq("id", wo.id);
  if (writeError) {
    return { ok: false, message: `Photos could not be stored: ${writeError}`, photos: 0 };
  }
  return { ok: true, photos: kept };
}

/* ------------------------------------------------------------------ */
/* Photo upload (Resolve -> Breezeway)                                 */
/* ------------------------------------------------------------------ */

export const BREEZEWAY_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const BREEZEWAY_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

type UploadResult =
  | { ok: true; photoId: number | null; url: string | null; includeInTaskReport: boolean }
  | { ok: false; message: string };

/**
 * Uploads ONE photo to the Breezeway task behind a mirrored work order.
 *
 * Confirmed by Breezeway and verified live against our own account:
 *   POST /public/inventory/v1/task/{task_id}/photos
 *   multipart/form-data, field `file`, optional `include_in_task_report`
 *   -> 2xx { id, url, include_in_task_report }
 *
 * The Breezeway task id is never taken from the client: the caller passes a
 * Resolve work-order UUID, and the task id, property and write eligibility are
 * all read server-side. `include_in_task_report` defaults to false — it is only
 * ever true when a staff member explicitly ticks the box.
 *
 * Non-idempotent (Breezeway exposes no photo delete), so `retry: false`: a
 * retried 5xx would leave two copies on a real task with no way to remove one.
 */
export async function uploadWorkOrderPhoto(
  workOrderId: string,
  file: { name: string; type: string; bytes: ArrayBuffer },
  includeInTaskReport: boolean,
  actorLabel: string,
): Promise<UploadResult> {
  const wo = await getWorkOrder(workOrderId);
  if (!wo) return { ok: false, message: "That work order is not in Resolve." };
  if (!(await outboundEnabled()))
    return { ok: false, message: "Breezeway writes are switched off." };
  if (!wo.propertyId) return { ok: false, message: "That work order has no Resolve property." };
  if (!wo.breezewayTaskId) return { ok: false, message: "That work order has no Breezeway task." };
  const gate = await propertyWriteEligibility(wo.propertyId);
  if (!gate.eligible)
    return { ok: false, message: gate.reason ?? "Property not eligible for Breezeway writes." };

  const size = file.bytes.byteLength;
  if (size === 0) return { ok: false, message: "That file is empty." };
  if (size > BREEZEWAY_PHOTO_MAX_BYTES) {
    return { ok: false, message: "That photo is larger than 15 MB. Resize it and try again." };
  }
  if (!BREEZEWAY_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, message: "Breezeway accepts JPEG, PNG, WebP and HEIC photos only." };
  }

  const form = new FormData();
  form.append("file", new Blob([file.bytes], { type: file.type }), file.name || "photo.jpg");
  // Only ever "true" on an explicit staff choice; the API takes the string form.
  form.append("include_in_task_report", includeInTaskReport ? "true" : "false");

  let created: { id?: number; url?: string | null; include_in_task_report?: boolean };
  try {
    created = await breezewayRequest<{
      id?: number;
      url?: string | null;
      include_in_task_report?: boolean;
    }>(`/task/${wo.breezewayTaskId}/photos`, {
      method: "POST",
      allowWrite: true,
      retry: false,
      form,
    });
  } catch (error) {
    const message =
      error instanceof BreezewayError
        ? error.status === 422
          ? "Breezeway rejected that image. Use a standard JPEG or PNG photo."
          : `Breezeway refused the upload (${error.status}).`
        : "Could not reach Breezeway. The photo was not uploaded.";
    return { ok: false, message };
  }

  const photoId = typeof created?.id === "number" ? created.id : null;
  const url = created?.url ?? null;
  const included = created?.include_in_task_report === true;

  // Mirror straight away so the existing photo view shows it without a refresh.
  if (url) {
    const db = await admin();
    await db.from("breezeway_work_order_photos").upsert(
      {
        work_order_id: wo.id,
        breezeway_task_id: wo.breezewayTaskId,
        breezeway_photo_id: photoId,
        property_id: wo.propertyId,
        url,
        caption: null,
        photo_type: file.type,
        uploader: actorLabel,
        breezeway_created_at: new Date().toISOString(),
        source: "resolve",
        last_synced_at: new Date().toISOString(),
      } as never,
      photoId ? { onConflict: "breezeway_photo_id" } : undefined,
    );
    const { count } = await db
      .from("breezeway_work_order_photos")
      .select("id", { count: "exact", head: true })
      .eq("work_order_id", wo.id);
    await db
      .from("breezeway_work_orders")
      .update({ photo_count: count ?? 0 } as never)
      .eq("id", wo.id);
  }

  return { ok: true, photoId, url, includeInTaskReport: included };
}

export async function listWorkOrderPhotos(workOrderId: string): Promise<BreezewayWorkOrderPhoto[]> {
  const db = await admin();
  const { data } = await db
    .from("breezeway_work_order_photos")
    .select(
      "id, breezeway_photo_id, url, caption, photo_type, uploader, breezeway_created_at, source, evidence_item_id",
    )
    .eq("work_order_id", workOrderId)
    .order("breezeway_created_at", { ascending: true, nullsFirst: true });
  return (
    (data ?? []) as unknown as {
      id: string;
      breezeway_photo_id: number | null;
      url: string;
      caption: string | null;
      photo_type: string | null;
      uploader: string | null;
      breezeway_created_at: string | null;
      source: "breezeway" | "resolve";
      evidence_item_id: string | null;
    }[]
  ).map((p) => ({
    id: p.id,
    breezewayPhotoId: p.breezeway_photo_id,
    url: p.url,
    caption: p.caption,
    photoType: p.photo_type,
    uploader: p.uploader,
    takenAt: p.breezeway_created_at,
    source: p.source,
    evidenceItemId: p.evidence_item_id,
  }));
}

/**
 * Sends one mirrored Breezeway photo through the Evidence Quality Gate. An
 * incoming photo does not satisfy a Resolve requirement just because Breezeway
 * accepted it — it clears the same bar as anything captured in Resolve.
 */
export async function checkBreezewayPhotoAsEvidence(
  actor: { userId: string; name: string; isSupervisor: boolean },
  photoId: string,
  requirementId: string,
) {
  const db = await admin();
  const { data } = await db
    .from("breezeway_work_order_photos")
    .select("id, url, breezeway_photo_id, breezeway_task_id")
    .eq("id", photoId)
    .maybeSingle();
  const photo = data as {
    id: string;
    url: string;
    breezeway_photo_id: number | null;
    breezeway_task_id: number;
  } | null;
  if (!photo) return { ok: false as const, message: "That photo is no longer mirrored." };

  const { submitEvidence } = await import("./evidence.server");
  const res = await submitEvidence(actor, {
    requirementId,
    externalUrl: photo.url,
    breezewayPhotoId: photo.breezeway_photo_id,
    breezewayTaskId: photo.breezeway_task_id,
    source: "breezeway_photo",
  });
  if (res.ok && res.itemId) {
    await db
      .from("breezeway_work_order_photos")
      .update({ evidence_item_id: res.itemId } as never)
      .eq("id", photo.id);
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

async function outboundEnabled() {
  const db = await admin();
  const { data } = await db
    .from("feature_flags")
    .select("enabled")
    .eq("key", BREEZEWAY_OUTBOUND_FLAG)
    .maybeSingle();
  return Boolean((data as { enabled: boolean } | null)?.enabled);
}

async function guard(workOrderId: string) {
  const wo = await getWorkOrder(workOrderId);
  if (!wo) return { error: "That work order is not in Resolve." as const };
  if (!(await outboundEnabled())) return { error: "Breezeway writes are switched off." as const };
  if (!wo.propertyId) return { error: "That work order has no Resolve property." as const };
  const gate = await propertyWriteEligibility(wo.propertyId);
  if (!gate.eligible) return { error: gate.reason ?? "Property not eligible." };
  return { wo };
}

export type LifecycleResult = { ok: boolean; message?: string };

/** PATCH /task/{id} — name is required by Breezeway on every update. */
export async function updateWorkOrder(
  workOrderId: string,
  patch: {
    name?: string;
    description?: string;
    department?: string;
    priority?: string;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
  },
): Promise<LifecycleResult> {
  const g = await guard(workOrderId);
  if ("error" in g) return { ok: false, message: g.error };
  const wo = g.wo!;
  const name = (patch.name ?? wo.name ?? "").trim();
  if (!name) return { ok: false, message: "A work order needs a name." };
  try {
    await breezewayRequest(`/task/${wo.breezewayTaskId}`, {
      method: "PATCH",
      allowWrite: true,
      retry: false,
      body: {
        name,
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.department ? { type_department: patch.department } : {}),
        ...(patch.priority ? { type_priority: patch.priority } : {}),
        ...(patch.scheduledDate ? { scheduled_date: patch.scheduledDate } : {}),
        ...(patch.scheduledTime ? { scheduled_time: patch.scheduledTime } : {}),
      },
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof BreezewayError
          ? `Breezeway refused the update (${error.status}).`
          : "Could not reach Breezeway.",
    };
  }
  await refreshWorkOrder(wo.breezewayTaskId);
  return { ok: true };
}

async function lifecycleAction(
  workOrderId: string,
  action: "close" | "reopen" | "approve",
  body?: unknown,
): Promise<LifecycleResult> {
  const g = await guard(workOrderId);
  if ("error" in g) return { ok: false, message: g.error };
  const wo = g.wo!;
  try {
    await breezewayRequest(`/task/${wo.breezewayTaskId}/${action}`, {
      method: "POST",
      allowWrite: true,
      retry: false,
      ...(body === undefined ? {} : { body }),
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof BreezewayError
          ? `Breezeway refused the ${action} (${error.status}).`
          : "Could not reach Breezeway.",
    };
  }
  await refreshWorkOrder(wo.breezewayTaskId);
  return { ok: true };
}

/**
 * Closes the Breezeway Work Order only. The linked Resolve Ticket keeps its own
 * closure requirements — Breezeway never closes Resolve work.
 */
export function closeWorkOrder(workOrderId: string) {
  return lifecycleAction(workOrderId, "close");
}

export function reopenWorkOrder(workOrderId: string, notifyAssignees = false) {
  return lifecycleAction(workOrderId, "reopen", { notify_assignees: notifyAssignees });
}

export function approveWorkOrder(workOrderId: string) {
  return lifecycleAction(workOrderId, "approve");
}

/** Re-reads one task from Breezeway and refreshes the mirror. */
export async function refreshWorkOrder(
  breezewayTaskId: number,
): Promise<BreezewayWorkOrder | null> {
  let raw: RawTask | null = null;
  try {
    raw = await breezewayRequest<RawTask>(`/task/${breezewayTaskId}`);
  } catch {
    return null;
  }
  if (!raw || typeof raw.id !== "number") return null;
  const property = raw.home_id != null ? await propertyForHomeId(raw.home_id) : null;
  const db = await admin();
  const { data } = await db
    .from("breezeway_work_orders")
    .upsert(
      {
        breezeway_task_id: raw.id,
        property_id: property?.id ?? null,
        breezeway_home_id: String(raw.home_id ?? ""),
        name: raw.name ?? null,
        description: raw.description ?? null,
        department: raw.type_department ?? null,
        priority: raw.type_priority ?? null,
        status: raw.type_task_status?.name ?? raw.type_task_status?.code ?? null,
        stage: raw.type_task_status?.stage ?? raw.type_task_status?.code ?? null,
        scheduled_date: raw.scheduled_date ?? null,
        scheduled_time: raw.scheduled_time ?? null,
        assignees: (raw.assignments ?? []).map((a) => ({
          name: a?.name ?? null,
          status: a?.type_task_user_status ?? null,
        })),
        photo_count: Array.isArray(raw.photos) ? raw.photos.length : 0,
        breezeway_created_at: normalizeDate(raw.created_at),
        breezeway_updated_at: normalizeDate(raw.updated_at ?? raw.modified_at),
        last_synced_at: new Date().toISOString(),
      } as never,
      { onConflict: "breezeway_task_id" },
    )
    .select(SELECT)
    .maybeSingle();
  const row = data as unknown as Row | null;
  return row ? toWorkOrder(row) : null;
}

/**
 * Deliberate escalation: turn a Breezeway-originated Work Order into a Resolve
 * Ticket. Never automatic — a mirrored work order or a vendor comment on its
 * own is not a Ticket.
 */
export async function linkWorkOrderToTicket(
  workOrderId: string,
  ticketId: string,
): Promise<LifecycleResult> {
  const db = await admin();
  const { error } = await db
    .from("breezeway_work_orders")
    .update({ linked_ticket_id: ticketId, needs_attention: false } as never)
    .eq("id", workOrderId);
  if (error) return { ok: false, message: "Could not link that work order to the ticket." };
  return { ok: true };
}

/** Clears the attention flag once Operations has read the new activity. */
export async function acknowledgeWorkOrder(workOrderId: string): Promise<LifecycleResult> {
  const db = await admin();
  const { error } = await db
    .from("breezeway_work_orders")
    .update({ needs_attention: false } as never)
    .eq("id", workOrderId);
  return error ? { ok: false, message: "Could not update that work order." } : { ok: true };
}

/** Staged portfolio read. Bounded per pass so a portfolio sync is never a burst. */
export async function syncVerifiedPortfolio(limit = 10) {
  const homeIds = await verifiedHomeIds();
  const db = await admin();
  const { data } = await db
    .from("properties")
    .select("id")
    .eq("breezeway_mapping_state", "verified")
    .order("breezeway_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  let synced = 0;
  for (const p of (data ?? []) as { id: string }[]) {
    const res = await syncPropertyWorkOrders(p.id);
    if (res.ok) synced += res.synced;
    await db
      .from("properties")
      .update({ breezeway_synced_at: new Date().toISOString() })
      .eq("id", p.id);
  }
  return { properties: (data ?? []).length, verifiedHomes: homeIds.length, synced };
}
