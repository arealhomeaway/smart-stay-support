import { describe, expect, it } from "bun:test";
import { requireLeadership } from "@/lib/oversight-access.server";
import { can, ROLE_CAPABILITIES, type AppRole } from "@/lib/permissions";
import { filterHomeowners, type HomeownerRow } from "@/lib/homeowners";
import { enrolledRows, oversightSummary, type OversightInput } from "@/lib/owner-oversight";

/**
 * Positive and negative authorization for every program-wide homeowner read:
 * the oversight endpoint and the homeowner directory endpoint.
 */

type FakeRoles = { admin?: boolean; manager?: boolean };

function fakeSupabase(roles: FakeRoles, fail = false) {
  return {
    rpc: async (_name: string, args: { _user_id: string; _role: string }) => {
      if (fail) return { data: null, error: new Error("role lookup unavailable") };
      if (args._role === "admin") return { data: Boolean(roles.admin), error: null };
      if (args._role === "manager") return { data: Boolean(roles.manager), error: null };
      return { data: false, error: null };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const ENDPOINTS = ["Active Owner program oversight", "The homeowner directory"] as const;

describe("leadership-only oversight endpoints", () => {
  for (const what of ENDPOINTS) {
    it(`lets the platform owner read ${what}`, async () => {
      expect(await requireLeadership(fakeSupabase({ admin: true }), "u1", what)).toBe(
        "platform_owner",
      );
    });

    it(`lets a director read ${what}`, async () => {
      expect(await requireLeadership(fakeSupabase({ manager: true }), "u2", what)).toBe("director");
    });

    it(`refuses a coordinator, onboarding staff, vendor and homeowner for ${what}`, async () => {
      for (const who of ["tech", "onboarding", "vendor", "owner"]) {
        await expect(requireLeadership(fakeSupabase({}), `u-${who}`, what)).rejects.toThrow(
          /limited to directors and the platform owner/,
        );
      }
    });

    it(`fails closed for ${what} when the role lookup errors`, async () => {
      await expect(
        requireLeadership(fakeSupabase({ admin: true }, true), "u3", what),
      ).rejects.toThrow(/Could not verify/);
    });
  }
});

describe("capability catalog", () => {
  const leadership: AppRole[] = ["admin", "manager"];
  const everyoneElse: AppRole[] = ["tech", "onboarding", "vendor", "owner"];

  it("grants oversight and directory only to leadership", () => {
    for (const role of leadership) {
      expect(can([role], "owner_oversight")).toBe(true);
      expect(can([role], "homeowner_directory")).toBe(true);
    }
    for (const role of everyoneElse) {
      expect(can([role], "owner_oversight")).toBe(false);
      expect(can([role], "homeowner_directory")).toBe(false);
    }
  });

  it("gives homeowners and vendors no staff capabilities at all", () => {
    expect(ROLE_CAPABILITIES.owner).toEqual([]);
    expect(ROLE_CAPABILITIES.vendor).toEqual([]);
  });
});

describe("oversight shaping", () => {
  const base: OversightInput = {
    id: "p1",
    ownerName: "Riley Adler",
    ownerEmail: "riley@example.com",
    ownerLinked: true,
    status: "active",
    startedOn: "2026-08-22",
    endsOn: "2026-11-20",
    day: 30,
    daysLeft: 60,
    reportedHours: 10,
    benchmark: 40,
    goalMet: false,
    openTasks: 2,
    lastOwnerActivityAt: "2026-09-10T12:00:00Z",
    lastNotificationAt: "2026-09-18T12:00:00Z",
    properties: [{ id: "h1", name: "Willow Creek Cottage" }],
  };

  it("keeps drafts out and flags a behind-pace owner with a checkpoint due", () => {
    const rows = enrolledRows([base, { ...base, id: "p2", status: "draft" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.health.label).toBe("Behind pace");
    expect(rows[0]!.reviewDueSoon).toBe(true);
    expect(rows[0]!.lastContactAt).toBe("2026-09-18T12:00:00Z");
  });

  it("summarises the program", () => {
    const summary = oversightSummary(enrolledRows([base, { ...base, id: "p3", reportedHours: 60 }]));
    expect(summary).toMatchObject({ enrolled: 2, onPace: 1, behind: 1, awaitingOwner: 2 });
    expect(summary.totalHours).toBe(70);
  });
});

describe("homeowner directory filters", () => {
  const rows: HomeownerRow[] = [
    {
      id: "o1",
      name: "Riley Adler",
      email: "riley@example.com",
      phone: null,
      ownerType: "primary",
      properties: [{ id: "h1", name: "Willow Creek Cottage" }],
      hasLogin: true,
      enrollment: "enrolled",
      programId: "p1",
      daysLeft: 60,
    },
    {
      id: "o2",
      name: "Sam Beck",
      email: "sam@example.com",
      phone: null,
      ownerType: "secondary",
      properties: [{ id: "h2", name: "Birch Lane Retreat" }],
      hasLogin: false,
      enrollment: "not_enrolled",
      programId: null,
      daysLeft: null,
    },
  ];

  it("searches by home as well as by person", () => {
    expect(filterHomeowners(rows, { search: "birch" }).map((r) => r.name)).toEqual(["Sam Beck"]);
  });

  it("filters by enrollment and login", () => {
    expect(filterHomeowners(rows, { enrollment: "enrolled" })).toHaveLength(1);
    expect(filterHomeowners(rows, { login: "no_login" }).map((r) => r.id)).toEqual(["o2"]);
  });
});
