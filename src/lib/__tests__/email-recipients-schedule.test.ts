import { describe, expect, it } from "bun:test";
import {
  EMPTY_RECIPIENTS,
  addRecipients,
  findRecipient,
  recipientProblems,
  removeRecipient,
  scheduleProblems,
  zonedToInstant,
} from "@/lib/email-composer";

describe("recipient chips", () => {
  it("adds several pasted addresses at once", () => {
    const { lists, added, errors } = addRecipients(
      EMPTY_RECIPIENTS,
      "to",
      "a@x.com, b@x.com c@x.com",
    );
    expect(added).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
    expect(errors).toEqual([]);
    expect(lists.to).toHaveLength(3);
  });

  it("refuses a bad address and says so", () => {
    const { lists, errors } = addRecipients(EMPTY_RECIPIENTS, "to", "not-an-address");
    expect(lists.to).toEqual([]);
    expect(errors[0]).toContain("not a valid email address");
  });

  it("catches the same person twice, even across To and Cc", () => {
    const first = addRecipients(EMPTY_RECIPIENTS, "to", "owner@x.com").lists;
    const second = addRecipients(first, "cc", "Owner@x.com");
    expect(second.added).toEqual([]);
    expect(second.errors[0]).toContain("already on this message under To");
    expect(findRecipient(first, "OWNER@X.COM")).toBe("to");
  });

  it("removes a chip without touching the others", () => {
    const lists = addRecipients(EMPTY_RECIPIENTS, "bcc", "a@x.com b@x.com").lists;
    expect(removeRecipient(lists, "bcc", "A@x.com").bcc).toEqual(["b@x.com"]);
  });

  it("requires at least one To recipient", () => {
    expect(recipientProblems(EMPTY_RECIPIENTS)[0]).toContain("at least one recipient in To");
    const lists = addRecipients(EMPTY_RECIPIENTS, "to", "a@x.com").lists;
    expect(recipientProblems(lists)).toEqual([]);
  });
});

describe("scheduled sending", () => {
  it("reads a wall-clock time in the chosen zone", () => {
    const instant = zonedToInstant({
      date: "2026-07-01",
      time: "09:00",
      timeZone: "America/Chicago",
    });
    // July is CDT (UTC-5), so 9 a.m. Central is 14:00 UTC.
    expect(instant?.toISOString()).toBe("2026-07-01T14:00:00.000Z");
  });

  it("respects winter time in the same zone", () => {
    const instant = zonedToInstant({
      date: "2026-01-15",
      time: "09:00",
      timeZone: "America/Chicago",
    });
    expect(instant?.toISOString()).toBe("2026-01-15T15:00:00.000Z");
  });

  it("asks for the missing pieces", () => {
    expect(scheduleProblems({ date: "", time: "", timeZone: "UTC" })).toHaveLength(2);
  });

  it("refuses a time already past", () => {
    const now = new Date("2026-07-01T20:00:00.000Z");
    expect(
      scheduleProblems({ date: "2026-07-01", time: "09:00", timeZone: "America/Chicago" }, now),
    ).toEqual(["Pick a time in the future."]);
    expect(
      scheduleProblems({ date: "2026-07-02", time: "09:00", timeZone: "America/Chicago" }, now),
    ).toEqual([]);
  });
});
