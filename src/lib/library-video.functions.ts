/**
 * Optional Library walkthrough videos. Files sit in the private attachments bucket;
 * only these server actions issue upload tickets or short-lived playback links,
 * and only after the database rule says the caller may edit or watch.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  LIBRARY_VIDEO_BUCKET,
  LIBRARY_VIDEO_MAX_BYTES,
  LIBRARY_VIDEO_TYPES,
  LIBRARY_VIDEO_URL_SECONDS,
  isLibraryVideoPath,
  libraryVideoPath,
  validateVideoFile,
} from "./library-video";

// The video table and functions are pending approval, so they are not in generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
const loose = (c: unknown) => c as Loose;

export type LibraryVideoRecord = {
  id: string;
  library_id: string;
  label: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
  removed_at: string | null;
  removal_reason: "replaced" | "removed" | null;
};

const NOT_READY = "Library videos are not switched on yet.";
function clean(error: { message?: string; code?: string } | null) {
  if (!error) return;
  if (error.code === "42P01" || error.code === "42883" || error.code === "PGRST202" || error.code === "PGRST205") throw new Error(NOT_READY);
  throw new Error(error.message ?? "Something went wrong.");
}

async function requireEditor(supabase: unknown, userId: string) {
  const { data, error } = await loose(supabase).rpc("can_edit_owner_library", { _uid: userId });
  clean(error);
  if (!data) throw new Error("Only people who can edit the library can change its videos.");
}

const mimeEnum = z.enum(Object.keys(LIBRARY_VIDEO_TYPES) as [keyof typeof LIBRARY_VIDEO_TYPES, ...(keyof typeof LIBRARY_VIDEO_TYPES)[]]);

/** Staff: the live video and its history for one library item. */
export const manageLibraryVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ libraryId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await loose(context.supabase)
      .from("owner_library_videos")
      .select("id, library_id, label, mime_type, size_bytes, uploaded_by, uploaded_at, removed_at, removal_reason")
      .eq("library_id", data.libraryId)
      .order("uploaded_at", { ascending: false });
    if (error && (error.code === "42P01" || error.code === "PGRST205")) return { ready: false, current: null, history: [] as LibraryVideoRecord[] };
    clean(error);
    const all = (rows ?? []) as LibraryVideoRecord[];
    const ids = [...new Set(all.map((r) => r.uploaded_by))];
    const names = ids.length ? await context.supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
    const nameOf = new Map((names.data ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? "A teammate"]));
    const withNames = all.map((r) => ({ ...r, uploaded_by_name: nameOf.get(r.uploaded_by) ?? "A teammate" }));
    return { ready: true, current: withNames.find((r) => !r.removed_at) ?? null, history: withNames };
  });

/** Staff: a one-time upload ticket for a new video file (the file itself goes straight to storage). */
export const beginLibraryVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      libraryId: z.string().uuid(),
      fileName: z.string().min(1).max(300),
      type: z.string().max(100),
      size: z.number().int().positive().max(LIBRARY_VIDEO_MAX_BYTES),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const check = validateVideoFile({ name: data.fileName, type: data.type, size: data.size });
    if (!check.ok) throw new Error(check.reason);
    await requireEditor(context.supabase, context.userId);
    const path = libraryVideoPath(data.libraryId, crypto.randomUUID(), check.mime);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ticket = await supabaseAdmin.storage.from(LIBRARY_VIDEO_BUCKET).createSignedUploadUrl(path);
    if (ticket.error || !ticket.data) throw new Error("Resolve could not start the upload.");
    return { path, token: ticket.data.token, mime: check.mime, bucket: LIBRARY_VIDEO_BUCKET };
  });

/** Staff: after the file arrives, make it the item's video (replacing any earlier one, which stays hidden). */
export const completeLibraryVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      libraryId: z.string().uuid(),
      path: z.string().min(1).max(400),
      mime: mimeEnum,
      size: z.number().int().positive().max(LIBRARY_VIDEO_MAX_BYTES),
      label: z.string().trim().max(120).nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    if (!isLibraryVideoPath(data.libraryId, data.path)) throw new Error("That upload does not belong to this item.");
    await requireEditor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const folder = data.path.slice(0, data.path.lastIndexOf("/"));
    const file = data.path.slice(data.path.lastIndexOf("/") + 1);
    const listed = await supabaseAdmin.storage.from(LIBRARY_VIDEO_BUCKET).list(folder, { search: file, limit: 5 });
    const found = (listed.data ?? []).find((o) => o.name === file);
    if (listed.error || !found) throw new Error("The video did not finish uploading. Please try again.");
    const { data: id, error } = await loose(context.supabase).rpc("set_owner_library_video", {
      _library_id: data.libraryId,
      _storage_path: data.path,
      _mime_type: data.mime,
      _size_bytes: data.size,
      _label: data.label ?? "",
    });
    clean(error);
    return { id: id as string };
  });

export const removeLibraryVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ libraryId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: n, error } = await loose(context.supabase).rpc("remove_owner_library_video", { _library_id: data.libraryId });
    clean(error);
    return { removed: Number(n ?? 0) };
  });

export const relabelLibraryVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ libraryId: z.string().uuid(), label: z.string().trim().max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await loose(context.supabase).rpc("relabel_owner_library_video", { _library_id: data.libraryId, _label: data.label });
    clean(error);
    return { ok: true };
  });

/** Which library items have a video the caller may watch (ids and labels only). */
export const listLibraryVideoIndex = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await loose(supabaseAdmin)
      .from("owner_library_videos")
      .select("library_id, label")
      .is("removed_at", null);
    if (error) return [] as { libraryId: string; label: string }[]; // not switched on yet: no videos
    const out: { libraryId: string; label: string }[] = [];
    for (const r of (rows ?? []) as { library_id: string; label: string }[]) {
      const ok = await loose(context.supabase).rpc("can_view_owner_library_video", { _library_id: r.library_id });
      if (!ok.error && ok.data === true) out.push({ libraryId: r.library_id, label: r.label });
    }
    return out;
  });

/** A short-lived playback link, issued only after the database says this person may watch. */
export const libraryVideoPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ libraryId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const allowed = await loose(context.supabase).rpc("can_view_owner_library_video", { _library_id: data.libraryId });
    clean(allowed.error);
    if (allowed.data !== true) throw new Error("This video isn't available on your account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await loose(supabaseAdmin)
      .from("owner_library_videos")
      .select("storage_path, mime_type, label")
      .eq("library_id", data.libraryId)
      .is("removed_at", null)
      .maybeSingle();
    if (!row) throw new Error("This video is no longer available.");
    const signed = await supabaseAdmin.storage.from(LIBRARY_VIDEO_BUCKET).createSignedUrl(row.storage_path as string, LIBRARY_VIDEO_URL_SECONDS);
    if (signed.error || !signed.data) throw new Error("Resolve could not open the video.");
    return {
      url: signed.data.signedUrl,
      mime: row.mime_type as string,
      label: row.label as string,
      expiresAt: Date.now() + LIBRARY_VIDEO_URL_SECONDS * 1000,
    };
  });
