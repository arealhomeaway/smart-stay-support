import { describe, expect, it } from "bun:test";
import { can } from "@/lib/permissions";
import { canOpenPath } from "@/lib/route-access";
import { drawerTicketId } from "@/components/nav/TicketDrawer";

describe("Operations V2 role-based navigation", () => {
  it("standard coordinators get no Onboarding, Executive view, Integrations, Demo or Oversight", () => {
    for (const cap of ["onboarding_workspace", "command_center", "integrations", "view_as", "oversight"] as const)
      expect(can(["tech"], cap)).toBe(false);
    for (const p of ["/onboarding", "/command-center", "/integrations", "/demo"])
      expect(canOpenPath(p, { roles: ["tech"] })).toBe(false);
    for (const p of ["/dashboard", "/tickets", "/map", "/vendors", "/str-dispatch-check"])
      expect(canOpenPath(p, { roles: ["tech"] })).toBe(true);
  });
  it("supervisors (Micah, James) and admins (Emily) keep Operations Oversight", () => {
    expect(can(["manager"], "oversight")).toBe(true);
    expect(can(["admin", "tech"], "oversight")).toBe(true);
    expect(can(["admin"], "integrations")).toBe(true);
  });
});

describe("ticket drawer link detection", () => {
  const o = "http://localhost:8080";
  const id = "11111111-2222-3333-4444-555555555555";
  it("opens Ticket links in place, never New or other pages", () => {
    expect(drawerTicketId(`/tickets/${id}?from=abc`, o)).toBe(id);
    expect(drawerTicketId("/tickets/new", o)).toBeNull();
    expect(drawerTicketId("/tickets", o)).toBeNull();
    expect(drawerTicketId(`https://evil.example/tickets/${id}`, o)).toBeNull();
  });
});
