import { describe, expect, it as test } from "bun:test";
import {
  CHECKLIST_CATEGORIES,
  NOT_APPLICABLE,
  answerProblem,
  categoryUsesChecklist,
  checklistProgress,
  isActiveGuest,
  parseChecklistRow,
  refundLimitsText,
  repairBand,
  templatePriority,
  templateProblems,
  type ChecklistAnswer,
} from "@/lib/ticket-checklists";
import { SEED_TEMPLATES } from "@/lib/ticket-checklist-seed";
import { SITUATIONS } from "@/lib/situations";
import { FLAG_KEYS } from "@/lib/feature-flags";
import { RECOVERY_POLICY } from "@/lib/recovery-policy";

const tpl = (c: string) => SEED_TEMPLATES.find((t) => t.category === c)!;
let clock = 0;
const ans = (stepKey: string, value: string, extra: Partial<ChecklistAnswer> = {}): ChecklistAnswer => ({
  stepKey, value, answeredAt: new Date(Date.UTC(2026, 10, 4, 12, 0, clock++)).toISOString(), ...extra,
});
const current = (c: string, rows: ChecklistAnswer[], guest = true) => checklistProgress(tpl(c), rows, guest).current?.key ?? null;

describe("seed templates", () => {
  test("six templates, all valid", () => {
    expect(SEED_TEMPLATES.map((t) => t.category).sort()).toEqual(["booking", "cleaning", "damage", "lockout", "maintenance", "other_complaint"]);
    for (const t of SEED_TEMPLATES) expect(templateProblems(t)).toEqual([]);
  });
  test("guest response is step 1 with an active guest and skipped without one", () => {
    expect(current("lockout", [], true)).toBe("guest");
    expect(current("lockout", [], false)).toBe("problem");
  });
  test("every template ends by closing the ticket", () => {
    for (const t of SEED_TEMPLATES) expect(t.steps.at(-1)!.key).toBe("close");
  });
});

describe("branching", () => {
  test("lockout: remote fix works skips the vendor and goes to the lock cause", () => {
    const rows = [ans("guest", "yes"), ans("problem", SEED_TEMPLATES[0]!.steps[1]!.options[0]!.value), ans("remote_fix", "yes")];
    expect(current("lockout", rows)).toBe("inside");
    expect(current("lockout", [...rows, ans("inside", "yes")])).toBe("lock_cause");
  });
  test("lockout: remote fix fails sends a vendor", () => {
    const rows = [ans("guest", "yes"), ans("problem", tpl("lockout").steps[1]!.options[0]!.value), ans("remote_fix", "no")];
    expect(current("lockout", rows)).toBe("vendor");
  });
  test("cleaning: re-clean accepted goes to the item check, refused goes to the fee refund", () => {
    const base = [ans("guest", "yes"), ans("photos", tpl("cleaning").steps.find((s) => s.key === "photos")!.options[0]!.value), ans("cleaner_notes", tpl("cleaning").steps.find((s) => s.key === "cleaner_notes")!.options[0]!.value)];
    expect(current("cleaning", [...base, ans("reclean", "yes")])).toBe("reclean_done");
    expect(current("cleaning", [...base, ans("reclean", "yes"), ans("reclean_done", "yes")])).toBe("item");
    const no = tpl("cleaning").steps.find((s) => s.key === "reclean")!.options.find((o) => o.value !== "yes")!.value;
    expect(current("cleaning", [...base, ans("reclean", no, { note: "Guest refused" })])).toBe("fee_refund");
  });
  test("other complaint: safety step only for noise", () => {
    const about = (v: string) => [ans("guest", "yes"), ans("about", v), ans("remote", "yes")];
    expect(current("other_complaint", about("noise"))).toBe("safety");
    expect(current("other_complaint", about("wifi"))).toBe("resolved");
  });
  test("maintenance: owner email step only at $200 or more", () => {
    const steps = (amt: string) => tpl("maintenance").steps.filter((s) => s.key !== "owner_email" || true) && checklistProgress(tpl("maintenance"), [ans("quote", "yes", { fields: { amount: amt } })], false).total;
    expect(steps("350")).toBe(steps("200"));
    expect(steps("199")).toBe(steps("200") - 1);
  });
  test("'Not yet' keeps the step open", () => {
    const p = checklistProgress(tpl("lockout"), [ans("guest", "not_yet")], true);
    expect(p.current?.key).toBe("guest");
    expect(p.pending?.value).toBe("not_yet");
  });
  test("latest answer wins, so Not yet then Yes moves on", () => {
    expect(current("lockout", [ans("guest", "not_yet"), ans("guest", "yes")])).toBe("problem");
  });
});

