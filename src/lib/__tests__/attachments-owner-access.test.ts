import { describe, expect, it } from "bun:test";
import {
  beginUpload,
  completeUpload,
  listAttachments,
  signedFileUrl,
  setVisibility,
  requestOwnerDocument,
  removeAttachment,
} from "../attachments.server";
import { ownerPropertyAccess } from "../owner-property-access.server";
import {
  attachmentRow,
  ownerFileTestClient,
  ownerFileViewer as owner,
  propertyRow,
  requestRow,
  uploadInput,
} from "./owner-file-test-client";

function fixture(documents = [attachmentRow(), requestRow()]) {
  return ownerFileTestClient({ properties: [propertyRow()], documents });
}

describe("elevated owner file authorization", () => {
  it("uses the canonical actor/Property scope RPC and fails closed on RPC errors", async () => {
    const f = fixture();
    f.setRpc(() => ({ data: true, error: { message: "scope unavailable" } }));
    expect(await ownerPropertyAccess(f.client as never, owner.userId, "property")).toBe(false);
    await expect(listAttachments(owner, "property", "property", f.client as never)).rejects.toThrow(
      "access",
    );
    expect(f.rpcCalls[0]).toEqual({
      name: "owner_property_access",
      args: { _property_id: "property", _actor_id: "owner" },
    });
    expect(f.storage).toEqual([]);
    expect(f.reads).not.toContain("documents");
  });

  it("rejects roleless, unrelated, revoked and conflicting external accounts before issuing a file URL", async () => {
    for (const roles of [[], ["vendor"], ["owner", "vendor"]]) {
      const f = fixture();
      await expect(
        signedFileUrl({ userId: "owner", roles }, "file", false, f.client as never),
      ).rejects.toThrow();
      expect(f.storage).toEqual([]);
    }
    const revoked = fixture();
    revoked.setRpc(() => ({ data: false, error: null }));
    await expect(signedFileUrl(owner, "file", false, revoked.client as never)).rejects.toThrow();
    expect(revoked.storage).toEqual([]);
  });

  it("does not disclose staff notes, staff email, account identifiers, or extra fields on an owner-shared file", async () => {
    const f = fixture([
      attachmentRow({ uploaded_by: "staff", note: "PRIVATE staff note", secret: "PRIVATE extra" }),
      requestRow(),
    ]);
    f.rows["profiles"] = [{ id: "staff", full_name: null, email: "PRIVATE@example.invalid" }];
    const result = await listAttachments(owner, "property", "property", f.client as never);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(result.files.find((row) => row["id"] === "file")).toMatchObject({
      uploaded_by: null,
      uploaded_by_name: "ARHA",
      note: null,
      can_delete: false,
    });
    expect(result.files.find((row) => row["id"] === "request")?.note).toBe(
      "Please provide the recorded deed.",
    );
    expect(f.reads).not.toContain("profiles");
    expect(result.canUpload).toBe(true);
  });

  it("keeps existing staff metadata access", async () => {
    const f = fixture([
      attachmentRow({ uploaded_by: "staff", visibility: "internal", note: "Staff context" }),
    ]);
    f.rows["profiles"] = [
      { id: "staff", full_name: "Coordinator", email: "staff@example.invalid" },
    ];
    const result = await listAttachments(
      { userId: "staff", roles: ["onboarding"] },
      "property",
      "property",
      f.client as never,
    );
    expect(result.files[0]).toMatchObject({
      note: "Staff context",
      uploaded_by_name: "Coordinator",
      can_delete: true,
    });
    expect(f.rpcCalls).toEqual([]);
  });

  it("filters mismatched Property, demo and archived documents from an owner's record", async () => {
    const f = fixture([
      attachmentRow(),
      attachmentRow({ id: "wrong-property", property_id: "other" }),
      attachmentRow({ id: "demo", is_demo: true }),
      attachmentRow({ id: "archived", archived_at: "now" }),
    ]);
    const result = await listAttachments(owner, "property", "property", f.client as never);
    expect(result.files.map((row) => row["id"])).toEqual(["file"]);
  });

  it("checks canonical entity context and stored state before minting a URL", async () => {
    for (const override of [
      { property_id: "other" },
      { is_demo: true },
      { archived_at: "now" },
      { deleted_at: "now" },
      { upload_status: "pending" },
      { upload_status: "failed" },
      { visibility: "internal" },
      { entity_type: "unrecognized" },
    ]) {
      const f = fixture([attachmentRow(override)]);
      await expect(signedFileUrl(owner, "file", false, f.client as never)).rejects.toThrow();
      expect(f.storage).toEqual([]);
    }
    const moved = fixture([attachmentRow({ entity_type: "ticket", entity_id: "ticket" })]);
    moved.rows["tickets"] = [
      {
        id: "ticket",
        ref: 12,
        title: "PRIVATE",
        property_id: "other",
        is_demo: false,
        status: "open",
        archived_at: null,
      },
    ];
    await expect(signedFileUrl(owner, "file", false, moved.client as never)).rejects.toThrow();
    expect(moved.storage).toEqual([]);
  });

  it("retains shared evidence on a closed or archived Ticket when its current Property remains eligible", async () => {
    const f = fixture([attachmentRow({ entity_type: "ticket", entity_id: "ticket" })]);
    f.rows["tickets"] = [
      {
        id: "ticket",
        ref: 12,
        title: "PRIVATE",
        property_id: "property",
        is_demo: false,
        status: "closed",
        archived_at: "now",
      },
    ];
    expect(await signedFileUrl(owner, "file", true, f.client as never)).toMatchObject({
      expiresInSeconds: 300,
    });
    expect(f.storage).toHaveLength(1);
  });
});

