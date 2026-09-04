import { describe, expect, it } from "bun:test";
import { classifyTicketText } from "../ticket-classify";
import { situationById } from "../situations";
import { mechanicalPriority } from "../tickets";

describe("frontline classification", () => {
  it("reads a refrigerator failure as an urgent repair, not an emergency", () => {
    const c = classifyTicketText("Fridge is not cooling, guest reported it this evening");
    expect(c?.situation.id).toBe("broken_now");
    const s = c!.situation;
    expect(
      mechanicalPriority(
        "p1",
        s.guestImpact ?? "none",
        s.occupancy ?? "occupied",
        s.priorityCeiling,
      ),
    ).toBe("p2");
  });

  it("keeps safety language at P1 even with a ceiling in play", () => {
    const c = classifyTicketText("Guest smells gas in the kitchen");
    expect(c?.situation.id).toBe("unsafe");
    expect(mechanicalPriority("p1", "safety_security", "occupied", "p2")).toBe("p1");
  });

  it("treats a lockout as an emergency, not a device alert", () => {
    const c = classifyTicketText("Guest is locked out, the keypad code is not working");
    expect(c?.situation.id).toBe("locked_out");
    expect(
      mechanicalPriority(
        "p2",
        c!.situation.guestImpact ?? "none",
        "occupied",
        c!.situation.priorityCeiling,
      ),
    ).toBe("p1");
  });

  it("recognises a cleaning miss", () => {
    expect(classifyTicketText("Home was dirty on arrival, turnover was missed")?.situation.id).toBe(
      "clean_now",
    );
  });

  it("returns nothing for empty or meaningless text", () => {
    expect(classifyTicketText("")).toBeNull();
    expect(classifyTicketText("  ")).toBeNull();
    expect(classifyTicketText("zzzzz qqqq")).toBeNull();
  });

  it("never lowers a work type below the rubric floor", () => {
    // A ceiling cannot demote work the rubric already calls standard.
    expect(mechanicalPriority("p3", "none", "vacant", "p2")).toBe("p3");
  });

  it("leaves situations without a ceiling untouched", () => {
    const arrival = situationById("arrival_info")!;
    expect(arrival.priorityCeiling ?? null).toBeNull();
  });
});
