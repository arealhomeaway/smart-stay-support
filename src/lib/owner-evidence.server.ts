/**
 * Optional photo / receipt evidence a homeowner may attach to the time they
 * log. The file is uploaded before the entry exists, into a path scoped to
 * their own program, and the stored path is handed to the participation
 * entry itself (`owner_time_entries.attachment_path`).
 *
 * Evidence never changes an hour figure — it only documents what the
 * homeowner did.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { findOwnerProgram } from "./owner-program-reader.server";
import { ATTACHMENT_BUCKET, safeFilename, validateFile } from "./attachments";

type Client = SupabaseClient<Database>;

const DENY = "That participation record is not available to this account.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `owner_participation/{program_id}/{upload_key}-{filename}` */
export function evidencePathFor(programId: string, uploadKey: string, filename: string) {
  return `owner_participation/${programId}/${uploadKey}-${safeFilename(filename)}`;
}

/** Opens a short-lived upload slot, only for the caller's own program. */
export async function beginParticipationEvidence(
  supabase: Client,
  admin: Client,
  userId: string,
  input: { programId: string; uploadKey: string; filename: string; mimeType: string; sizeBytes: number },
) {
  if (!UUID.test(input.uploadKey)) throw new Error("Start a new upload with a valid upload key.");
  const valid = validateFile({
    name: input.filename,
    type: input.mimeType,
    size: input.sizeBytes,
  });
  if (!valid.ok) throw new Error(valid.message);

  const program = await findOwnerProgram(supabase, userId);
  if (!program || program.id !== input.programId) throw new Error(DENY);

  const path = evidencePathFor(input.programId, input.uploadKey, input.filename);
  const signed = await admin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data)
    throw new Error("Resolve could not open a slot for this file. Try again.");
  return { path, token: signed.data.token };
}

/**
 * A short-lived link to one evidence file on one of the caller's own entries.
 * An entry may carry several files; `index` picks which one, in upload order.
 */
export async function participationEvidenceUrl(
  supabase: Client,
  admin: Client,
  entryId: string,
  download: boolean,
  index = 0,
) {
  const { data, error } = await supabase
    .from("owner_time_entries")
    .select("id, attachment_path, attachment_paths")
    .eq("id", entryId)
    .maybeSingle();
  if (error || !data) throw new Error("That file is no longer on file.");
  const many = Array.isArray(data.attachment_paths)
    ? (data.attachment_paths as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  const paths = many.length > 0 ? many : data.attachment_path ? [data.attachment_path] : [];
  const path = paths[index];
  if (!path) throw new Error("That file is no longer on file.");
  const signed = await admin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60, download ? { download: true } : {});
  if (signed.error || !signed.data) throw new Error("Resolve could not open that file.");
  return { url: signed.data.signedUrl };
}
