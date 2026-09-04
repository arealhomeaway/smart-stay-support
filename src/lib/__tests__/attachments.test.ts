/**
 * The access rules for Resolve file attachments, tested as decisions.
 *
 * These are the same functions the server calls before it mints any signed
 * link, so a pass here is a statement about what the server will actually
 * allow — not about what the interface happens to show.
 */
import { describe, expect, it } from "bun:test";
import {
  MAX_FILE_BYTES,
  safeFilename,
  storagePathFor,
  validateFile,
  kindFor,
} from "@/lib/attachments";
import {
  canChangeVisibility,
  canDelete,
  canUpload,
  canView,
  isStaff,
  type AttachmentRow,
  type Viewer,
} from "@/lib/attachments.server";

const staff: Viewer = { userId: "staff-1", roles: ["tech"] };
const supervisor: Viewer = { userId: "sup-1", roles: ["manager"] };
const owner: Viewer = { userId: "owner-1", roles: ["owner"] };
const nobody: Viewer = { userId: "no-1", roles: [] };

function file(over: Partial<AttachmentRow> = {}): AttachmentRow {
  return {
    id: "d1",
    title: "water-heater.jpg",
    original_filename: "water-heater.jpg",
    mime_type: "image/jpeg",
    size_bytes: 1024,
    kind: "photo",
    visibility: "internal",
    requested_from: null,
    upload_status: "stored",
    uploaded_by: "staff-1",
    uploaded_at: new Date().toISOString(),
    entity_type: "ticket",
    entity_id: "t1",
    property_id: "p1",
    note: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

describe("what counts as an acceptable file", () => {
  it("accepts a phone photo, a clip and a PDF", () => {
    expect(validateFile({ name: "a.jpg", type: "image/jpeg", size: 2_000_000 }).ok).toBe(true);
    expect(validateFile({ name: "a.mp4", type: "video/mp4", size: 20_000_000 }).ok).toBe(true);
    expect(validateFile({ name: "a.pdf", type: "application/pdf", size: 500_000 }).ok).toBe(true);
  });

  it("refuses anything over 50 MB, and says so in plain words", () => {
    const r = validateFile({ name: "big.mp4", type: "video/mp4", size: MAX_FILE_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("50.0 MB limit");
  });

  it("refuses an executable and an empty file", () => {
    expect(validateFile({ name: "x.exe", type: "application/x-msdownload", size: 10 }).ok).toBe(
      false,
    );
    expect(validateFile({ name: "x.jpg", type: "image/jpeg", size: 0 }).ok).toBe(false);
  });

  it("sorts a file into photo, video or document by its real type", () => {
    expect(kindFor("image/png")).toBe("photo");
    expect(kindFor("video/quicktime")).toBe("video");
    expect(kindFor("application/pdf")).toBe("document");
  });
});

describe("where the bytes are filed", () => {
  it("the path carries the record, so the file survives handoff and closure", () => {
    expect(storagePathFor("ticket", "abc", "key1", "roof.jpg")).toBe("ticket/abc/key1-roof.jpg");
    expect(storagePathFor("onboarding_task", "t9", "k2", "deed.pdf")).toBe(
      "onboarding_task/t9/k2-deed.pdf",
    );
  });

  it("a filename cannot escape its folder", () => {
    expect(safeFilename("../../etc/passwd")).not.toContain("/");
    expect(safeFilename("")).toBe("file");
  });
});

describe("who may see a file", () => {
  it("staff see everything on a record they can open", () => {
    expect(canView(staff, file(), false).allow).toBe(true);
  });

  it("an owner sees a file only once it is shared with them", () => {
    expect(canView(owner, file({ visibility: "internal" }), true).allow).toBe(false);
    expect(canView(owner, file({ visibility: "owner_shared" }), true).allow).toBe(true);
  });

  it("an unrelated owner sees nothing, shared or not", () => {
    expect(canView(owner, file({ visibility: "owner_shared" }), false).allow).toBe(false);
  });

  it("a signed-in person with no role is turned away", () => {
    expect(isStaff(nobody)).toBe(false);
    expect(canView(nobody, file({ visibility: "owner_shared" }), false).allow).toBe(false);
  });
});

describe("who may attach a file", () => {
  const open = { ownerOfProperty: true, requestSlotOpen: true, recordClosed: false };

  it("staff may attach to an open record", () => {
    expect(
      canUpload(staff, { ownerOfProperty: false, requestSlotOpen: false, recordClosed: false })
        .allow,
    ).toBe(true);
  });

  it("a closed record is read-only for staff, but a supervisor can still add", () => {
    expect(
      canUpload(staff, { ownerOfProperty: false, requestSlotOpen: false, recordClosed: true })
        .allow,
    ).toBe(false);
    expect(
      canUpload(supervisor, { ownerOfProperty: false, requestSlotOpen: false, recordClosed: true })
        .allow,
    ).toBe(true);
  });

  it("an owner uploads only where a document was asked of them", () => {
    expect(canUpload(owner, open).allow).toBe(true);
    expect(canUpload(owner, { ...open, requestSlotOpen: false }).allow).toBe(false);
  });

  it("an owner cannot upload against someone else's property", () => {
    expect(canUpload(owner, { ...open, ownerOfProperty: false }).allow).toBe(false);
  });
});

describe("who may remove a file, and who may share one", () => {
  it("staff remove their own upload; a colleague's needs a supervisor", () => {
    expect(canDelete(staff, file({ uploaded_by: "staff-1" })).allow).toBe(true);
    expect(canDelete(staff, file({ uploaded_by: "staff-2" })).allow).toBe(false);
    expect(canDelete(supervisor, file({ uploaded_by: "staff-2" })).allow).toBe(true);
  });

  it("an owner never removes a file, including one they uploaded", () => {
    expect(canDelete(owner, file({ uploaded_by: "owner-1" })).allow).toBe(false);
  });

  it("only staff decide what an owner sees", () => {
    expect(canChangeVisibility(staff).allow).toBe(true);
    expect(canChangeVisibility(owner).allow).toBe(false);
  });
});
