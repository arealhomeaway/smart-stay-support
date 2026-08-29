/** Temporary isolated end-to-end check for attachments. Deleted after the run. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import * as A from "@/lib/attachments.server";

const staff = { userId: "", roles: ["tech"] } as A.Viewer;
const supervisor = { userId: "", roles: ["manager"] } as A.Viewer;
const owner = { userId: "", roles: ["owner"] } as A.Viewer;
const stranger = { userId: "00000000-0000-0000-0000-000000000009", roles: ["owner"] } as A.Viewer;
const roleless = { userId: "00000000-0000-0000-0000-000000000008", roles: [] } as A.Viewer;

const log = (s: string, ok: boolean, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${s} ${extra}`);
async function denied(label: string, fn: () => Promise<unknown>) {
  try { await fn(); log(label, false, "(it was allowed)"); }
  catch (e) { log(label, true, `→ ${(e as Error).message}`); }
}

const profiles = await supabaseAdmin.from("profiles").select("id, email").limit(50);
const roles = await supabaseAdmin.from("user_roles").select("user_id, role");
const pick = (r: string) => roles.data?.find((x) => x.role === r)?.user_id ?? null;
staff.userId = pick("tech") ?? pick("admin")!;
supervisor.userId = pick("manager") ?? pick("admin")!;
owner.userId = pick("owner")!;
console.log("actors:", { staff: staff.userId, supervisor: supervisor.userId, owner: owner.userId, profiles: profiles.data?.length });

// isolated demo ticket on a property the demo owner is in
const opp = await supabaseAdmin
  .from("owner_program_properties")
  .select("property_id, inclusion_status, archived_at, owner_programs!inner(owner_user_id)")
  .eq("owner_programs.owner_user_id", owner.userId)
  .eq("inclusion_status", "included");
const propertyId = opp.data?.[0]?.property_id;
const ticket = await supabaseAdmin
  .from("tickets")
  .select("id, ref, status, is_demo")
  .eq("is_demo", true)
  .eq("property_id", propertyId!)
  .neq("status", "closed")
  .limit(1)
  .maybeSingle();
console.log("demo ticket:", ticket.data?.ref, "property:", propertyId);
const ticketId = ticket.data!.id;

async function upload(viewer: A.Viewer, name: string, type: string, bytes: Uint8Array, key: string, fulfils?: string) {
  const started = await A.beginUpload(viewer, {
    entityType: "ticket", entityId: ticketId, uploadKey: key,
    filename: name, mimeType: type, sizeBytes: bytes.byteLength, fulfilsRequestId: fulfils ?? null,
  });
  if (started.token) {
    const put = await supabaseAdmin.storage.from("resolve-attachments")
      .uploadToSignedUrl(started.path, started.token, bytes, { contentType: type, upsert: true });
    if (put.error) throw put.error;
  }
  await A.completeUpload(viewer, { documentId: started.documentId!, ok: true, fulfilsRequestId: fulfils ?? null });
  return started.documentId!;
}

const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(2048).fill(1)]);
const mp4 = new Uint8Array(new Array(4096).fill(2));
const pdf = new TextEncoder().encode("%PDF-1.4 synthetic\n");

const k1 = crypto.randomUUID();
const photo = await upload(staff, "e2e-photo.jpg", "image/jpeg", jpg, k1);
const video = await upload(staff, "e2e-clip.mp4", "video/mp4", mp4, crypto.randomUUID());
const doc = await upload(staff, "e2e-doc.pdf", "application/pdf", pdf, crypto.randomUUID());
log("staff upload of photo, video and document", !!photo && !!video && !!doc);

// download
const url = await A.signedFileUrl(staff, photo, true);
const got = await fetch(url.url);
log("staff download returns the bytes", got.ok && (await got.arrayBuffer()).byteLength === jpg.byteLength);

// retry of the same upload key does not create a twin
await upload(staff, "e2e-photo.jpg", "image/jpeg", jpg, k1);
const dupes = await supabaseAdmin.from("documents").select("id").eq("upload_key", k1);
log("retry of the same upload reuses one row", dupes.data?.length === 1, `rows=${dupes.data?.length}`);

// limits
await denied("50 MB limit refuses an oversized file", () =>
  A.beginUpload(staff, { entityType: "ticket", entityId: ticketId, uploadKey: crypto.randomUUID(), filename: "big.mp4", mimeType: "video/mp4", sizeBytes: 60 * 1024 * 1024 }));
await denied("unsupported type is refused", () =>
  A.beginUpload(staff, { entityType: "ticket", entityId: ticketId, uploadKey: crypto.randomUUID(), filename: "x.exe", mimeType: "application/x-msdownload", sizeBytes: 10 }));

// interrupted upload leaves nothing behind
const kBad = crypto.randomUUID();
const started = await A.beginUpload(staff, { entityType: "ticket", entityId: ticketId, uploadKey: kBad, filename: "half.jpg", mimeType: "image/jpeg", sizeBytes: 100 });
await A.completeUpload(staff, { documentId: started.documentId!, ok: false });
const orphans = await supabaseAdmin.from("documents").select("id").eq("upload_key", kBad);
log("an interrupted upload leaves no orphan row", orphans.data?.length === 0);

// owner visibility
await A.setVisibility(staff, doc, "owner_shared");
const ownerList = await A.listAttachments(owner, "ticket", ticketId);
log("owner sees only the shared file", ownerList.files.length === 1 && ownerList.files[0]!.id === doc, `saw ${ownerList.files.length}`);
await denied("owner cannot open an internal file", () => A.signedFileUrl(owner, photo, false));
log("owner can open the shared file", !!(await A.signedFileUrl(owner, doc, false)).url);
await denied("an unrelated owner is refused the record", () => A.listAttachments(stranger, "ticket", ticketId));
await denied("a signed-in person with no role is refused", () => A.listAttachments(roleless, "ticket", ticketId));

// owner upload only where requested
await denied("owner cannot upload unasked", () =>
  A.beginUpload(owner, { entityType: "ticket", entityId: ticketId, uploadKey: crypto.randomUUID(), filename: "o.pdf", mimeType: "application/pdf", sizeBytes: 20 }));
const req = await A.requestOwnerDocument(staff, { entityType: "ticket", entityId: ticketId, title: "Proof of insurance" });
const ownerDoc = await upload(owner, "insurance.pdf", "application/pdf", pdf, crypto.randomUUID(), req.documentId);
log("owner uploads into the requested slot", !!ownerDoc);

// deletion authority
await denied("owner cannot remove a file", () => A.removeAttachment(owner, doc, null));
await denied("staff cannot remove someone else's upload", () =>
  A.removeAttachment({ userId: crypto.randomUUID(), roles: ["tech"] }, doc, null));
await A.removeAttachment(supervisor, video, "e2e cleanup");
const gone = await supabaseAdmin.from("documents").select("deleted_at, deleted_by, delete_reason").eq("id", video).single();
log("supervisor removal is recorded with who and why", !!gone.data?.deleted_at && !!gone.data?.delete_reason);
const audit = await supabaseAdmin.from("audit_log").select("action").eq("entity_id", ticketId).order("created_at", { ascending: false }).limit(10);
log("audit history holds the upload and the removal",
  audit.data!.some((a) => a.action === "attachment.uploaded") && audit.data!.some((a) => a.action === "attachment.removed"));

// closed record
await supabaseAdmin.from("tickets").update({ status: "closed" }).eq("id", ticketId);
await denied("a closed record refuses a new staff upload", () =>
  A.beginUpload(staff, { entityType: "ticket", entityId: ticketId, uploadKey: crypto.randomUUID(), filename: "late.jpg", mimeType: "image/jpeg", sizeBytes: 10 }));
const closedList = await A.listAttachments(staff, "ticket", ticketId);
log("files stay readable on a closed record", closedList.files.length > 0 && closedList.recordClosed);
await supabaseAdmin.from("tickets").update({ status: ticket.data!.status }).eq("id", ticketId);

// tidy up: remove every row this run created
const created = [photo, doc, ownerDoc, req.documentId];
for (const id of created) { try { await A.removeAttachment(supervisor, id, "e2e cleanup"); } catch { /* already gone */ } }
await supabaseAdmin.from("documents").delete().in("id", [...created, video]);
console.log("cleanup done — ticket restored to status", ticket.data!.status);
