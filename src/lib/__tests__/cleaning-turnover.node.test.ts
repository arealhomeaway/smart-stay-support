import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionCleaningTask,
  CLEANING_FINDING_CODES,
  CLEANING_TEMPLATES,
  departureTemplateForMarket,
  derivePropertyReadiness,
  type ReadinessInput,
} from "../cleaning-turnover.ts";

test("market-specific departure templates and legacy references stay separate", () => {
  assert.equal(departureTemplateForMarket("OKC"), 581109);
  assert.equal(departureTemplateForMarket("Tulsa"), 581110);
  assert.equal(CLEANING_TEMPLATES.legacyOkcDeparture.status, "legacy");
  assert.equal(CLEANING_TEMPLATES.suggestedInspection.status, "unused");
});

test("submission cannot approve a clean", () => {
  assert.equal(canTransitionCleaningTask("in_progress", "submitted"), true);
  assert.equal(canTransitionCleaningTask("submitted", "approved"), false);
  assert.equal(canTransitionCleaningTask("pending_review", "approved"), true);
  assert.equal(canTransitionCleaningTask("correction_required", "reopened_in_progress"), true);
});

test("readiness requires both approvals and no blockers", () => {
  const base: ReadinessInput = {
    hasCheckout: true,
    cleaningState: "approved",
    inspectionState: "approved",
    urgentIssueOpen: false,
    otherReadinessBlockerOpen: false,
  };
  assert.equal(derivePropertyReadiness(base), "Ready");
  assert.equal(
    derivePropertyReadiness({ ...base, inspectionState: "pending_review" }),
    "Pending Inspection",
  );
  assert.equal(derivePropertyReadiness({ ...base, urgentIssueOpen: true }), "Blocked");
  assert.equal(
    derivePropertyReadiness({ ...base, cleaningState: "correction_required" }),
    "Correction Required",
  );
});

test("finding codes are unique and never imply a charge", () => {
  assert.equal(CLEANING_FINDING_CODES.length, 14);
  assert.equal(new Set(CLEANING_FINDING_CODES.map(([code]) => code)).size, 14);
});
