import { expect, it } from "bun:test";
import { createProgram } from "../owner-program.server";
import {
  assertEnrollmentOwner,
  canonicalEnrollmentOwner,
} from "../owner-enrollment-identity.server";

it("canonical enrollment rejects missing and different owner links", () => {
  for (const owner of [null, "different-owner"]) {
    let denied = false;
    try {
      assertEnrollmentOwner(owner, "canonical-owner");
    } catch {
      denied = true;
    }
    expect(denied).toBe(true);
  }
  assertEnrollmentOwner("canonical-owner", "canonical-owner");
});

it("program creation uses canonical identity and contact snapshots, ignoring submitted name/email", async () => {
  const inserts: { table: string; value: Record<string, unknown> }[] = [];
  const filters: [string, string, unknown][] = [];
  const db = {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push([table, key, value]);
          return query;
        },
        is: () => query,
        not: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({
          data:
            table === "properties"
              ? {
                  id: "property",
                  owner_record_id: "canonical-owner",
                  is_demo: false,
                  actual_closing_on: null,
                }
              : table === "property_owners"
                ? {
                    id: "canonical-owner",
                    name: "Canonical name",
                    email: "canonical@example.invalid",
                    active: true,
                  }
                : { id: "program" },
          error: null,
        }),
        insert: (value: Record<string, unknown>) => {
          inserts.push({ table, value });
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return query;
    },
  };
  expect(
    await createProgram(db as never, "staff", {
      propertyId: "property",
      ownerName: "Wrong name",
      ownerEmail: "another@example.invalid",
    }),
  ).toEqual({ programId: "program", alreadyExists: false });
  const program = inserts.find((insert) => insert.table === "owner_programs")!.value;
  expect(program["owner_record_id"]).toBe("canonical-owner");
  expect(program["owner_name"]).toBe("Canonical name");
  expect(program["owner_email"]).toBe("canonical@example.invalid");
  expect(
    filters.some(
      ([table, key, value]) =>
        table === "owner_programs" && key === "owner_record_id" && value === "canonical-owner",
    ),
  ).toBe(true);
  expect(filters.some(([, key]) => key === "owner_email")).toBe(false);
});

it("a missing property Owner never falls back to a contact lookup", async () => {
  const queried: string[] = [];
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: { owner_record_id: null }, error: null }),
  };
  const message = await canonicalEnrollmentOwner(
    {
      from: (table: string) => {
        queried.push(table);
        return query;
      },
    } as never,
    "property",
  ).then(
    () => "allowed",
    (error: Error) => error.message,
  );
  expect(message).toContain("canonical Owner");
  expect(queried).toEqual(["properties"]);
});
