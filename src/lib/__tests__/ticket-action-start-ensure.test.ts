import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * ensureTicketActionStarted does real IO (this repo has no DB mocking
 * harness — see ticketActionStartPlan's own tests for the actual decision
 * logic), so this is a source-level guard on the two structural guarantees
 * that can't be expressed as a pure-function test:
 *  - the update is guarded by .is("action_started_at", null), so a second,
 *    racing call that already lost the idempotency check at the plan level
 *    still can't double-write;
 *  - events are inserted one at a time in a sequential loop (not
 *    Promise.all), so "Acknowledged" always lands before "Work started"
 *    regardless of network timing.
 */
describe("ensureTicketActionStarted — structural guarantees around the plan", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../ticket-action-start.ts"), "utf8");

  it("guards the update against a race with the same idempotency condition the plan used", () => {
    expect(src).toContain('.is("action_started_at", null)');
  });

  it("skips the audit events entirely when the guarded update matched no row", () => {
    const match = src.match(
      /if \(updateError \|\| !updated \|\| updated\.length === 0\) return false;/,
    );
    expect(match).not.toBeNull();
  });

  it("inserts events one at a time, in the plan's own order, not concurrently", () => {
    const loopMatch = src.match(/for \(const event of plan\.events\) \{[\s\S]*?\n {2}\}/);
    expect(loopMatch).not.toBeNull();
    const body = loopMatch?.[0] ?? "";
    expect(body).toContain('await supabase.from("ticket_activity").insert(');
    expect(body).not.toContain("Promise.all");
  });
});