describe("atomic upload endpoint contract", () => {
  it("uses checked soft-removal without deleting storage, and propagates atomic rollback", async () => {
    const f = fixture();
    const staff = { userId: "staff", roles: ["manager"] };
    f.setRpc(() => ({ data: "file", error: null }));
    expect(await removeAttachment(staff, "file", "Superseded", f.client as never)).toEqual({
      ok: true,
    });
    expect(f.rpcCalls[0]).toEqual({
      name: "archive_attachment",
      args: { _actor_id: "staff", _document_id: "file", _reason: "Superseded" },
    });
    expect(f.storage).toEqual([]);
    expect(f.writes).toEqual([]);
    f.setRpc(() => ({ data: null, error: { message: "history rolled back" } }));
    await expect(removeAttachment(staff, "file", null, f.client as never)).rejects.toMatchObject({
      message: "history rolled back",
    });
    await expect(removeAttachment(owner, "file", null, f.client as never)).rejects.toThrow(
      "access",
    );
    expect(f.storage).toEqual([]);
  });
  it("passes the complete original intent and verified actor to the checked writer before issuing a non-overwrite token", async () => {
    const f = fixture([requestRow()]);
    f.setRpc((name, args) =>
      name === "begin_attachment_upload"
        ? {
            data: {
              documentId: "new",
              path: (args["_input"] as Record<string, unknown>)["path"],
              alreadyStored: false,
            },
            error: null,
          }
        : { data: true, error: null },
    );
    expect(await beginUpload(owner, uploadInput, f.client as never)).toMatchObject({
      documentId: "new",
      token: "test-token",
      alreadyStored: false,
    });
    expect(f.rpcCalls[0]).toMatchObject({
      name: "begin_attachment_upload",
      args: { _actor_id: "owner", _input: { ...uploadInput, kind: "document" } },
    });
    expect(f.writes).toEqual([]);
    expect(f.storage[0]).toMatchObject({ operation: "upload-url", upsert: false });
  });
  it("returns committed retry receipts without minting another upload token", async () => {
    const f = fixture();
    f.setRpc((_name, args) => ({
      data: {
        documentId: "file",
        path: (args["_input"] as Record<string, unknown>)["path"],
        alreadyStored: true,
      },
      error: null,
    }));
    expect(await beginUpload(owner, uploadInput, f.client as never)).toMatchObject({
      documentId: "file",
      alreadyStored: true,
      token: null,
    });
    expect(f.storage).toEqual([]);
  });
  it("rejects unsafe keys and malformed database receipts before storage", async () => {
    const f = fixture();
    await expect(
      beginUpload(owner, { ...uploadInput, uploadKey: "../../other" }, f.client as never),
    ).rejects.toThrow("upload key");
    expect(f.rpcCalls).toEqual([]);
    await expect(beginUpload(owner, uploadInput, f.client as never)).rejects.toThrow("confirm");
    expect(f.storage).toEqual([]);
  });
  it("surfaces authorization, original request, unique-key and lifecycle conflicts without a token or partial local writes", async () => {
    for (const message of [
      "recipient changed",
      "request closed",
      "different upload key",
      "Property context changed",
    ]) {
      const f = fixture();
      f.setRpc(() => ({ data: null, error: { message } }));
      await expect(beginUpload(owner, uploadInput, f.client as never)).rejects.toMatchObject({
        message,
      });
      expect(f.storage).toEqual([]);
      expect(f.writes).toEqual([]);
    }
  });
  it("rejects a different completion request before consulting storage or completing", async () => {
    const f = fixture([attachmentRow({ upload_status: "pending" })]);
    await expect(
      completeUpload(
        owner,
        { documentId: "file", ok: true, fulfilsRequestId: "different" },
        f.client as never,
      ),
    ).rejects.toThrow("Original document request");
    expect(f.storage).toEqual([]);
    expect(f.rpcCalls.some((r) => r.name === "complete_attachment_upload")).toBe(false);
  });
  it("confirms bytes then atomically completes the persisted original request and history", async () => {
    const f = fixture([attachmentRow({ upload_status: "pending" })]);
    expect(
      await completeUpload(owner, { documentId: "file", ok: true }, f.client as never),
    ).toEqual({ ok: true });
    expect(f.rpcCalls.at(-1)).toEqual({
      name: "complete_attachment_upload",
      args: { _actor_id: "owner", _document_id: "file", _ok: true, _fulfils_request_id: null },
    });
    expect(f.storage.map((v) => v.operation)).toEqual(["read-url"]);
    expect(f.writes).toEqual([]);
  });
  it("does not duplicate storage/history writes after a committed completion receipt", async () => {
    const f = fixture();
    expect(
      await completeUpload(owner, { documentId: "file", ok: true }, f.client as never),
    ).toEqual({ ok: true });
    expect(f.storage).toEqual([]);
    expect(f.writes).toEqual([]);
  });
  it("records failed attempts through the transaction without deleting bytes", async () => {
    const f = fixture([attachmentRow({ upload_status: "pending" })]);
    f.setRpc((name) => ({ data: name !== "complete_attachment_upload", error: null }));
    expect(
      await completeUpload(owner, { documentId: "file", ok: false }, f.client as never),
    ).toEqual({ ok: false });
    expect(f.storage).toEqual([]);
    expect(f.writes).toEqual([]);
  });
  it("fails closed when recipient access or transactional completion fails", async () => {
    const f = fixture();
    f.setRpc(() => ({ data: false, error: null }));
    await expect(
      completeUpload(owner, { documentId: "file", ok: true }, f.client as never),
    ).rejects.toThrow("access");
    expect(f.storage).toEqual([]);
    f.setRpc((name) =>
      name === "owner_document_access"
        ? { data: true, error: null }
        : { data: null, error: { message: "history rollback" } },
    );
    await expect(
      completeUpload(owner, { documentId: "file", ok: true }, f.client as never),
    ).rejects.toMatchObject({ message: "history rollback" });
    expect(f.writes).toEqual([]);
  });
  it("hides unbound legacy shares until an explicit staff re-share", async () => {
    const f = fixture([
      attachmentRow({ owner_recipient_id: null, owner_recipient_program_id: null }),
    ]);
    expect((await listAttachments(owner, "property", "property", f.client as never)).files).toEqual(
      [],
    );
    await expect(signedFileUrl(owner, "file", false, f.client as never)).rejects.toThrow();
    expect(f.storage).toEqual([]);
  });
  it("uses checked staff share/request writers and never a second free-text recipient identity", async () => {
    const f = fixture();
    const staff = { userId: "staff", roles: ["onboarding"] };
    f.setRpc((name) => ({
      data: name === "set_attachment_visibility" ? "file" : "request",
      error: null,
    }));
    expect(await setVisibility(staff, "file", "owner_shared", f.client as never)).toEqual({
      ok: true,
    });
    expect(
      await requestOwnerDocument(
        staff,
        { entityType: "property", entityId: "property", title: "Deed" },
        f.client as never,
      ),
    ).toEqual({ documentId: "request" });
    expect(f.writes).toEqual([]);
    expect(f.rpcCalls.map((r) => r.args["_actor_id"])).toEqual(["staff", "staff"]);
    await expect(setVisibility(owner, "file", "owner_shared", f.client as never)).rejects.toThrow(
      "access",
    );
  });
});
