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

it("rejects activation without supervisor authority before reading or writing the program", async () => {
  const checkedRoles: string[] = [];
  let activationCalls = 0;
  const db = {
    from: () => {
      throw new Error("The unauthorized caller must not read or write program tables.");
    },
    rpc: async (name: string, args: Record<string, string>) => {
      if (name === "activate_owner_program") {
        activationCalls++;
        throw new Error("The unauthorized caller must not invoke activation.");
      }
      expect(name).toBe("has_role");
      expect(args["_user_id"]).toBe("staff");
      checkedRoles.push(args["_role"]!);
      return { data: false, error: null };
    },
  };
  let message = "";
  try {
    await activateProgram(db as never, "staff", {
      programId: "program",
      expectedVersion: "reviewed-version",
      startedOn: "2026-09-01",
    });
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain("Only a supervisor");
  expect(checkedRoles.sort()).toEqual(["admin", "manager"]);
  expect(activationCalls).toBe(0);
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
