import { expect, it } from "bun:test";
import {
  independentReadinessForTasks,
  type IndependentReadiness,
} from "../onboarding-independent-readiness";
import { splitByScope, projectScope } from "../onboarding-scope";
const source: IndependentReadiness = {
  propertyId: "home",
  pendingFacts: 0,
  financials: [
    { id: "decision", title: "Roof repair", taskIds: ["repair"], issue: "Owner decision missing" },
    { id: "excluded", title: "Pool cost", taskIds: ["pool"], issue: "Owner decision missing" },
    { id: "accounting", title: "Unsettled invoice", taskIds: [], issue: null },
    { id: "project", title: "Project cost", taskIds: [], issue: "Supervisor decision missing" },
  ],
  fieldWork: [
    {
      id: "field",
      title: "Repair job",
      taskIds: ["repair"],
      issue: "Completion missing",
      sourceType: "work_order",
    },
    {
      id: "pool-job",
      title: "Pool job",
      taskIds: ["pool"],
      issue: "Completion missing",
      sourceType: "breezeway_outbound",
    },
  ],
};
const all = [
  { id: "repair", title: "Roof repair", status: "complete" },
  { id: "pool", title: "Pool setup", status: "complete" },
];
it("uses canonical issue results, excludes out-of-scope linked records and keeps unsettled accounting independent", () => {
  const applicable = splitByScope(all, projectScope({ modules: ["repairs"] })).inScope;
  const result = independentReadinessForTasks(source, applicable);
  expect(result.financialBlockers.map((row) => row.id)).toEqual(["decision", "project"]);
  expect(result.fieldBlockers.map((row) => row.id)).toEqual(["field"]);
  expect(result.extras.financialReasons).toEqual([
    "Roof repair: Owner decision missing",
    "Project cost: Supervisor decision missing",
  ]);
});
it("valid explicit task carryover retains field work but cannot waive a financial decision", () => {
  const task = {
    ...all[0]!,
    status: "carryover",
    assigned_to: "pm",
    due_on: "2026-10-01",
    carryover_reason: "Accepted later visit",
  };
  const result = independentReadinessForTasks(source, [task]);
  expect(result.fieldBlockers.length).toBe(0);
  expect(result.retainedFieldWork.map((row) => row.id)).toEqual(["field"]);
  expect(result.financialBlockers.map((row) => row.id)).toEqual(["decision", "project"]);
  expect(
    independentReadinessForTasks(source, [{ ...task, assigned_to: null }]).fieldBlockers.length,
  ).toBe(1);
});
it("missing independent readiness fails closed and unrelated source tasks cannot become blockers", () => {
  expect(independentReadinessForTasks(undefined, all).extras.independentReadinessUnavailable).toBe(
    true,
  );
  const result = independentReadinessForTasks(
    {
      ...source,
      financials: [],
      fieldWork: [{ id: "ordinary", title: "Operations", taskIds: ["unrelated"], issue: "Open" }],
    },
    all,
  );
  expect(result.fieldBlockers.length).toBe(0);
});
