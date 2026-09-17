import { expect, it } from "bun:test";
import { ownerProgramProjection } from "../owner-program-projection";

it("excludes staff notes and future unrestricted fields from the serialized owner program", () => {
  const source = {
    id: "program",
    ownerName: "Owner",
    status: "active",
    startedOn: "2026-09-01",
    notifyEmail: true,
    internalNotes: "PRIVATE STAFF NOTES",
    futureStaffOnlyField: "SECRET",
  } as unknown as Parameters<typeof ownerProgramProjection>[0];
  const payload = JSON.parse(JSON.stringify(ownerProgramProjection(source)));
  expect(payload).toEqual({
    id: "program",
    ownerName: "Owner",
    status: "active",
    startedOn: "2026-09-01",
    notifyEmail: true,
  });
  expect(source.internalNotes).toBe("PRIVATE STAFF NOTES");
});
