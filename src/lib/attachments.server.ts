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

import { isExternalOwner, ownerPropertyAccess } from "@/lib/owner-property-access.server";
import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_ENTITIES,
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
  is_demo?: boolean;
  archived_at?: string | null;
  owner_recipient_id?: string | null;
  owner_recipient_program_id?: string | null;
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
  if (!isExternalOwner(viewer) || !ownerOfProperty) return { allow: false, reason: DENY_UNRELATED };
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
  if (!isExternalOwner(viewer) || !ctx.ownerOfProperty)
    return { allow: false, reason: DENY_UNRELATED };
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
  if (!ATTACHMENT_ENTITIES.includes(entityType)) throw new Error(DENY_UNRELATED);
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
    label: isStaff(viewer) ? data.title : "Property onboarding document",
    isDemo: data.is_demo,
  };
}

async function ownerCanReachRecord(client: Client, viewer: Viewer, record: RecordInfo) {
  return (
    isExternalOwner(viewer) &&
    !record.isDemo &&
    (await ownerPropertyAccess(client, viewer.userId, record.propertyId))
  );
}

function fileMatchesRecord(
  row: { property_id: string | null; is_demo?: boolean; archived_at?: string | null },
  record: RecordInfo,
) {
  return (
    row.property_id === record.propertyId &&
    row.is_demo === record.isDemo &&
    row.archived_at == null
  );
}

/** File sharing does not publish staff notes or account identifiers. */
export function ownerAttachment(row: AttachmentRow): AttachmentRow {
  return {
    id: row.id,
    title: row.title,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    kind: row.kind,
    visibility: row.visibility,
    requested_from: row.requested_from,
    upload_status: row.upload_status,
    uploaded_by: null,
    uploaded_at: row.uploaded_at,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    property_id: row.property_id,
    // A requested slot deliberately carries instructions for the owner.
    note: row.requested_from === "owner" ? row.note : null,
    category: row.category ?? null,
    created_at: row.created_at,
  };
}

/** Callers must separately authorize the Property; this binds a file to its current entity. */
export async function attachmentMatchesCurrentProperty(
  client: Client,
  viewer: Viewer,
  row: {
    id: string;
    entity_type: string;
    entity_id: string;
    property_id: string | null;
    is_demo?: boolean;
    archived_at?: string | null;
  },
  propertyId: string,
) {
  if (row.property_id !== propertyId || row.is_demo !== false || row.archived_at != null)
    return false;
  try {
    const record = await loadRecord(
      client,
      viewer,
      row.entity_type as AttachmentEntity,
      row.entity_id,
    );
    return (
      record.propertyId === propertyId &&
      !record.isDemo &&
      fileMatchesRecord(row, record) &&
      (await ownerDocumentAccess(client, viewer, row.id))
    );
  } catch {
    return false;
  }
}

