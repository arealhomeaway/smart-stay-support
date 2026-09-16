import { expect, it } from "bun:test";
import { createProgram } from "../owner-program.server";
import { canonicalEnrollmentOwner } from "../owner-enrollment-identity.server";

it("enrolls through one atomic canonical action without transmitting contact-text identity", async () => {
  const calls: unknown[] = [];
  const db = {
    from: () => {
      throw new Error("Separate table enrollment must not run");
    },
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args]);
      return { data: { programId: "program", alreadyExists: false }, error: null };
    },
  };
  expect(
    await createProgram(db as never, "staff", {
      propertyId: "property",
      ownerName: "Untrusted name",
      ownerEmail: "other@example.invalid",
    }),
  ).toEqual({ programId: "program", alreadyExists: false });
  expect(calls).toEqual([["create_owner_program", { _property_id: "property" }]]);
});

it("a canonical enrollment conflict never falls back to a contact-text program", async () => {
  let calls = 0;
  const db = {
    from: () => {
      throw new Error("Unsafe contact fallback");
    },
    rpc: async () => {
      calls++;
      return {
        data: null,
        error: new Error("The Property changed canonical Owner. Refresh before enrolling."),
      };
    },
  };
  await expect(
    createProgram(db as never, "staff", {
      propertyId: "property",
      ownerName: "Legacy contact",
      ownerEmail: "owner@example.invalid",
    }),
  ).rejects.toThrow("changed canonical Owner");
  expect(calls).toBe(1);
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
