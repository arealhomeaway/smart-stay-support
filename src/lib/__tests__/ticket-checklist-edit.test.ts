import { describe, expect, it as test } from "bun:test";
import { NOT_APPLICABLE, answerChangeLine, answerUnchanged, checklistProgress, type ChecklistAnswer, type ChecklistStep } from "@/lib/ticket-checklists";
import { SEED_TEMPLATES } from "@/lib/ticket-checklist-seed";

const step: ChecklistStep = {
  key: "safe",
  label: "3",
  question: "Is the guest safe?",
  options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
  fields: [{ key: "amount", label: "Amount", kind: "money" }],
} as ChecklistStep;

describe("edit a finished checklist step (Nov 19)", () => {
  test("history line reads Changed answer on [step]: [old] to [new]", () => {
    expect(answerChangeLine(step, "Is the guest safe?", { value: "yes" }, { value: "no" }))
      .toBe('Changed answer on step 3, "Is the guest safe?": Yes to No.');
  });

  test("doesn't apply shows by its label on both sides", () => {
    expect(answerChangeLine(step, "Is the guest safe?", { value: NOT_APPLICABLE, note: "No guest" }, { value: "yes", note: "" }))
      .toBe('Changed answer on step 3, "Is the guest safe?": This doesn\'t apply to Yes. Note: No guest to blank.');
  });

  test("a changed field or note is kept in the same line", () => {
    expect(answerChangeLine(step, "Q", { value: "yes", fields: { amount: "200" } }, { value: "yes", fields: { amount: "250" }, note: "Quote revised" }))
      .toBe('Changed answer on step 3, "Q": Yes to Yes. Amount: 200 to 250. Note: blank to Quote revised.');
  });

  test("nothing changed cannot be saved; a change can", () => {
    expect(answerUnchanged({ value: "yes", note: " a ", fields: { amount: "1" } }, { value: "yes", note: "a", fields: { amount: "1" } })).toBe(true);
    expect(answerUnchanged({ value: "yes" }, { value: "no" })).toBe(false);
    expect(answerUnchanged({ value: "yes", fields: null }, { value: "yes", fields: { amount: "5" } })).toBe(false);
  });

  test("an edited row (same step, same row) replaces the shown answer; other answers stay", () => {
    const tpl = SEED_TEMPLATES.find((t) => t.category === "maintenance")!;
    const first = tpl.steps[0]!;
    const second = tpl.steps[1]!;
    const rows: ChecklistAnswer[] = [
      { stepKey: first.key, value: first.options[0]!.value, answeredAt: "2026-11-19T10:00:00Z", rowId: "a" },
      { stepKey: second.key, value: second.options[0]!.value, answeredAt: "2026-11-19T10:01:00Z", rowId: "b" },
    ];
    const lastOpt = first.options.at(-1)!.value;
    const edited = rows.map((r) => (r.rowId === "a" ? { ...r, value: lastOpt } : r));
    const done = checklistProgress(tpl, edited, true).done;
    expect(done.find((d) => d.step.key === first.key)?.answer.value).toBe(lastOpt);
    expect(edited).toHaveLength(2);
    expect(edited[1]).toEqual(rows[1]!);
  });
});