/** Canonical intended recipient and current Property access are checked together. */
export async function ownerDocumentAccess(client: Client, viewer: Viewer, documentId: string) {
  if (!isExternalOwner(viewer)) return false;
  const { data, error } = await client.rpc("owner_document_access", {
    _document_id: documentId,
    _actor_id: viewer.userId,
  });
  return !error && data === true;
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export async function listAttachments(
  viewer: Viewer,
  entityType: AttachmentEntity,
  entityId: string,
  client?: Client,
) {
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const record = await loadRecord(supabaseAdmin, viewer, entityType, entityId);
  const owns = isStaff(viewer) ? false : await ownerCanReachRecord(supabaseAdmin, viewer, record);
  if (!isStaff(viewer) && !owns) throw new Error(DENY_UNRELATED);

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(
      "id, title, original_filename, mime_type, size_bytes, kind, visibility, requested_from, upload_status, uploaded_by, uploaded_at, entity_type, entity_id, property_id, note, category, created_at, is_demo, archived_at, owner_recipient_id, owner_recipient_program_id",
    )
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as AttachmentRow[];
  const recipientAccess = isStaff(viewer)
    ? []
    : await Promise.all(rows.map((row) => ownerDocumentAccess(supabaseAdmin, viewer, row.id)));
  const visible = rows.filter(
    (r, index) =>
      canView(viewer, r, owns).allow &&
      (isStaff(viewer) || (fileMatchesRecord(r, record) && recipientAccess[index])),
  );

  const uploaderIds = [...new Set(visible.map((r) => r.uploaded_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (isStaff(viewer) && uploaderIds.length) {
    const profiles = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", uploaderIds);
    for (const p of profiles.data ?? []) names.set(p.id, p.full_name || p.email || "Unknown");
  }

  return {
    canUpload: canUpload(viewer, {
      ownerOfProperty: owns,
      requestSlotOpen: visible.some(
        (r) => r.requested_from === "owner" && r.upload_status === "pending",
      ),
      recordClosed: record.closed,
    }).allow,
    recordClosed: record.closed,
    isStaff: isStaff(viewer),
    files: visible.map((r) => ({
      ...(isStaff(viewer) ? r : ownerAttachment(r)),
      uploaded_by_name: r.uploaded_by
        ? isStaff(viewer)
          ? (names.get(r.uploaded_by) ?? "Unknown")
          : r.uploaded_by === viewer.userId
            ? "You"
            : "ARHA"
        : null,
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
  client?: Client,
) {
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const valid = validateFile({ name: input.filename, type: input.mimeType, size: input.sizeBytes });
  if (!valid.ok) throw new Error(valid.message);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.uploadKey))
    throw new Error("Start a new upload with a valid upload key.");

  const path = storagePathFor(input.entityType, input.entityId, input.uploadKey, input.filename);
  const { data, error } = await supabaseAdmin.rpc("begin_attachment_upload", {
    _actor_id: viewer.userId,
    _input: { ...input, path, kind: kindFor(input.mimeType) },
  });
  if (error) throw error;
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data["documentId"] !== "string" ||
    data["path"] !== path ||
    typeof data["alreadyStored"] !== "boolean"
  )
    throw new Error("Resolve could not confirm the upload intent.");
  const documentId = data["documentId"];
  if (data["alreadyStored"]) return { documentId, alreadyStored: true as const, path, token: null };

  const signed = await supabaseAdmin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
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
  client?: Client,
) {
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  // A service-side storage read checks that bytes exist. The checked transaction
  // revalidates scope and the original request before any database completion.
  const { data: row, error: readError } = await supabaseAdmin
    .from("documents")
    .select("id,storage_path,uploaded_by,upload_status,deleted_at,archived_at,fulfils_request_id")
    .eq("id", input.documentId)
    .maybeSingle();
  if (readError || !row || row.deleted_at || row.archived_at || !row.storage_path)
    throw new Error("That upload is no longer on file.");
  if (row.uploaded_by !== viewer.userId && !isSupervisor(viewer)) throw new Error(DENY_UNRELATED);
  if (!isStaff(viewer) && !(await ownerDocumentAccess(supabaseAdmin, viewer, row.id)))
    throw new Error(DENY_UNRELATED);
  if (input.fulfilsRequestId && input.fulfilsRequestId !== row.fulfils_request_id)
    throw new Error("Original document request cannot change.");
  if (input.ok && row.upload_status !== "stored") {
    const head = await supabaseAdmin.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(row.storage_path, 10);
    if (head.error)
      throw new Error("Resolve could not find the uploaded file. Please try the upload again.");
  }
  const { data, error } = await supabaseAdmin.rpc("complete_attachment_upload", {
    _actor_id: viewer.userId,
    _document_id: input.documentId,
    _ok: input.ok,
    _fulfils_request_id: (input.fulfilsRequestId ?? null) as unknown as string,
  });
  if (error) throw error;
  if (typeof data !== "boolean") throw new Error("Resolve could not confirm upload completion.");
  // The receipt includes the file/request/history transaction. No post-commit
  // database writer can turn success into a misleading retryable failure.
  return { ok: data };
}

/** A short-lived link to view or download one file, minted only after the check. */
export async function signedFileUrl(
  viewer: Viewer,
  documentId: string,
  download: boolean,
  client?: Client,
) {
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(
      "id, title, original_filename, mime_type, size_bytes, kind, visibility, requested_from, upload_status, uploaded_by, uploaded_at, entity_type, entity_id, property_id, note, created_at, storage_path, deleted_at, is_demo, archived_at",
    )
    .eq("id", documentId)
    .maybeSingle();
  if (
    error ||
    !data ||
    data.deleted_at ||
    data.archived_at ||
    !data.storage_path ||
    data.upload_status !== "stored"
  )
    throw new Error("That file is no longer on file.");

  const record = isStaff(viewer)
    ? null
    : await loadRecord(supabaseAdmin, viewer, data.entity_type as AttachmentEntity, data.entity_id);
  const owns =
    record != null &&
    fileMatchesRecord(data, record) &&
    (await ownerCanReachRecord(supabaseAdmin, viewer, record));
  const decision = canView(
    viewer,
    data as AttachmentRow,
    owns && (await ownerDocumentAccess(supabaseAdmin, viewer, data.id)),
  );
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

/** Soft removal retains bytes and evidence links; metadata/history commit together. */
export async function removeAttachment(
  viewer: Viewer,
  documentId: string,
  reason: string | null,
  client?: Client,
) {
  if (!isStaff(viewer)) throw new Error(DENY_UNRELATED);
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data, error } = await supabaseAdmin.rpc("archive_attachment", {
    _actor_id: viewer.userId,
    _document_id: documentId,
    _reason: reason ?? "",
  });
  if (error) throw error;
  if (data !== documentId) throw new Error("Resolve could not confirm the attachment removal.");
  return { ok: true as const };
}
/** Staff decide whether the homeowner sees a file. */
export async function setVisibility(
  viewer: Viewer,
  documentId: string,
  visibility: AttachmentVisibility,
  client?: Client,
) {
  if (!isStaff(viewer)) throw new Error(DENY_UNRELATED);
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data, error } = await supabaseAdmin.rpc("set_attachment_visibility", {
    _actor_id: viewer.userId,
    _document_id: documentId,
    _visibility: visibility,
  });
  if (error) throw error;
  if (data !== documentId) throw new Error("Resolve could not confirm the sharing change.");
  return { ok: true as const };
}

/** Staff explicitly choose the current canonical recipient through enrollment. */
export async function requestOwnerDocument(
  viewer: Viewer,
  input: { entityType: AttachmentEntity; entityId: string; title: string; note?: string | null },
  client?: Client,
) {
  if (!isStaff(viewer)) throw new Error(DENY_UNRELATED);
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data, error } = await supabaseAdmin.rpc("request_owner_document", {
    _actor_id: viewer.userId,
    _input: input,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("Resolve could not confirm the document request.");
  return { documentId: data };
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
  if (!isExternalOwner(viewer)) return { records: [] };
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;

  const props = await supabaseAdmin
    .from("owner_program_properties")
    .select("property_id, inclusion_status, archived_at, owner_programs!inner(owner_user_id)")
    .eq("owner_programs.owner_user_id", viewer.userId);
  if (props.error) throw props.error;
  const candidates = [
    ...new Set(
      (props.data ?? [])
        .filter((r) => r.inclusion_status === "included" && r.archived_at == null)
        .map((r) => r.property_id as string),
    ),
  ];
  const allowed = await Promise.all(
    candidates.map((id) => ownerPropertyAccess(supabaseAdmin, viewer.userId, id)),
  );
  const propertyIds = candidates.filter((_, index) => allowed[index]);
  if (propertyIds.length === 0) return { records: [] };

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(
      "id, entity_type, entity_id, property_id, requested_from, upload_status, visibility, created_at, is_demo, archived_at",
    )
    .in("property_id", propertyIds)
    .is("deleted_at", null)
    .is("archived_at", null)
    .eq("is_demo", false)
    .or("visibility.eq.owner_shared,requested_from.eq.owner")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const grouped = new Map<
    string,
    { entityType: AttachmentEntity; entityId: string; shared: number; openRequestId: string | null }
  >();
  for (const row of data ?? []) {
    if (
      !propertyIds.includes(row.property_id ?? "") ||
      !(await attachmentMatchesCurrentProperty(supabaseAdmin, viewer, row, row.property_id!))
    )
      continue;
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
      if (!(await ownerCanReachRecord(supabaseAdmin, viewer, record))) continue;
      records.push({ ...g, label: record.label });
    } catch {
      // A record the owner can no longer reach simply drops out of the list.
    }
  }
  return { records };
}

/**
 * The homeowner's Documents & Photos as ONE flat list across every home they
 * can reach. Built from the same per-record checks as listAttachments; the
 * internal record grouping is never shown to the owner.
 */
export async function listOwnerDocuments(viewer: Viewer, client?: Client) {
  const supabaseAdmin =
    client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { records } = await listOwnerFileRecords(viewer, supabaseAdmin);
  const files: Array<Record<string, unknown> & { id: string; property_id: string | null }> = [];
  const requests: Array<{ id: string; title: string; note: string | null; propertyId: string | null; entityType: AttachmentEntity; entityId: string }> = [];
  for (const r of records) {
    const listed = await listAttachments(viewer, r.entityType, r.entityId, supabaseAdmin);
    for (const f of listed.files) {
      if (f.requested_from === "owner" && f.upload_status === "pending") {
        requests.push({ id: f.id, title: f.title, note: f.note, propertyId: f.property_id, entityType: r.entityType, entityId: r.entityId });
      } else if (f.upload_status === "stored") files.push(f);
    }
  }
  const ids = files.map((f) => f.id);
  const extra = new Map<string, { owner_category: string | null; work_item_id: string | null }>();
  if (ids.length) {
    const { data } = await supabaseAdmin.from("documents").select("id, owner_category, work_item_id").in("id", ids);
    for (const d of data ?? []) extra.set(d.id, d);
  }
  const propIds = [...new Set([...files.map((f) => f.property_id), ...requests.map((r) => r.propertyId)].filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (propIds.length) {
    const { data } = await supabaseAdmin.from("properties").select("id, name, nickname").in("id", propIds);
    for (const p of data ?? []) names.set(p.id, p.nickname || p.name);
  }
  return {
    files: files.map((f) => ({
      ...(f as unknown as AttachmentRow & { uploaded_by_name: string | null }),
      owner_category: extra.get(f.id)?.owner_category ?? null,
      work_item_id: extra.get(f.id)?.work_item_id ?? null,
      propertyName: f.property_id ? (names.get(f.property_id) ?? "Your home") : "Your home",
    })),
    requests: requests.map((r) => ({ ...r, propertyName: r.propertyId ? (names.get(r.propertyId) ?? "Your home") : "Your home" })),
  };
}
