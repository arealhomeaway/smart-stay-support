import { test } from "node:test";
import assert from "node:assert/strict";
import {
  atRiskTaskIds,
  expiredOfferIds,
  offerSyntheticTask,
  writeSyntheticTask,
  type SyntheticCleaningTask,
} from "../cleaning-workflow.ts";

const at = "2026-10-05T17:00:00Z";
const cleaner = { id: "synthetic-cleaner", role: "cleaner" as const };
const pc = { id: "synthetic-pc", role: "pc" as const };
const task: SyntheticCleaningTask = {
  id: "synthetic-task",
  kind: "departure",
  state: "offered",
  assignedUserId: cleaner.id,
  checklistVersion: "synthetic-approved-v1",
  checklistApproved: true,
  fields: [
    { id: "walkthrough", kind: "field", responseType: "text", required: true, photoRequired: true },
  ],
  answers: [],
  correctionRound: 0,
  events: [],
  submissions: [],
};

test("worker submission is validated and review approval is a separate event", () => {
  const accepted = writeSyntheticTask(task, "accept", cleaner, at, "Accepted");
  const working = writeSyntheticTask(accepted, "begin", cleaner, at, "Started");
  assert.throws(() => writeSyntheticTask(working, "submit", cleaner, at, "Incomplete"));
  const answer = [
    { fieldId: "walkthrough", value: "Synthetic condition", photoRefs: ["synthetic-photo"] },
  ];
  const submitted = writeSyntheticTask(working, "submit", cleaner, at, "Complete", answer);
  assert.equal(submitted.state, "submitted");
  assert.equal(submitted.submissions.length, 1);
  assert.throws(() => writeSyntheticTask(submitted, "approve", cleaner, at, "Cannot approve"));
  const reviewing = writeSyntheticTask(submitted, "begin_review", pc, at, "Reviewing");
  assert.equal(
    writeSyntheticTask(reviewing, "approve", pc, at, "Evidence reviewed").state,
    "approved",
  );
});

test("correction round preserves original submission and review reason", () => {
  const answer = [
    { fieldId: "walkthrough", value: "First condition", photoRefs: ["synthetic-photo-1"] },
  ];
  const first = writeSyntheticTask(
    writeSyntheticTask(
      writeSyntheticTask(task, "accept", cleaner, at, "Accepted"),
      "begin",
      cleaner,
      at,
      "Started",
    ),
    "submit",
    cleaner,
    at,
    "First submission",
    answer,
  );
  const reviewing = writeSyntheticTask(first, "begin_review", pc, at, "Reviewing");
  assert.throws(() => writeSyntheticTask(reviewing, "require_correction", pc, at, ""));
  const correction = writeSyntheticTask(reviewing, "require_correction", pc, at, "Kitchen missed");
  const reopened = writeSyntheticTask(correction, "reopen", cleaner, at, "Correcting");
  const second = writeSyntheticTask(reopened, "submit", cleaner, at, "Revised", [
    { fieldId: "walkthrough", value: "Corrected", photoRefs: ["synthetic-photo-2"] },
  ]);
  assert.equal(second.correctionRound, 1);
  assert.equal(second.submissions.length, 2);
  assert.equal(second.submissions[0]?.answers[0]?.value, "First condition");
  assert.equal(
    second.events.find((event) => event.action === "require_correction")?.note,
    "Kitchen missed",
  );
});

test("inspector may review a departure clean without becoming its cleaner", () => {
  const answer = [
    { fieldId: "walkthrough", value: "Synthetic condition", photoRefs: ["synthetic-photo"] },
  ];
  const submitted = writeSyntheticTask(
    writeSyntheticTask(
      writeSyntheticTask(task, "accept", cleaner, at, "Accepted"),
      "begin",
      cleaner,
      at,
      "Started",
    ),
    "submit",
    cleaner,
    at,
    "Submitted",
    answer,
  );
  const inspector = { id: "synthetic-inspector", role: "inspector" as const };
  const reviewing = writeSyntheticTask(
    submitted,
    "begin_review",
    inspector,
    at,
    "Inspection started",
  );
  assert.equal(
    writeSyntheticTask(reviewing, "require_correction", inspector, at, "Photo needs correction")
      .state,
    "correction_required",
  );
});

test("unapproved checklist and premature inspection are blocked", () => {
  const accepted = writeSyntheticTask(
    { ...task, checklistApproved: false },
    "accept",
    cleaner,
    at,
    "Accepted",
  );
  const working = writeSyntheticTask(accepted, "begin", cleaner, at, "Started");
  assert.throws(() =>
    writeSyntheticTask(working, "submit", cleaner, at, "Cannot use draft", [
      { fieldId: "walkthrough", value: "x", photoRefs: ["p"] },
    ]),
  );
  const inspector = { id: "synthetic-inspector", role: "inspector" as const };
  const inspection = {
    ...task,
    kind: "inspection" as const,
    assignedUserId: inspector.id,
    departureCleaningState: "in_progress" as const,
  };
  const inspected = writeSyntheticTask(inspection, "accept", inspector, at, "Accepted");
  assert.throws(() => writeSyntheticTask(inspected, "begin", inspector, at, "Too early"));
});

test("expiry and unassigned views expose at-risk tasks without writes", () => {
  const unassigned = {
    ...task,
    id: "synthetic-unassigned",
    state: "scheduled" as const,
    assignedUserId: null,
  };
  assert.deepEqual(atRiskTaskIds([task, unassigned]), ["synthetic-unassigned"]);
  assert.deepEqual(
    expiredOfferIds([task, unassigned], new Map([[task.id, "2026-10-05T16:00:00Z"]]), at),
    [task.id],
  );
});

test("manual dispatch creates an offer and audit event from an unassigned task", () => {
  const unassigned = { ...task, state: "scheduled" as const, assignedUserId: null };
  const offered = offerSyntheticTask(unassigned, "synthetic-cleaner", pc, at);
  assert.equal(offered.state, "offered");
  assert.equal(offered.events[0]?.action, "manual_offer");
  assert.throws(() => offerSyntheticTask(offered, "another-cleaner", pc, at));
});
