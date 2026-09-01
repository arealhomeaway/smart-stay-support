import { describe, expect, it } from "bun:test";
import { can, type AppRole } from "@/lib/permissions";

describe("ticket_create capability", () => {
  const internal: AppRole[] = ["admin", "manager", "onboarding", "tech"];

  it("every internal staff role keeps ticket creation", () => {
    for (const role of internal) {
      expect(can([role], "ticket_create")).toBe(true);
    }
  });

  it("vendors and homeowners cannot create internal tickets", () => {
    expect(can(["vendor"], "ticket_create")).toBe(false);
    expect(can(["owner"], "ticket_create")).toBe(false);
  });
});
