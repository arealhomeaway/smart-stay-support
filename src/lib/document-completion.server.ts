/**
 * Reads document completeness across vendors and homes, and retires leftovers.
 *
 * Server-only. Retiring archives a document — it is never deleted, and the
 * file behind it is never touched.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VENDOR_DOC_TYPES } from "./vendor-documents";
import {
  completionFor,
  documentState,
  isRetirable,
  retireReason,
  type DocInput,
  type RequiredDoc,
} from "./document-completion";

/** The paperwork every approved vendor company must have on file. */
export const REQUIRED_VENDOR_DOCS: RequiredDoc[] = VENDOR_DOC_TYPES.filter((t) =>
  ["insurance", "license", "w9"].includes(t.code),
).map((t) => ({
  code: t.code,
  label: t.label,
  ...(t.retention === "verify_only" ? { verifyOnly: true } : {}),
}));

export type VendorCompletion = {
  orgId: string;
  orgName: string;
  rows: ReturnType<typeof completionFor>["rows"];
  missing: number;
  attention: number;
  complete: boolean;
};

export async function vendorDocumentCompletion(): Promise<VendorCompletion[]> {
  const { data: orgs, error } = await supabaseAdmin
    .from("vendor_orgs")
    .select("id, display_name, legal_name, status")
    .order("display_name");
  if (error) throw new Error("Could not read the vendor list.");

  const { data: docs, error: docError } = await supabaseAdmin
    .from("vendor_documents")
    .select("id, org_id, doc_type, title, storage_path, external_url, expires_on, verification_status, created_at");
  if (docError) throw new Error("Could not read the vendor paperwork.");

  const byOrg = new Map<string, DocInput[]>();
  for (const d of docs ?? []) {
    const list = byOrg.get(d.org_id) ?? [];
    list.push({
      id: d.id,
      title: d.title,
      kindCode: d.doc_type,
      expiresOn: d.expires_on,
      storagePath: d.storage_path,
      externalUrl: d.external_url,
      verifyOnly: d.verification_status === "verified" && !d.storage_path && !d.external_url,
      createdAt: d.created_at,
    });
    byOrg.set(d.org_id, list);
  }

  return (orgs ?? []).map((org) => {
    const result = completionFor(REQUIRED_VENDOR_DOCS, byOrg.get(org.id) ?? []);
    return {
      orgId: org.id,
      orgName: org.name,
      rows: result.rows,
      missing: result.missing,
      attention: result.attention,
      complete: result.complete,
    };
  });
}

export type LegacyDocument = {
  id: string;
  title: string;
  entityType: string;
  entityId: string;
  reason: string;
  state: string;
  createdAt: string | null;
};

/** Documents carried over from the tools Resolve replaces, plus dead uploads. */
export async function listRetirableDocuments(limit = 100): Promise<LegacyDocument[]> {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(
      "id, title, entity_type, entity_id, category, storage_path, external_url, upload_status, archived_at, deleted_at, created_at, is_demo",
    )
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error("Could not read the stored documents.");

  const out: LegacyDocument[] = [];
  for (const row of data ?? []) {
    if (row.is_demo) continue;
    const doc: DocInput = {
      id: row.id,
      title: row.title,
      kindCode: row.category,
      expiresOn: null,
      storagePath: row.storage_path,
      externalUrl: row.external_url,
      archivedAt: row.archived_at,
      uploadStatus: row.upload_status,
      createdAt: row.created_at,
    };
    if (!isRetirable(doc)) continue;
    out.push({
      id: row.id,
      title: row.title,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reason: retireReason(doc) ?? "Leftover from an earlier tool.",
      state: documentState(doc).label,
      createdAt: row.created_at,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Archives one leftover document. The file stays; it stops counting as current. */
export async function retireDocument(input: {
  documentId: string;
  userId: string;
  note: string;
}): Promise<{ ok: true }> {
  const { data: row, error } = await supabaseAdmin
    .from("documents")
    .select("id, title, category, storage_path, external_url, upload_status, archived_at, deleted_at")
    .eq("id", input.documentId)
    .maybeSingle();
  if (error) throw new Error("Could not read that document.");
  if (!row) throw new Error("That document no longer exists.");
  if (row.archived_at) throw new Error("That document is already retired.");
  if (row.deleted_at) throw new Error("That document has been removed.");

  const retirable = isRetirable({
    id: row.id,
    title: row.title,
    kindCode: row.category,
    expiresOn: null,
    storagePath: row.storage_path,
    externalUrl: row.external_url,
    archivedAt: row.archived_at,
    uploadStatus: row.upload_status,
  });
  if (!retirable) {
    throw new Error("That document is in use — only leftovers from earlier tools can be retired.");
  }

  const note = input.note.trim();
  const { error: updateError } = await supabaseAdmin
    .from("documents")
    .update({
      archived_at: new Date().toISOString(),
      note: note || "Retired during legacy document cleanup.",
    })
    .eq("id", input.documentId)
    .is("archived_at", null);
  if (updateError) throw new Error("Could not retire that document.");
  return { ok: true };
}
