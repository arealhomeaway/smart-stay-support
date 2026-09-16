/**
 * Server-only file handling for Resolve attachments.
 *
 * Every rule below is enforced here, on the server, with the service-role
 * client — the interface only ever reflects a decision this module already
 * made. No file is ever public: uploads use a short-lived signed upload
 * token minted only after the caller is checked, and every view or download
 * is a short-lived signed link minted the same way.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { writeAudit } from "@/lib/audit.server";
import {
  ATTACHMENT_BUCKET,
  type AttachmentEntity,
  type AttachmentVisibility,
  kindFor,
  storagePathFor,
  validateFile,
} from "@/lib/attachments";

type Client = SupabaseClient<Database>;

const SIGNED_URL_SECONDS = 300;
const UPLOAD_TOKEN_SECONDS = 900;

export type Viewer = { userId: string; roles: string[] };

export type AttachmentRow = {
  id: string;
  title: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
  visibility: string;
  requested_from: string | null;
  upload_status: string;
  uploaded_by: string | null;
  uploaded_at: string | null;
  entity_type: string;
  entity_id: string;
  property_id: string | null;
  note: string | null;
  category?: string | null;
  created_at: string;
};

const STAFF_ROLES = ["admin", "manager", "onboarding", "tech"];

export function isStaff(viewer: Viewer) {
  return viewer.roles.some((r) => STAFF_ROLES.includes(r));
}
export function isSupervisor(viewer: Viewer) {
  return viewer.roles.some((r) => r === "admin" || r === "manager");
}

/** Reads the caller's roles once, from their own RLS client. */
export async function loadViewer(supabase: Client, userId: string): Promise<Viewer> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Could not confirm your access level.");
  return { userId, roles: (data ?? []).map((r) => r.role as string) };
}

/* ------------------------------------------------------------------ */
/* Pure decisions — unit-tested without a database                     */
/* ------------------------------------------------------------------ */

export type Decision = { allow: true } | { allow: false; reason: string };

const DENY_UNRELATED = "You do not have access to this record.";

/** Who may see a single stored file. */
export function canView(viewer: Viewer, row: AttachmentRow, ownerOfProperty: boolean): Decision {
  if (isStaff(viewer)) return { allow: true };
  if (!ownerOfProperty) return { allow: false, reason: DENY_UNRELATED };
  if (row.visibility === "owner_shared" || row.requested_from === "owner") return { allow: true };
  return { allow: false, reason: "This file has not been shared with you." };
}

/** Who may attach a new file to a record. */
export function canUpload(
  viewer: Viewer,
  ctx: { ownerOfProperty: boolean; requestSlotOpen: boolean; recordClosed: boolean },
): Decision {
  if (isStaff(viewer)) {
    if (ctx.recordClosed && !isSupervisor(viewer)) {
      return {
        allow: false,
        reason: "This record is closed. A supervisor can still add a file to it.",
      };
    }
    return { allow: true };
  }
  if (!ctx.ownerOfProperty) return { allow: false, reason: DENY_UNRELATED };
  if (!ctx.requestSlotOpen) {
    return { allow: false, reason: "Your coordinator has not requested a document here." };
  }
  return { allow: true };
}

/** Who may remove a file. Owners never remove; staff remove their own; supervisors remove any. */
export function canDelete(viewer: Viewer, row: AttachmentRow): Decision {
  if (isSupervisor(viewer)) return { allow: true };
  if (isStaff(viewer) && row.uploaded_by === viewer.userId) return { allow: true };
  if (isStaff(viewer))
    return {
      allow: false,
      reason: "Only the person who uploaded this, or a supervisor, can remove it.",
    };
  return { allow: false, reason: DENY_UNRELATED };
}

/** Only staff decide what an owner sees. */
export function canChangeVisibility(viewer: Viewer): Decision {
  return isStaff(viewer) ? { allow: true } : { allow: false, reason: DENY_UNRELATED };
}

