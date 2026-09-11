import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * This repo has no React rendering/DOM test harness (see the other
 * __tests__ files — every one tests a plain function, never a component),
 * so "the new Work Order opens immediately" can't be exercised by
 * simulating a click. This is a source-level regression guard instead: it
 * fails if the wiring behind that behavior is ever removed.
 *
 * Why both halves matter: the create mutation has to hand its new Work
 * Order's id back to onSuccess (mutationFn returns it), and onSuccess has
 * to feed that id into the same setOpenWorkOrderId state "Open work
 * order" already uses to drive the drawer — dropping either half silently
 * regresses back to "nothing opens after Open another work order".
 */
describe("TicketWorkOrderPanel — creating a Work Order opens it in the same drawer, in place", () => {
  const src = readFileSync(
    join(here, "../../components/workorders/TicketWorkOrderPanel.tsx"),
    "utf8",
  );

  it("the create mutation returns the new Work Order's id", () => {
    expect(src).toContain("return (data as { id: string }).id;");
  });

  it("onSuccess opens that Work Order via the existing drawer state, not a navigation", () => {
    const onSuccessMatch = src.match(
      /onSuccess:\s*async\s*\(newWorkOrderId\)\s*=>\s*\{[\s\S]*?\n\s{4}\},/,
    );
    expect(onSuccessMatch).not.toBeNull();
    const body = onSuccessMatch?.[0] ?? "";
    expect(body).toContain("setOpenWorkOrderId(newWorkOrderId)");
    // Must not navigate away from the Ticket route to show the new Work Order.
    expect(body).not.toContain("navigate(");
    expect(/to=["']\/work-orders/.test(body)).toBe(false);
  });
});
