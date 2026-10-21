import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * "Start working" is retired as a standalone click. Instead, exactly two
 * shared choke points on the Ticket page back-fill it automatically:
 *  - log(): every note, step, status change, resolve, reopen, guest
 *    confirmation and "still needs repair" already routes through this one
 *    function before writing its own audit row.
 *  - the wrapped setOpenWorkOrderId: both creating and explicitly opening
 *    a Work Order call this (TicketWorkOrderPanel's onOpenWorkOrderIdChange
 *    prop), whether the action is a create or an "Open Work Order" click.
 *
 * This is a source-level regression guard (see the other __tests__ files —
 * this repo has no DOM rendering harness) against either anchor point
 * being bypassed, or the logic being duplicated ad hoc into individual
 * button handlers instead of staying in these two shared places.
 */
describe("Ticket page — 'Start working' is backfilled from exactly two shared anchor points", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../../routes/_authenticated/tickets.$ticketId.tsx"), "utf8");

  it("imports the shared helper", () => {
    expect(src).toContain('import { ensureTicketActionStarted } from "@/lib/ticket-action-start";');
  });

  it("log() calls it before writing its own audit event — the one place every ticket action already routes through", () => {
    const logMatch = src.match(/async function log\([\s\S]*?\n {2}\}/);
    expect(logMatch).not.toBeNull();
    const body = logMatch?.[0] ?? "";
    const startIndex = body.indexOf("ensureTicketActionStarted(ticketId)");
    const insertIndex = body.indexOf('supabase.from("ticket_activity").insert(');
    expect(startIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(-1);
    expect(startIndex < insertIndex).toBe(true);
  });

  it("the wrapped setOpenWorkOrderId calls it whenever a Work Order is created or opened (non-null id), never on close", () => {
    const wrapperMatch = src.match(
      /const setOpenWorkOrderId = \(id: string \| null\) => \{[\s\S]*?\n {2}\};/,
    );
    expect(wrapperMatch).not.toBeNull();
    const body = wrapperMatch?.[0] ?? "";
    expect(body).toContain("if (id) {");
    expect(body).toContain("ensureTicketActionStarted(ticketId)");
  });

  it("the standalone Start working button and its dedicated stage are gone", () => {
    expect(src).not.toContain('<Button size="lg" onClick={startWorking}>');
    expect(src).not.toContain('stage === "start"');
    expect(src).not.toContain("async function startWorking()");
    expect(src).not.toContain("const canStart =");
  });
});