/* ------------------------------------------------------------------ */
/* Record lookup                                                       */
/* ------------------------------------------------------------------ */

type RecordInfo = { propertyId: string | null; closed: boolean; label: string; isDemo: boolean };

async function loadRecord(
  supabaseAdmin: Client,
  viewer: Viewer,
  entityType: AttachmentEntity,
  entityId: string,
): Promise<RecordInfo> {
  if (entityType === "property") {
    const { data, error } = await supabaseAdmin
      .from("properties")
      .select("id, name, is_demo")
      .eq("id", entityId)
      .maybeSingle();
    if (error || !data) throw new Error("That property could not be found.");
    // A home is never "closed" — property records stay open for the life of the home.
    return { propertyId: data.id, closed: false, label: data.name, isDemo: data.is_demo };
  }
  if (entityType === "ticket") {
    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select("id, ref, title, property_id, status, archived_at, is_demo")
      .eq("id", entityId)
      .maybeSingle();
    if (error || !data) throw new Error("That ticket could not be found.");
    return {
      propertyId: data.property_id,
      closed: data.status === "closed" || data.archived_at != null,
      // Sharing a file does not also authorize the Ticket's internal narrative.
      label: isStaff(viewer)
        ? `ARHA-${data.ref} ${data.title}`
        : `Property work · Ticket #${data.ref}`,
      isDemo: data.is_demo,
    };
  }
  const { data, error } = await supabaseAdmin
    .from("onboarding_tasks")
    .select("id, title, property_id, status, archived_at, is_demo")
    .eq("id", entityId)
    .maybeSingle();
  if (error || !data) throw new Error("That onboarding task could not be found.");
  return {
    propertyId: data.property_id,
    closed: data.status === "complete" || data.archived_at != null,
    label: data.title,
    isDemo: data.is_demo,
  };
}

