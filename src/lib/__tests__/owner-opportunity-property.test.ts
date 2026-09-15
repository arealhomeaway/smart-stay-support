import { expect, it } from "bun:test";
import { logOwnerTime } from "../owner-portal.server";
import { activateProgram } from "../owner-program.server";

it("rejects program-wide time before activation or before the program start", async () => {
  for (const status of ["draft", "active"]) {
    const db = {
      from: (table: string) => {
        const row =
          table === "owner_reviews"
            ? { id: "opportunity", property_id: null, status: "open" }
            : { owner_user_id: "owner", status, started_on: "2026-09-10" };
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: row, error: null }),
        };
        return query;
      },
    };
    let message = "";
    try {
      await logOwnerTime(db as never, "owner", {
        programId: "program",
        phase: "onboarding",
        entryDate: "2026-09-01",
        minutes: 30,
        activity: "Program meeting",
        activityCategory: "planning",
        output: "Notes",
        comments: "",
        attachmentPath: null,
        reviewId: "opportunity",
        ticketId: null,
        propertyIds: [],
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(status === "draft" ? "activate this program" : "program start");
  }
});

it("rejects activation before an included property's closing without writing", async () => {
  let writes = 0;
  const db = {
    from: (table: string) => {
      const row =
        table === "owner_programs"
          ? { status: "ready_for_onboarding", dfy_confirmed: true }
          : [{ closing_confirmed: true, closing_date: "2026-09-10" }];
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: row, error: null }),
        update: () => {
          writes++;
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: row, error: null }).then(resolve),
      };
      return query;
    },
  };
  let message = "";
  try {
    await activateProgram(db as never, "staff", { programId: "program", startedOn: "2026-09-01" });
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain("every included property's closing");
  expect(writes).toBe(0);
});

it("rejects a property-specific opportunity logged against another home before writing", async () => {
  let reads = 0;
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({
      data: { id: "opportunity", property_id: "home-a", status: "open", available_from: null },
      error: null,
    }),
  };
  const db = {
    from: () => {
      reads++;
      return query;
    },
  };
  let message = "";
  try {
    await logOwnerTime(db as never, "owner", {
      programId: "program",
      phase: "onboarding",
      entryDate: "2026-09-14",
      minutes: 30,
      activity: "Review layout",
      activityCategory: "planning",
      output: "Decision recorded",
      comments: "",
      attachmentPath: null,
      reviewId: "opportunity",
      ticketId: null,
      propertyIds: ["home-b"],
    });
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain("different property");
  expect(reads).toBe(1);
});
