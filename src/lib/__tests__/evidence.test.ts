/**
 * Evidence Quality Gate — vocabulary guarantees.
 *
 * The promise we make to the person holding the phone is that a rejection
 * always names something they can change. These tests defend that promise, and
 * the fixed status words Operations reads.
 */
import { describe, expect, it } from "bun:test";
import {
  EVIDENCE_KINDS,
  EVIDENCE_SUBJECTS,
  ITEM_STATUS_LABEL,
  KIND_CRITERIA,
  KIND_LABEL,
  REASON_CODES,
  REASON_GUIDANCE,
  REQUIREMENT_STATUS_LABEL,
  isReasonCode,
  requirementSatisfied,
} from "../evidence";

describe("rejection guidance", () => {
  it("gives every reason a specific title and a fix", () => {
    for (const code of REASON_CODES) {
      const g = REASON_GUIDANCE[code];
      expect(g.title.length).toBeGreaterThan(3);
      expect(g.fix.length).toBeGreaterThan(20);
    }
  });

  it("never falls back to generic failure language", () => {
    for (const code of REASON_CODES) {
      const text = `${REASON_GUIDANCE[code].title} ${REASON_GUIDANCE[code].fix}`.toLowerCase();
      expect(text).not.toContain("invalid");
      expect(text).not.toContain("error");
      expect(text).not.toContain("failed");
    }
  });

  it("recognises only known reason codes", () => {
    expect(isReasonCode("blurry")).toBe(true);
    expect(isReasonCode("vibes")).toBe(false);
  });
});

describe("status vocabulary", () => {
  it("uses the approved words", () => {
    expect(REQUIREMENT_STATUS_LABEL.awaiting).toBe("Awaiting evidence");
    expect(REQUIREMENT_STATUS_LABEL.checking).toBe("Checking photo");
    expect(REQUIREMENT_STATUS_LABEL.verified).toBe("Evidence verified");
    expect(REQUIREMENT_STATUS_LABEL.accepted_exception).toBe("Accepted with exception");
    expect(ITEM_STATUS_LABEL.rejected).toBe("Photo not accepted");
    expect(REQUIREMENT_STATUS_LABEL.rejected).toBe("Needs better photo");
  });

  it("treats an exception as satisfying the requirement, and a rejection as not", () => {
    expect(requirementSatisfied("verified")).toBe(true);
    expect(requirementSatisfied("accepted_exception")).toBe(true);
    expect(requirementSatisfied("rejected")).toBe(false);
    expect(requirementSatisfied("awaiting")).toBe(false);
  });
});

describe("evidence kinds", () => {
  it("describes every kind in plain language for both the asker and the taker", () => {
    for (const kind of EVIDENCE_KINDS) {
      expect(KIND_LABEL[kind].length).toBeGreaterThan(2);
      expect(KIND_CRITERIA[kind].length).toBeGreaterThan(20);
    }
  });

  it("covers every place evidence is captured", () => {
    expect([...EVIDENCE_SUBJECTS].sort()).toEqual([
      "assessment",
      "onboarding_task",
      "property",
      "ticket",
      "work_order",
    ]);
  });
});
