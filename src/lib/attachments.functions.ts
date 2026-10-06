/**
 * Server functions for Resolve file attachments.
 * Thin wrappers only — every decision lives in attachments.server.ts, which
 * re-checks the caller on each call. Hiding a button is never the control.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AttachmentEntity, AttachmentVisibility } from "@/lib/attachments";

export const listAttachmentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entityType: AttachmentEntity; entityId: string }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.listAttachments(viewer, data.entityType, data.entityId);
  });

export const beginUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
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
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.beginUpload(viewer, data);
  });

export const completeUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { documentId: string; ok: boolean; fulfilsRequestId?: string | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.completeUpload(viewer, data);
  });

export const attachmentUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; download?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    // Staff must also see the file record through their own permissions, so
    // backend record restrictions (e.g. test accounts: demo only) apply to files.
    if (m.isStaff(viewer)) {
      const own = await context.supabase.from("documents").select("id").eq("id", data.documentId).maybeSingle();
      if (own.error || !own.data) throw new Error("You do not have access to this record.");
    }
    return m.signedFileUrl(viewer, data.documentId, data.download ?? false);
  });

export const removeAttachmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; reason?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.removeAttachment(viewer, data.documentId, data.reason ?? null);
  });

export const setAttachmentVisibilityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; visibility: AttachmentVisibility }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.setVisibility(viewer, data.documentId, data.visibility);
  });

export const requestOwnerDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      entityType: AttachmentEntity;
      entityId: string;
      title: string;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.requestOwnerDocument(viewer, data);
  });

export const listOwnerFileRecordsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.listOwnerFileRecords(viewer);
  });

export const listOwnerDocumentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.listOwnerDocuments(viewer);
  });

/** Records the owner-facing category and optional Opportunity on the uploader's own file. */
export const tagOwnerUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; ownerCategory: string; workItemId?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("tag_owner_upload", {
      _document_id: data.documentId,
      _owner_category: data.ownerCategory,
      _work_item_id: (data.workItemId ?? null) as string,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
