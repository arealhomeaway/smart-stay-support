import { describe, expect, it } from "bun:test";
import { reopenPathFor } from "../ticket-reopen";
import { validateTicketTransition } from "../ticket-lifecycle";

const NOW = Date.parse("2026-11-08T15:00:00Z");
const closed = { status: "closed", record_type: "active_task" };

describe("Reopen on the ticket page", () => {
  it("a closed ordinary ticket gets the reason dialog, not the status change that always failed", () => {
    expect(reopenPathFor(closed, true, NOW)).toBe("closed");
    // The old button went through this check and was always refused:
    const old = validateTicketTransition("in_progress", { status: "closed" } as never);
    expect(old.ok).toBe(false);
  });

  it("a closed Notion import not yet live is reopened from its Imported from Notion box", () => {
    expect(reopenPathFor({ ...closed, external_source: "notion", external_status: "Done" }, true, NOW)).toBe("notion");
  });

  it("a Notion ticket already live and closed again uses the ordinary reopen", () => {
    expect(
      reopenPathFor({ ...closed, external_source: "notion", external_status: "reopened_in_resolve" }, true, NOW),
    ).toBe("closed");
  });

  it("resolved work keeps its existing Reopen", () => {
    expect(reopenPathFor({ status: "resolved", record_type: "active_task" }, true, NOW)).toBe("resolved");
  });

  it("onboarding accounts (who cannot work tickets) never get Reopen or Take", () => {
    expect(reopenPathFor(closed, false, NOW)).toBeNull();
    expect(reopenPathFor({ ...closed, external_source: "notion", external_status: "Done" }, false, NOW)).toBeNull();
    expect(reopenPathFor({ status: "resolved" }, false, NOW)).toBeNull();
  });

  it("no Reopen on open, archived or one touch log tickets", () => {
    expect(reopenPathFor({ status: "open", record_type: "active_task" }, true, NOW)).toBeNull();
    expect(reopenPathFor({ ...closed, archived_at: "2026-11-01T00:00:00Z" }, true, NOW)).toBeNull();
    expect(reopenPathFor({ status: "closed", record_type: "completed_interaction" }, true, NOW)).toBeNull();
  });
});
