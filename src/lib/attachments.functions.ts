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
