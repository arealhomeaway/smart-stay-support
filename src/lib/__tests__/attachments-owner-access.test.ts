import { describe, expect, it } from "bun:test";
import { beginUpload, completeUpload, listAttachments, signedFileUrl } from "../attachments.server";
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
    expect(result.files.find((row) => row.id === "file")).toMatchObject({
      uploaded_by: null,
      uploaded_by_name: "ARHA",
      note: null,
      can_delete: false,
    });
    expect(result.files.find((row) => row.id === "request")?.note).toBe(
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
    expect(result.files.map((row) => row.id)).toEqual(["file"]);
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

describe("upload intent and completion boundaries", () => {
  it("keeps a matching stored retry idempotent after its request has already completed", async () => {
    const f = fixture([attachmentRow(), requestRow({ upload_status: "stored" })]);
    expect(await beginUpload(owner, uploadInput, f.client as never)).toMatchObject({
      documentId: "file",
      alreadyStored: true,
    });
    expect(f.writes).toEqual([]);
    expect(f.storage).toEqual([]);
  });

  it("rejects upload-key reuse across actor, entity, Property, mode, path or file facts", async () => {
    for (const override of [
      { uploaded_by: "other" },
      { entity_id: "other" },
      { entity_type: "ticket" },
      { property_id: "other" },
      { is_demo: true },
      { storage_path: "other/path" },
      { original_filename: "other.pdf" },
      { mime_type: "text/plain" },
      { size_bytes: 42 },
      { archived_at: "now" },
      { deleted_at: "now" },
      { upload_status: "failed" },
    ]) {
      const f = fixture([attachmentRow(override), requestRow()]);
      await expect(beginUpload(owner, uploadInput, f.client as never)).rejects.toThrow();
      expect(f.writes).toEqual([]);
      expect(f.storage).toEqual([]);
    }
  });

  it("rejects unsafe upload path keys before loading or writing a record", async () => {
    const f = fixture();
    await expect(
      beginUpload(owner, { ...uploadInput, uploadKey: "../../other" }, f.client as never),
    ).rejects.toThrow("upload key");
    expect(f.reads).toEqual([]);
    expect(f.storage).toEqual([]);
  });

  it("rejects foreign or no-longer-open request slots before issuing an upload token", async () => {
    for (const override of [
      { entity_id: "other" },
      { entity_type: "ticket" },
      { property_id: "other" },
      { is_demo: true },
      { archived_at: "now" },
      { deleted_at: "now" },
      { upload_status: "stored" },
      { uploaded_by: "other" },
      { storage_path: "other/file" },
    ]) {
      const f = fixture([requestRow(override)]);
      await expect(beginUpload(owner, uploadInput, f.client as never)).rejects.toThrow("request");
      expect(f.writes).toEqual([]);
      expect(f.storage).toEqual([]);
    }
  });

  it("checks the winning upload intent after a concurrent unique-key conflict", async () => {
    const f = fixture([requestRow()]);
    f.setWriteError({ code: "23505", message: "duplicate upload key" });
    f.setBeforeWrite(() => f.rows["documents"]!.push(attachmentRow({ uploaded_by: "other" })));
    await expect(beginUpload(owner, uploadInput, f.client as never)).rejects.toThrow("upload key");
    expect(f.storage).toEqual([]);
  });

  it("preserves a legitimate requested owner upload and returns its signed intent", async () => {
    const f = fixture([requestRow()]);
    const result = await beginUpload(owner, uploadInput, f.client as never);
    expect(result).toMatchObject({
      documentId: "created-document",
      alreadyStored: false,
      token: "test-token",
    });
    expect(f.writes[0]?.values).toMatchObject({
      property_id: "property",
      uploaded_by: "owner",
      visibility: "owner_shared",
      upload_status: "pending",
    });
    expect(f.storage[0]?.operation).toBe("upload-url");
    expect(f.storage[0]?.upsert).toBe(false);
  });

  it("never lets a failed completion delete or downgrade a stored file", async () => {
    const f = fixture();
    await expect(
      completeUpload(owner, { documentId: "file", ok: false }, f.client as never),
    ).rejects.toThrow("stored file");
    expect(f.writes).toEqual([]);
    expect(f.storage).toEqual([]);
  });

  it("retains failed pending attempts and bytes instead of deleting them", async () => {
    const f = fixture([attachmentRow({ upload_status: "pending" })]);
    expect(
      await completeUpload(owner, { documentId: "file", ok: false }, f.client as never),
    ).toEqual({ ok: false });
    expect(f.rows["documents"]![0]?.["upload_status"]).toBe("failed");
    expect(f.writes.map((write) => write.operation)).toEqual(["update"]);
    expect(f.storage).toEqual([]);
  });

  it("does not overwrite a completion that wins before a failure update", async () => {
    const f = fixture([attachmentRow({ upload_status: "pending" })]);
    f.setBeforeWrite(() => {
      f.rows["documents"]![0]!["upload_status"] = "stored";
    });
    await expect(
      completeUpload(owner, { documentId: "file", ok: false }, f.client as never),
    ).rejects.toThrow("changed");
    expect(f.rows["documents"]![0]?.["upload_status"]).toBe("stored");
    expect(f.storage).toEqual([]);
  });

  it("rechecks canonical access and rejects unrelated completion requests before writes", async () => {
    const revoked = fixture([attachmentRow({ upload_status: "pending" }), requestRow()]);
    revoked.setRpc(() => ({ data: false, error: null }));
    await expect(
      completeUpload(
        owner,
        { documentId: "file", ok: true, fulfilsRequestId: "request" },
        revoked.client as never,
      ),
    ).rejects.toThrow("access");
    expect(revoked.writes).toEqual([]);
    expect(revoked.storage).toEqual([]);
    const foreign = fixture([
      attachmentRow({ upload_status: "pending" }),
      requestRow({ property_id: "other" }),
    ]);
    await expect(
      completeUpload(
        owner,
        { documentId: "file", ok: true, fulfilsRequestId: "request" },
        foreign.client as never,
      ),
    ).rejects.toThrow("request");
    expect(foreign.writes).toEqual([]);
    expect(foreign.storage).toEqual([]);
  });

  it("completes a legitimate owner request once and returns stored retry receipts without repeated history writes", async () => {
    const f = fixture([attachmentRow({ upload_status: "pending" }), requestRow()]);
    const events: unknown[] = [];
    const audit = async (event: unknown) => {
      events.push(event);
    };
    const input = { documentId: "file", ok: true, fulfilsRequestId: "request" };
    expect(await completeUpload(owner, input, f.client as never, audit)).toEqual({ ok: true });
    expect(f.rows["documents"]!.map((row) => row["upload_status"])).toEqual(["stored", "stored"]);
    expect(events).toHaveLength(1);
    expect(await completeUpload(owner, input, f.client as never, audit)).toEqual({ ok: true });
    expect(events).toHaveLength(1);
    expect(f.writes).toHaveLength(2);
  });
});
