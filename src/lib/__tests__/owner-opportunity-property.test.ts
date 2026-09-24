import { expect, it } from "bun:test";
import { logOwnerTime } from "../owner-portal.server";
import { activateProgram } from "../owner-program.server";

it("preserves atomic program activation/date rejection without a stale eligibility preflight", async () => {
  for (const status of ["draft", "active"]) {
    const db = {
      from: () => {
        throw new Error("No stale raw owner reads");
      },
      rpc: async (name: string) => {
        expect(name).toBe("log_owner_time_entry");
        return {
          data: null,
          error: new Error(status === "draft" ? "activate this program" : "program start"),
        };
      },
    };
    let message = "";
    try {
      await logOwnerTime(db as never, "owner", {
        confirmed: true,
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
      if (name === "is_onboarding_director") return { data: false, error: null };
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
  const db = {
    from: () => {
      reads++;
      throw new Error("Owner raw table read");
    },
    rpc: async (name: string, args: { _property_ids: string[] }) => {
      expect(name).toBe("log_owner_time_entry");
      expect(args._property_ids).toEqual(["home-b"]);
      return { data: null, error: new Error("That opportunity belongs to a different property.") };
    },
  };
  let message = "";
  try {
    await logOwnerTime(db as never, "owner", {
      confirmed: true,
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
  expect(reads).toBe(0);
});
