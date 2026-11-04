import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { backToNormalIds, cellBlocks, undoOutIds, whosOutRemoveIds, type SOverride, type SShift } from "@/lib/team-schedule";
import { validateSlotInput } from "@/lib/evidence-slots.functions";

const shift = { id: "s1", role_code: "ge_1", weekday: 3, start_minute: 480, end_minute: 1020, active: true } as unknown as SShift;
const date = "2026-11-04"; // Wednesday
const win = { starts_at: "2026-11-04T14:00:00Z", ends_at: "2026-11-04T23:00:00Z" };
const off: SOverride = { id: "o1", role_code: "ge_1", kind: "off", user_id: null, note: null, ...win };
const pairedCover: SOverride = { id: "c1", role_code: "ge_1", kind: "cover", user_id: "u2", note: null, ...win };
const otherCover: SOverride = { id: "c2", role_code: "ge_1", kind: "cover", user_id: "u3", note: null, starts_at: "2026-11-04T15:00:00Z", ends_at: "2026-11-04T16:00:00Z" };

describe("undo this-week-only changes", () => {
  it("Undo out removes the off override and the cover saved with it", () => {
    const [b] = cellBlocks("ge_1", date, [shift], [off, pairedCover]);
    expect(b!.out).toBe(true);
    expect(undoOutIds(b!, [off, pairedCover]).sort()).toEqual(["c1", "o1"]);
  });
  it("Undo out leaves unrelated covers alone", () => {
    const [b] = cellBlocks("ge_1", date, [shift], [off, otherCover]);
    expect(undoOutIds(b!, [off, otherCover])).toEqual(["o1"]);
  });
  it("Back to normal shift removes only the cover", () => {
    const [b] = cellBlocks("ge_1", date, [shift], [otherCover]);
    expect(undoOutIds(b!, [otherCover])).toEqual([]);
    expect(backToNormalIds(b!, [otherCover])).toEqual(["c2"]);
  });
  it("after removing the out, the block is the normal shift again", () => {
    const [b] = cellBlocks("ge_1", date, [shift], []);
    expect(b!.out).toBe(false);
    expect(b!.coverUserId).toBeNull();
  });
  it("Who's out remove targets that off entry", () => {
    expect(whosOutRemoveIds("o1", [off, pairedCover, otherCover]).sort()).toEqual(["c1", "o1"]);
    expect(whosOutRemoveIds("c2", [otherCover])).toEqual([]);
  });
  it("removal goes through the audited server function that checks Admin or Supervisor", () => {
    const src = readFileSync("src/lib/coverage-admin.functions.ts", "utf8");
    const fn = src.slice(src.indexOf("export const deleteOverride"));
    expect(fn.slice(0, 600)).toContain("assertCanEditCoverage(context)");
    const ui = readFileSync("src/components/team/ScheduleTab.tsx", "utf8");
    expect(ui).toContain("useServerFn(deleteOverride)");
  });
});

describe("refund and claim evidence checklist", () => {
  it("no screen inserts evidence_requirements directly", () => {
    for (const f of ["src/components/recovery/LogRecoveryDialog.tsx", "src/components/recovery/TicketRecoveryPanel.tsx", "src/components/claims/TicketClaimPanel.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toMatch(/from\("evidence_requirements"\)\.insert/);
      expect(s).toContain("createEvidenceSlotsFn");
    }
  });
  it("server path removes the new record if the checklist fails", () => {
    const s = readFileSync("src/lib/evidence-slots.functions.ts", "utf8");
    expect(s).toMatch(/if \(error\) \{[\s\S]*\.delete\(\)\.eq\("id", row\.id\)\.eq\("created_by", userId\)/);
    expect(s).toContain("row.created_by !== userId");
  });
  it("validates input", () => {
    expect(() => validateSlotInput({ subjectType: "tickets", subjectId: "x", slots: [] })).toThrow();
    const ok = validateSlotInput({ subjectType: "claim", subjectId: "21bcc867-f72d-4ea9-8bfc-efa199aec180", slots: [{ slot_key: "a", label: "A", requirement_kind: "photo", instruction: null, required: true, subject_type: "x" }] });
    expect(ok.slots[0]).not.toHaveProperty("subject_type");
  });
});
