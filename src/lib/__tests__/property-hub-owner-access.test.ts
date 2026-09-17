import { expect, it } from "bun:test";
import { loadPropertyHub } from "../property-hub.server";
import {
  attachmentRow,
  ownerFileTestClient,
  ownerFileViewer as owner,
  propertyRow,
  requestRow,
} from "./owner-file-test-client";

function fixture() {
  const property = propertyRow({
    nickname: "Home",
    address_line1: "123 Owner Lane",
    city: "Austin",
    state: "TX",
    market: "Austin",
    lifecycle_status: "onboarding",
    onboarding_stage: "property_setup",
    active: true,
    updated_at: "2026-09-16T12:00:00Z",
    actual_closing_on: "2026-09-01",
    bedrooms: 3,
    bathrooms: 2,
  });
  const f = ownerFileTestClient({
    properties: [
      {
        ...property,
        notes: "PRIVATE property notes",
        access_notes: "PRIVATE access",
        wifi_notes: "PRIVATE wifi",
      },
    ],
    onboarding_tasks: [
      {
        id: "task",
        property_id: "property",
        title: "PRIVATE task title",
        stage: "property_setup",
        status: "blocked",
        due_on: "2026-09-20",
        blocker: "PRIVATE blocker",
        requires_owner_approval: true,
        owner_approval_status: "pending",
        blocks_handoff: true,
        assigned_to: "PRIVATE actor",
        parent_task_id: null,
        archived_at: null,
        is_demo: false,
      },
    ],
    tickets: [
      {
        id: "ticket",
        property_id: "property",
        ref: 42,
        title: "PRIVATE Ticket title",
        status: "open",
        priority: "p1",
        archived_at: null,
        is_demo: false,
      },
    ],
    documents: [
      attachmentRow({ uploaded_by: "staff", note: "PRIVATE document note" }),
      requestRow(),
    ],
    approvals: [
      {
        id: "approval",
        property_id: "property",
        title: "PRIVATE approval",
        decision_note: "PRIVATE decision",
      },
    ],
    owner_program_properties: [
      {
        property_id: "property",
        archived_at: null,
        owner_programs: { id: "other-program", owner_name: "PRIVATE other Owner" },
      },
    ],
    profiles: [{ id: "staff", full_name: "PRIVATE staff identity" }],
    audit_log: [
      {
        id: "audit",
        entity_type: "ticket",
        action: "updated",
        entity_label: "Owner home PRIVATE unrelated audit",
        reason: "PRIVATE audit reason",
      },
    ],
    feature_flags: [{ key: "quarterly_reviews", enabled: true }],
    property_handoffs: [
      {
        id: "handoff",
        property_id: "property",
        is_demo: false,
        archived_at: null,
        status: "pending",
        gate_step: "kati_review",
        requested_at: "2026-09-16T12:00:00Z",
        private_note: "PRIVATE handoff note",
      },
    ],
  });
  f.setRpc((name, args) => {
    if (name === "owner_document_access")
      return {
        data: f.rows["documents"]!.some(
          (row) =>
            row["id"] === args["_document_id"] &&
            !!row["owner_recipient_id"] &&
            !!row["owner_recipient_program_id"],
        ),
        error: null,
      };
    if (name === "read_owner_properties")
      return {
        data: [
          { id: "property", program_id: "current-program", program_status: "active", property },
        ],
        error: null,
      };
    if (name === "read_owner_programs")
      return {
        data: [
          {
            id: "current-program",
            program: {
              id: "current-program",
              owner_name: "Canonical Owner",
              status: "active",
              started_on: "2026-09-01",
              ends_on: "2026-11-30",
            },
          },
        ],
        error: null,
      };
    return { data: args["_property_id"] === "property", error: null };
  });
  return f;
}

it("uses current owner-safe Property/program projections without leaking internal tasks, audit labels, notes or other Owners", async () => {
  const f = fixture();
  const result = await loadPropertyHub(owner, "property", f.client as never);
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(result.property).toMatchObject({
    id: "property",
    address: "123 Owner Lane, Austin, TX",
    bedrooms: 3,
    internalNotes: null,
  });
  expect(result.overview.program).toMatchObject({
    id: "current-program",
    ownerName: "Canonical Owner",
  });
  expect(result.onboarding.blockers[0]).toMatchObject({ title: "Onboarding work", blocker: null });
  expect(result.onboarding.ownerActions[0]?.title).toBe("Owner onboarding review");
  expect(result.activity).toEqual([]);
  expect(result.operations).toEqual({ tickets: [], workOrders: [] });
  expect(result.documents.find((row) => row["id"] === "request")?.note).toBe(
    "Please provide the recorded deed.",
  );
  expect(result.documents.find((row) => row["id"] === "file")?.uploadedByName).toBe("ARHA");
  expect(f.reads).not.toContain("owner_program_properties");
  expect(f.reads).not.toContain("audit_log");
  expect(f.reads).not.toContain("profiles");
  expect(f.rpcCalls).toContainEqual({
    name: "read_owner_programs",
    args: { _program_id: "current-program", _actor_id: "owner" },
  });
});

it("denies missing or failed current Property scope before querying internal work", async () => {
  for (const result of [
    { data: [], error: null },
    { data: [], error: { message: "scope error" } },
  ]) {
    const f = fixture();
    f.setRpc(() => result);
    await expect(loadPropertyHub(owner, "property", f.client as never)).rejects.toThrow(
      "not one of yours",
    );
    expect(f.reads).toEqual([]);
  }
});

it("denies non-owner external roles even if a stale client thought enrollment was sufficient", async () => {
  for (const roles of [[], ["vendor"], ["owner", "vendor"]]) {
    const f = fixture();
    await expect(
      loadPropertyHub({ userId: "owner", roles }, "property", f.client as never),
    ).rejects.toThrow();
    expect(f.reads).toEqual([]);
    expect(f.rpcCalls).toEqual([]);
  }
});

it("filters a shared file whose Ticket moved to another Property", async () => {
  const f = fixture();
  f.rows["documents"]!.push(
    attachmentRow({ id: "moved-file", entity_type: "ticket", entity_id: "moved-ticket" }),
  );
  f.rows["tickets"]!.push({
    id: "moved-ticket",
    property_id: "other",
    title: "PRIVATE moved Ticket",
    is_demo: false,
  });
  const result = await loadPropertyHub(owner, "property", f.client as never);
  expect(result.documents.map((row) => row["id"])).toEqual(["file", "request"]);
});

it("does not return a response when canonical access is revoked during the other Hub reads", async () => {
  const f = fixture();
  const rpc = f.client.rpc;
  f.client.rpc = async (name, args) =>
    name === "owner_property_access" ? { data: false, error: null } : rpc(name, args);
  await expect(loadPropertyHub(owner, "property", f.client as never)).rejects.toThrow();
});

it("preserves internal operational context for authorized staff", async () => {
  const f = fixture();
  const result = await loadPropertyHub(
    { userId: "staff", roles: ["onboarding"] },
    "property",
    f.client as never,
  );
  expect(result.property.internalNotes).toBe("PRIVATE property notes");
  expect(result.onboarding.blockers[0]?.blocker).toBe("PRIVATE blocker");
  expect(result.operations.tickets[0]?.title).toBe("PRIVATE Ticket title");
  expect(result.documents.find((row) => row["id"] === "file")?.note).toBe("PRIVATE document note");
  expect(f.rpcCalls).toEqual([]);
});