async function ownerOwnsProperty(userId: string, propertyId: string | null): Promise<boolean> {
  if (!propertyId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("owner_program_properties")
    .select("property_id, inclusion_status, archived_at, owner_programs!inner(owner_user_id)")
    .eq("property_id", propertyId)
    .eq("owner_programs.owner_user_id", userId);
  return (data ?? []).some((r) => r.inclusion_status === "included" && r.archived_at == null);
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export async function listAttachments(
  viewer: Viewer,
  entityType: AttachmentEntity,
  entityId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const record = await loadRecord(supabaseAdmin, viewer, entityType, entityId);
  const owns = isStaff(viewer) ? false : await ownerOwnsProperty(viewer.userId, record.propertyId);
  if (!isStaff(viewer) && !owns) throw new Error(DENY_UNRELATED);

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(
      "id, title, original_filename, mime_type, size_bytes, kind, visibility, requested_from, upload_status, uploaded_by, uploaded_at, entity_type, entity_id, property_id, note, category, created_at",
    )
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as AttachmentRow[];
  const visible = rows.filter((r) => canView(viewer, r, owns).allow);

  const uploaderIds = [...new Set(visible.map((r) => r.uploaded_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (uploaderIds.length) {
    const profiles = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", uploaderIds);
    for (const p of profiles.data ?? []) names.set(p.id, p.full_name || p.email || "Unknown");
  }

  return {
    canUpload: canUpload(viewer, {
      ownerOfProperty: owns,
      requestSlotOpen: rows.some(
        (r) => r.requested_from === "owner" && r.upload_status === "pending",
      ),
      recordClosed: record.closed,
    }).allow,
    recordClosed: record.closed,
    isStaff: isStaff(viewer),
    files: visible.map((r) => ({
      ...r,
      uploaded_by_name: r.uploaded_by ? (names.get(r.uploaded_by) ?? "Unknown") : null,
      can_delete: canDelete(viewer, r).allow,
      can_share: canChangeVisibility(viewer).allow,
    })),
  };
}

/**
 * Step 1 of an upload: check the caller, record the intent, hand back a
 * short-lived signed upload token. `uploadKey` is chosen by the browser and
 * is unique in the database, so a retried upload re-uses its own row instead
 * of creating a second one.
 */
export async function beginUpload(
  viewer: Viewer,
  input: {
    entityType: AttachmentEntity;
    entityId: string;
    uploadKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    visibility?: AttachmentVisibility;
    note?: string | null;
    category?: string | null;
    fulfilsRequestId?: string | null;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const valid = validateFile({ name: input.filename, type: input.mimeType, size: input.sizeBytes });
  if (!valid.ok) throw new Error(valid.message);

  const record = await loadRecord(supabaseAdmin, viewer, input.entityType, input.entityId);
  const owns = isStaff(viewer) ? false : await ownerOwnsProperty(viewer.userId, record.propertyId);

  let requestSlotOpen = false;
  if (input.fulfilsRequestId) {
    const { data } = await supabaseAdmin
      .from("documents")
      .select("id, entity_id, entity_type, requested_from, upload_status")
      .eq("id", input.fulfilsRequestId)
      .maybeSingle();
    requestSlotOpen =
      !!data &&
      data.entity_id === input.entityId &&
      data.entity_type === input.entityType &&
      data.requested_from === "owner" &&
      data.upload_status === "pending";
  }

  const allowed = canUpload(viewer, {
    ownerOfProperty: owns,
    requestSlotOpen,
    recordClosed: record.closed,
  });
  if (!allowed.allow) throw new Error(allowed.reason);

  const path = storagePathFor(input.entityType, input.entityId, input.uploadKey, input.filename);

  // Retry of the same upload: reuse the existing row rather than inserting a twin.
  const existing = await supabaseAdmin
    .from("documents")
    .select("id, upload_status, storage_path")
    .eq("upload_key", input.uploadKey)
    .maybeSingle();

  if (existing.data && existing.data.upload_status === "stored") {
    return { documentId: existing.data.id, alreadyStored: true as const, path, token: null };
  }

  let documentId = existing.data?.id ?? null;

  if (!documentId) {
    const insert = await supabaseAdmin
      .from("documents")
      .insert({
        entity_type: input.entityType,
        entity_id: input.entityId,
        property_id: record.propertyId,
        title: input.filename,
        original_filename: input.filename,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        kind: kindFor(input.mimeType),
        visibility: isStaff(viewer) ? (input.visibility ?? "internal") : "owner_shared",
        storage_path: path,
        upload_key: input.uploadKey,
        upload_status: "pending",
        uploaded_by: viewer.userId,
        note: input.note ?? null,
        category: input.entityType === "property" ? (input.category ?? "other") : null,
        is_demo: record.isDemo,
      })
      .select("id")
      .single();
    if (insert.error) {
      // 23505 = another pass claimed this exact upload key first.
      if (insert.error.code === "23505") {
        const again = await supabaseAdmin
          .from("documents")
          .select("id")
          .eq("upload_key", input.uploadKey)
          .maybeSingle();
        if (again.data)
          return { documentId: again.data.id, alreadyStored: false as const, path, token: null };
      }
      throw insert.error;
    }
    documentId = insert.data.id;
  }

  const signed = await supabaseAdmin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (signed.error) throw new Error("Resolve could not open a slot for this file. Try again.");

  return {
    documentId,
    alreadyStored: false as const,
    path,
    token: signed.data.token,
    signedUrl: signed.data.signedUrl,
    expiresInSeconds: UPLOAD_TOKEN_SECONDS,
  };
}

/** Step 2: the bytes landed. Confirm the row, or mark the attempt failed. */
export async function completeUpload(
  viewer: Viewer,
  input: { documentId: string; ok: boolean; fulfilsRequestId?: string | null },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(
      "id, uploaded_by, storage_path, entity_type, entity_id, original_filename, size_bytes, mime_type",
    )
    .eq("id", input.documentId)
    .maybeSingle();
  if (error || !data) throw new Error("That upload is no longer on file.");
  if (data.uploaded_by !== viewer.userId && !isSupervisor(viewer)) throw new Error(DENY_UNRELATED);

  if (!input.ok) {
    // Failed attempt: clear the key so a fresh retry is clean, and drop any partial object.
    if (data.storage_path)
      await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).remove([data.storage_path]);
    await supabaseAdmin.from("documents").delete().eq("id", data.id);
    return { ok: false as const };
  }

  const head = await supabaseAdmin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(data.storage_path!, 10);
  if (head.error)
    throw new Error("Resolve could not find the uploaded file. Please try the upload again.");

  await supabaseAdmin
    .from("documents")
    .update({ upload_status: "stored", uploaded_at: new Date().toISOString() })
    .eq("id", data.id);

  if (input.fulfilsRequestId) {
    await supabaseAdmin
      .from("documents")
      .update({ upload_status: "stored" })
      .eq("id", input.fulfilsRequestId)
      .eq("requested_from", "owner");
  }

  await writeAudit({
    actorId: viewer.userId,
    action: "attachment.uploaded",
    entityType: data.entity_type,
    entityId: data.entity_id,
    entityLabel: data.original_filename,
    after: { documentId: data.id, size: data.size_bytes, type: data.mime_type },
  });

  // The audit log is the technical record; the Ticket's own Activity feed
  // (what a person actually reads) needs its own plain-language entry too —
  // otherwise attaching evidence is invisible on the ticket it was for.
  if (data.entity_type === "ticket") {
    await supabaseAdmin.from("ticket_activity").insert({
      ticket_id: data.entity_id,
      author_id: viewer.userId,
      kind: "evidence",
      event_type: "attachment_uploaded",
      internal: false,
      body: `Added ${data.original_filename}.`,
    });
  }

  return { ok: true as const };
}

/** A short-lived link to view or download one file, minted only after the check. */
export async function signedFileUrl(viewer: Viewer, documentId: string, download: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(
      "id, title, original_filename, mime_type, size_bytes, kind, visibility, requested_from, upload_status, uploaded_by, uploaded_at, entity_type, entity_id, property_id, note, created_at, storage_path, deleted_at",
    )
    .eq("id", documentId)
    .maybeSingle();
  if (error || !data || data.deleted_at || !data.storage_path)
    throw new Error("That file is no longer on file.");

  const owns = isStaff(viewer) ? false : await ownerOwnsProperty(viewer.userId, data.property_id);
  const decision = canView(viewer, data as AttachmentRow, owns);
  if (!decision.allow) throw new Error(decision.reason);

  const signed = await supabaseAdmin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(
      data.storage_path,
      SIGNED_URL_SECONDS,
      download ? { download: data.original_filename ?? true } : {},
    );
  if (signed.error) throw new Error("Resolve could not open that file.");
  return { url: signed.data.signedUrl, expiresInSeconds: SIGNED_URL_SECONDS };
}

/** Removal keeps the history: the row is marked removed, the bytes are deleted. */
export async function removeAttachment(viewer: Viewer, documentId: string, reason: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(
      "id, uploaded_by, storage_path, entity_type, entity_id, original_filename, visibility, requested_from, deleted_at, upload_status, title, mime_type, size_bytes, kind, property_id, note, created_at, uploaded_at",
    )
    .eq("id", documentId)
    .maybeSingle();
  if (error || !data || data.deleted_at) throw new Error("That file is no longer on file.");

  const decision = canDelete(viewer, data as AttachmentRow);
  if (!decision.allow) throw new Error(decision.reason);

  if (data.storage_path)
    await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).remove([data.storage_path]);
  const upd = await supabaseAdmin
    .from("documents")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: viewer.userId,
      delete_reason: reason,
    })
    .eq("id", documentId);
  if (upd.error) throw upd.error;

  await writeAudit({
    actorId: viewer.userId,
    action: "attachment.removed",
    entityType: data.entity_type,
    entityId: data.entity_id,
    entityLabel: data.original_filename,
    reason,
    before: { documentId, visibility: data.visibility },
  });
  return { ok: true as const };
}

/** Staff decide whether the homeowner sees a file. */
export async function setVisibility(
  viewer: Viewer,
  documentId: string,
  visibility: AttachmentVisibility,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const decision = canChangeVisibility(viewer);
  if (!decision.allow) throw new Error(decision.reason);

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, entity_type, entity_id, original_filename, visibility, deleted_at")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !data || data.deleted_at) throw new Error("That file is no longer on file.");

  const upd = await supabaseAdmin.from("documents").update({ visibility }).eq("id", documentId);
  if (upd.error) throw upd.error;

  await writeAudit({
    actorId: viewer.userId,
    action: "attachment.visibility_changed",
    entityType: data.entity_type,
    entityId: data.entity_id,
    entityLabel: data.original_filename,
    before: { visibility: data.visibility },
    after: { visibility },
  });
  return { ok: true as const };
}

/** Staff open a slot for the homeowner to upload one specific document. */
export async function requestOwnerDocument(
  viewer: Viewer,
  input: { entityType: AttachmentEntity; entityId: string; title: string; note?: string | null },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!isStaff(viewer)) throw new Error(DENY_UNRELATED);
  const record = await loadRecord(supabaseAdmin, viewer, input.entityType, input.entityId);

  const insert = await supabaseAdmin
    .from("documents")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      property_id: record.propertyId,
      title: input.title,
      kind: "document",
      visibility: "owner_shared",
      requested_from: "owner",
      upload_status: "pending",
      required: true,
      note: input.note ?? null,
      uploaded_by: null,
      is_demo: record.isDemo,
    })
    .select("id")
    .single();
  if (insert.error) throw insert.error;

  await writeAudit({
    actorId: viewer.userId,
    action: "attachment.requested_from_owner",
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.title,
  });
  return { documentId: insert.data.id };
}

