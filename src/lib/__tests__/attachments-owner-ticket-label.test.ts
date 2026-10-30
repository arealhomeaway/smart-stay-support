import { expect, it } from "bun:test";
import { listOwnerFileRecords, type Viewer } from "../attachments.server";

const owner: Viewer = { userId: "owner", roles: ["owner"] };

function fileRecordsClient(title: string, enrolled = true, programs: { owner?: string[]; member?: string[] } = { owner: ["program"] }) {
  const reads: string[] = [];
  const rows: Record<string, Record<string, unknown>[]> = {
    owner_programs: (programs.owner ?? []).map((id) => ({ id })),
    program_members: (programs.member ?? []).map((program_id) => ({ program_id })),
    owner_program_properties: enrolled
      ? [{ property_id: "property", inclusion_status: "included", archived_at: null }]
      : [],
    documents: [
      {
        id: "shared-file",
        entity_type: "ticket",
        entity_id: "ticket",
        requested_from: null,
        upload_status: "stored",
        visibility: "owner_shared",
        property_id: "property",
        is_demo: false,
        archived_at: null,
      },
      {
        id: "requested-file",
        entity_type: "ticket",
        entity_id: "ticket",
        requested_from: "owner",
        upload_status: "pending",
        visibility: "owner_shared",
        property_id: "property",
        is_demo: false,
        archived_at: null,
      },
    ],
    tickets: [
      {
        id: "ticket",
        ref: 42,
        title,
        property_id: "property",
        status: "closed",
        archived_at: "2026-09-15T12:00:00Z",
        is_demo: false,
        description: "PRIVATE guest and access details",
      },
    ],
  };
  const client = {
    rpc: async () => ({ data: enrolled, error: null }),
    from: (table: string) => {
      reads.push(table);
      const result = { data: rows[table] ?? [], error: null };
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        is: () => query,
        or: () => query,
        order: () => query,
        maybeSingle: async () => ({ data: result.data[0] ?? null, error: null }),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
      };
      return query;
    },
  };
  return { client, reads };
}

it("keeps shared and requested files linked to a Ticket without returning its internal title", async () => {
  const { client } = fileRecordsClient("PRIVATE guest name, room and access code");
  const result = await listOwnerFileRecords(owner, client as never);
  expect(result.records).toEqual([
    {
      entityType: "ticket",
      entityId: "ticket",
      shared: 1,
      openRequestId: "requested-file",
      label: "Property work · Ticket #42",
    },
  ]);
  expect(JSON.stringify(result)).not.toContain("PRIVATE");

  const edited = fileRecordsClient("A different PRIVATE staff-only narrative");
  expect(await listOwnerFileRecords(owner, edited.client as never)).toEqual(result);
});

it("restricts the owner file index to external owner accounts; staff retain their separate record file interface", async () => {
  for (const roles of [
    ["admin"],
    ["manager"],
    ["onboarding"],
    ["tech"],
    ["owner", "tech"],
    ["vendor"],
    [],
  ]) {
    const { client } = fileRecordsClient("Internal maintenance detail");
    const result = await listOwnerFileRecords({ userId: "owner", roles }, client as never);
    expect(result.records).toEqual([]);
  }
  for (const roles of [["owner"]]) {
    const { client } = fileRecordsClient("PRIVATE internal title");
    const result = await listOwnerFileRecords({ userId: "owner", roles }, client as never);
    expect(result.records[0]?.label).toBe("Property work · Ticket #42");
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  }
});

it("does not read Ticket records when the existing enrollment check provides no properties", async () => {
  const { client, reads } = fileRecordsClient("PRIVATE internal title", false);
  expect(await listOwnerFileRecords(owner, client as never)).toEqual({ records: [] });
  expect(reads).toEqual(["owner_programs", "program_members", "owner_program_properties"]);
});

it("gives an active co-owner the same file records as the main homeowner", async () => {
  const main = await listOwnerFileRecords(owner, fileRecordsClient("PRIVATE t").client as never);
  const co = await listOwnerFileRecords(owner, fileRecordsClient("PRIVATE t", true, { member: ["program"] }).client as never);
  expect(co).toEqual(main);
  expect(co.records.length).toBe(1);
});

it("returns nothing, and reads no homes, for a login that is neither main homeowner nor active co-owner", async () => {
  const { client, reads } = fileRecordsClient("PRIVATE t", true, {});
  expect(await listOwnerFileRecords(owner, client as never)).toEqual({ records: [] });
  expect(reads).toEqual(["owner_programs", "program_members"]);
});