describe("doesn't apply", () => {
  const step = tpl("lockout").steps[1]!;
  test("reason required", () => {
    expect(answerProblem(step, { value: NOT_APPLICABLE, note: "" })).not.toBeNull();
    expect(answerProblem(step, { value: NOT_APPLICABLE, note: "Guest already inside" })).toBeNull();
  });
  test("moves past the step", () => {
    expect(current("lockout", [ans("guest", "yes"), ans("problem", NOT_APPLICABLE, { note: "n/a here" })])).toBe("remote_fix");
  });
  test("required fields enforced", () => {
    const quote = tpl("maintenance").steps.find((s) => s.key === "quote")!;
    expect(answerProblem(quote, { value: quote.options[0]!.value, fields: {} })).toContain("Quote");
    expect(answerProblem(quote, { value: quote.options[0]!.value, fields: { amount: "abc" } })).toContain("number");
  });
});

describe("version pinning", () => {
  test("a ticket reads its own pinned version, unaffected by later edits", () => {
    const v1 = parseChecklistRow({ id: "a", title: "Lockout", version: 1, checklist: { priority: null, steps: tpl("lockout").steps }, checklist_category: "lockout" })!;
    const v2 = parseChecklistRow({ id: "b", title: "Lockout", version: 2, checklist: { priority: null, steps: tpl("lockout").steps.slice(1) }, checklist_category: "lockout" })!;
    expect(checklistProgress(v1, [], true).current?.key).toBe("guest");
    expect(checklistProgress(v2, [], true).current?.key).toBe("problem");
  });
  test("bad rows are refused", () => {
    expect(parseChecklistRow({ id: "x", title: "x", version: 1, checklist: { steps: "no" }, checklist_category: "lockout" })).toBeNull();
    expect(parseChecklistRow({ id: "x", title: "x", version: 1, checklist: { steps: [] }, checklist_category: "nope" })).toBeNull();
  });
});

describe("categories and flags", () => {
  test("every category maps to an existing situation (same work type, seat, SLA)", () => {
    const ids = new Set(SITUATIONS.map((s) => s.id));
    for (const c of CHECKLIST_CATEGORIES) {
      for (const g of [true, false]) {
        const sid = c.situation(g);
        if (c.id === "other") expect(sid).toBeNull();
        else expect(ids.has(sid!)).toBe(true);
      }
    }
  });
  test("every category flag is a known flag", () => {
    for (const c of CHECKLIST_CATEGORIES) if (c.flag) expect((FLAG_KEYS as readonly string[]).includes(c.flag)).toBe(true);
  });
  test("flag off keeps today's flow; Other never uses a checklist", () => {
    expect(categoryUsesChecklist("lockout", () => false)).toBe(false);
    expect(categoryUsesChecklist("lockout", (f) => f === "checklist_lockout")).toBe(true);
    expect(categoryUsesChecklist("other", () => true)).toBe(false);
  });
  test("lockout starts P1 with an active guest, else P2", () => {
    expect(templatePriority(tpl("lockout"), true)).toBe("p1");
    expect(templatePriority(tpl("lockout"), false)).toBe("p2");
  });
  test("active guest = in home or arriving within 48 hours", () => {
    const now = new Date("2026-11-04T12:00:00Z");
    expect(isActiveGuest({ inHome: true, nextArrival: null }, now)).toBe(true);
    expect(isActiveGuest({ inHome: false, nextArrival: "2026-11-06T10:00:00Z" }, now)).toBe(true);
    expect(isActiveGuest({ inHome: false, nextArrival: "2026-11-07T13:00:00Z" }, now)).toBe(false);
  });
});

describe("authority comes from existing rules", () => {
  test("repair bands from Work Order spending authority", () => {
    expect(repairBand(150, false)!.supervisorApprovalRequired).toBe(false);
    expect(repairBand(250, false)!.supervisorApprovalRequired).toBe(true);
    expect(repairBand(400, false)!.ownerApprovalRequired).toBe(true);
    expect(repairBand(400, true)!.ownerApprovalRequired).toBe(false);
  });
  test("refund limits text from RECOVERY_POLICY", () => {
    expect(refundLimitsText()).toContain(`$${RECOVERY_POLICY.pcApprovalCeiling}`);
    expect(refundLimitsText()).toContain("$1,500");
  });
  test("templates never store dollar limits", () => {
    expect(/\$\d/.test(JSON.stringify(SEED_TEMPLATES))).toBe(false);
  });
});