/* ------------------------------------------------------------------ */
/* Owner-facing: only records where staff shared or asked for a file    */
/* ------------------------------------------------------------------ */

/**
 * The homeowner's narrow view of files. This is deliberately not a file
 * library: it lists only the records where a coordinator has either shared a
 * file with this owner or opened an upload slot for them.
 */
export async function listOwnerFileRecords(viewer: Viewer, client?: Client) {
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;

  const props = await supabaseAdmin
    .from("owner_program_properties")
    .select("property_id, inclusion_status, archived_at, owner_programs!inner(owner_user_id)")
    .eq("owner_programs.owner_user_id", viewer.userId);
  const propertyIds = (props.data ?? [])
    .filter((r) => r.inclusion_status === "included" && r.archived_at == null)
    .map((r) => r.property_id as string);
  if (propertyIds.length === 0) return { records: [] };

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, entity_type, entity_id, requested_from, upload_status, visibility, created_at")
    .in("property_id", propertyIds)
    .is("deleted_at", null)
    .or("visibility.eq.owner_shared,requested_from.eq.owner")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const grouped = new Map<
    string,
    { entityType: AttachmentEntity; entityId: string; shared: number; openRequestId: string | null }
  >();
  for (const row of data ?? []) {
    const key = `${row.entity_type}:${row.entity_id}`;
    const g = grouped.get(key) ?? {
      entityType: row.entity_type as AttachmentEntity,
      entityId: row.entity_id as string,
      shared: 0,
      openRequestId: null,
    };
    if (row.requested_from === "owner" && row.upload_status === "pending")
      g.openRequestId = row.id as string;
    else if (row.upload_status === "stored") g.shared += 1;
    grouped.set(key, g);
  }

  const records = [];
  for (const g of grouped.values()) {
    try {
      const record = await loadRecord(supabaseAdmin, viewer, g.entityType, g.entityId);
      records.push({ ...g, label: record.label });
    } catch {
      // A record the owner can no longer reach simply drops out of the list.
    }
  }
  return { records };
}
