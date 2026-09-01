import { describe, expect, it } from "bun:test";
import {
  SITUATIONS,
  priorityReason,
  resolveWorkType,
  situationById,
} from "../situations";
import { mechanicalPriority } from "../tickets";

/** The live catalog names this map depends on. */
const CATALOG = [
  "Lock offline or low-battery alert",
  "Adding homes to portals",
  "Breezeway task-reporting issue",
  "Internal interdepartmental communication",
  "OwnerRez booking blocks",
  "Claims",
  "Immediate cleaning need",
  "Ongoing cleaning need",
  "Arrival information",
  "Current or past guest request",
  "New booking request",
  "Tenant lead tracker",
  "Tone-check call",
  "Immediate maintenance",
  "Maintenance and landscaping work-order review",
  "Ongoing maintenance",
  "Escalated owner issue",
  "Property or owner information update",
  "Cleaning Review Log",
  "Guest review, survey and rating logs",
  "Quarterly inspection review",
].map((name, i) => ({ id: `wt-${i}`, name, default_priority: "p3" }));

describe("situation map", () => {
  it("resolves every non-catalog situation to a real work type", () => {
    for (const s of SITUATIONS) {
      if (s.openCatalog) continue;
      expect(resolveWorkType(s, CATALOG), s.id).not.toBeNull();
    }
  });

  it("falls back to null when the catalog renamed the type", () => {
    expect(resolveWorkType(situationById("access"), [{ id: "x", name: "Renamed" }])).toBeNull();
  });

  it("the internal situation opens the catalog instead of resolving", () => {
    const internal = situationById("internal");
    expect(internal?.openCatalog).toBe(true);
    expect(resolveWorkType(internal, CATALOG)).toBeNull();
  });

  it("keeps the rubric in charge of priority", () => {
    // Situation prefills only feed the existing rubric; nothing bypasses it.
    const unsafe = situationById("unsafe")!;
    expect(mechanicalPriority("p3", unsafe.guestImpact!, "vacant")).toBe("p1");
    const later = situationById("broken_later")!;
    expect(mechanicalPriority("p2", later.guestImpact ?? "none", "vacant")).toBe("p2");
  });

  it("explains the priority in plain language", () => {
    expect(priorityReason("safety_security", "vacant", "p3")).toContain("safety");
    expect(priorityReason("none", "occupied", "p3")).toContain("occupied");
    expect(priorityReason("none", "vacant", "p2")).toContain("P2");
  });
});
