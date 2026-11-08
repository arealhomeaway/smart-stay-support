/**
 * Who can use Direct Bookings, checked through the real permission model
 * (ROLE_CAPABILITIES, canOpenPath) and the same menu and tab rules the app
 * shell renders from. Property Coordinators ("tech") must reach Requests;
 * Settings stay with Supervisors and Platform Owners.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { can, type AppRole } from "../permissions";
import { canOpenPath } from "../route-access";
import { directBookingsMenuTarget, pageTabGroupFor, visiblePageTabs, type NavAccess } from "../shell-nav";

function accessFor(roles: AppRole[], guestExperienceSeat = false): NavAccess {
  return {
    can: (c) => can(roles, c),
    canOpen: (p) => canOpenPath(p, { roles }),
    guestExperienceSeat,
  };
}

const tabsFor = (roles: AppRole[], seat = false) =>
  visiblePageTabs(pageTabGroupFor("/direct-bookings")!, accessFor(roles, seat)).map((t) => t.label);

describe("Direct Bookings menu item", () => {
  it("a Property Coordinator sees Direct Bookings opening /direct-bookings", () => {
    expect(directBookingsMenuTarget(accessFor(["tech"]))).toBe("/direct-bookings");
  });
  it("a Supervisor sees Direct Bookings opening /direct-bookings", () => {
    expect(directBookingsMenuTarget(accessFor(["manager"]))).toBe("/direct-bookings");
  });
  it("a Platform Owner sees Direct Bookings opening /direct-bookings", () => {
    expect(directBookingsMenuTarget(accessFor(["admin"]))).toBe("/direct-bookings");
  });
  it("onboarding, vendor and homeowner accounts get no Direct Bookings item", () => {
    for (const role of ["onboarding", "vendor", "owner"] as AppRole[]) {
      expect(directBookingsMenuTarget(accessFor([role]))).toBeNull();
    }
  });
});

describe("Direct Bookings pages", () => {
  it("a Property Coordinator can open the list and a request, not Settings", () => {
    expect(canOpenPath("/direct-bookings", { roles: ["tech"] })).toBe(true);
    expect(canOpenPath("/direct-bookings/2b1c6a3e-0000-4000-8000-000000000001", { roles: ["tech"] })).toBe(true);
    expect(canOpenPath("/direct-bookings/settings", { roles: ["tech"] })).toBe(false);
  });
  it("Supervisors and Platform Owners can open Settings", () => {
    expect(canOpenPath("/direct-bookings/settings", { roles: ["manager"] })).toBe(true);
    expect(canOpenPath("/direct-bookings/settings", { roles: ["admin"] })).toBe(true);
  });
  it("onboarding, vendor and homeowner accounts cannot open Direct Bookings", () => {
    for (const role of ["onboarding", "vendor", "owner"] as AppRole[]) {
      expect(can([role], "direct_bookings_work")).toBe(false);
      expect(canOpenPath("/direct-bookings", { roles: [role] })).toBe(false);
    }
  });
});

describe("Direct Bookings tabs", () => {
  it("a Property Coordinator sees Requests and Referral sources, not Settings", () => {
    expect(tabsFor(["tech"])).toEqual(["Requests", "Referral sources"]);
  });
  it("a Guest Experience team member still does not see Settings", () => {
    expect(tabsFor(["tech"], true)).toEqual(["Requests", "Referral sources"]);
  });
  it("Supervisors and Platform Owners see all three tabs", () => {
    expect(tabsFor(["manager"])).toEqual(["Requests", "Referral sources", "Settings"]);
    expect(tabsFor(["admin"])).toEqual(["Requests", "Referral sources", "Settings"]);
  });
});

describe("staged database rules", () => {
  const sql = readFileSync("docs/pending/direct-bookings/01_direct_bookings.sql", "utf8");
  const body = (name: string) => {
    const start = sql.indexOf(`FUNCTION public.${name}(`);
    expect(start).toBeGreaterThan(-1);
    return sql.slice(start, sql.indexOf("END $$;", start));
  };
  it("any internal staff can create, start, follow up and mark an outcome", () => {
    for (const fn of ["create_direct_booking", "start_direct_booking", "record_direct_booking_follow_up", "mark_direct_booking_outcome"]) {
      expect(body(fn)).toMatch(/is_internal_staff\(auth\.uid\(\)\)/);
      expect(body(fn)).not.toMatch(/has_role|holds_functional_role/);
    }
  });
  it("sending for approval and recording the reply belong to whoever pressed Start", () => {
    expect(body("request_direct_booking_approval")).toMatch(/owned_by IS DISTINCT FROM auth\.uid\(\)/);
    expect(body("record_direct_booking_reply")).toMatch(/owned_by IS DISTINCT FROM auth\.uid\(\)/);
  });
  it("only the Supervisor and Director roles approve or send back", () => {
    const decide = body("decide_direct_booking_approval");
    expect(decide).toMatch(/holds_functional_role\(auth\.uid\(\), 'ops_supervisor'\)/);
    expect(decide).toMatch(/holds_functional_role\(auth\.uid\(\), 'director_ops'\)/);
    expect(decide).not.toMatch(/is_internal_staff|has_role/);
  });
  it("only the Supervisor and Director roles save settings", () => {
    const save = body("save_direct_booking_settings");
    expect(save).toMatch(/holds_functional_role\(auth\.uid\(\), 'ops_supervisor'\)/);
    expect(save).toMatch(/holds_functional_role\(auth\.uid\(\), 'director_ops'\)/);
    expect(save).not.toMatch(/has_role|is_internal_staff/);
  });
});
