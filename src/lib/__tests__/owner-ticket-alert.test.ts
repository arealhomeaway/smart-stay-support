import { expect, it } from "bun:test";
import { ticketAlertRecipient } from "../owner-ticket-alert.server";

const alert = { program_id: "program", ticket_id: "ticket", owner_user_id: "user" };
async function rejects(work: Promise<unknown>) {
  let rejected = false;
  try {
    await work;
  } catch {
    rejected = true;
  }
  expect(rejected).toBe(true);
}
function fixture(change: Record<string, unknown> = {}, failedTable?: string) {
  const records: Record<string, unknown> = {
    owner_programs: {
      id: "program",
      owner_record_id: "owner",
      owner_user_id: "user",
      status: "active",
      archived_at: null,
      is_demo: false,
    },
    tickets: { id: "ticket", property_id: "home", ref: 42, is_demo: false },
    properties: { id: "home", owner_record_id: "owner", is_demo: false },
    owner_program_properties: {
      program_id: "program",
      property_id: "home",
      inclusion_status: "included",
    },
    property_owners: {
      id: "owner",
      active: true,
      name: "Canonical",
      email: "canonical@example.test",
      phone: "555",
    },
    ...change,
  };
  return {
    from: (table: string) => {
      let data = records[table] as Record<string, unknown> | null;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          if (data && data[key] !== value) data = null;
          return query;
        },
        single: async () => ({
          data,
          error: failedTable === table || !data ? new Error("unavailable") : null,
        }),
        maybeSingle: async () => ({
          data,
          error: failedTable === table ? new Error("unavailable") : null,
        }),
      };
      return query;
    },
  };
}
it("routes Ticket alerts using the canonical Owner contact for an included secondary property", async () => {
  const recipient = await ticketAlertRecipient(fixture() as never, alert);
  expect(recipient.owner_email).toBe("canonical@example.test");
  expect(recipient.ticketRef).toBe(42);
});
it("blocks stale owner, property, enrollment and demo relationships", async () => {
  const invalid = [
    { properties: { id: "home", owner_record_id: "another-owner", is_demo: false } },
    { properties: { id: "home", owner_record_id: "owner", is_demo: true } },
    { owner_program_properties: null },
    {
      owner_program_properties: {
        program_id: "other",
        property_id: "home",
        inclusion_status: "included",
      },
    },
    {
      owner_program_properties: {
        program_id: "program",
        property_id: "home",
        inclusion_status: "removed",
      },
    },
    { tickets: { id: "ticket", property_id: "home", is_demo: true } },
    { property_owners: { id: "owner", active: false } },
  ];
  for (const change of invalid)
    await rejects(ticketAlertRecipient(fixture(change) as never, alert));
  await rejects(ticketAlertRecipient(fixture() as never, { ...alert, owner_user_id: "old-user" }));
});
it("fails closed if a relationship lookup fails", async () => {
  for (const table of [
    "owner_programs",
    "tickets",
    "properties",
    "owner_program_properties",
    "property_owners",
  ])
    await rejects(ticketAlertRecipient(fixture({}, table) as never, alert));
});
it("blocks inactive, demo, archived and unresolved programs", async () => {
  const program = {
    id: "program",
    owner_record_id: "owner",
    owner_user_id: "user",
    status: "active",
    archived_at: null,
    is_demo: false,
  };
  for (const change of [
    { status: "completed" },
    { status: "closed" },
    { status: "draft" },
    { is_demo: true },
    { archived_at: "2026-09-15" },
    { owner_record_id: null },
  ]) {
    await rejects(
      ticketAlertRecipient(fixture({ owner_programs: { ...program, ...change } }) as never, alert),
    );
  }
});
