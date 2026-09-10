import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * This repo has no React rendering/DOM test harness (see the other
 * __tests__ files — every one of them tests a plain function, never a
 * component), so "clicking Originating ticket dismisses the drawer" can't
 * be exercised by simulating a click. This is a source-level regression
 * guard instead: it fails if the wiring behind that behavior is ever
 * removed.
 *
 * Why the wiring has to be explicit rather than relying on navigation to
 * unmount the drawer: TanStack Router does not remount a route when you
 * navigate to the params it's already showing, so a Work Order opened from
 * its own originating Ticket and then closed via "Originating ticket"
 * navigates to the exact same route it's already on — nothing unmounts the
 * drawer unless the click itself calls onClose().
 */
describe("WorkOrderDrawer — the Originating ticket link always dismisses the drawer", () => {
  it("passes onClick={onClose} on the Originating ticket Link, not just a bare navigation", () => {
    const src = readFileSync(join(here, "../../components/workorders/WorkOrderDrawer.tsx"), "utf8");
    const linkMatch = src.match(/<Link[\s\S]*?Originating ticket[\s\S]*?<\/Link>/);
    expect(linkMatch).not.toBeNull();
    const link = linkMatch?.[0] ?? "";
    expect(link).toContain('to="/tickets/$ticketId"');
    expect(/onClick=\{onClose\}/.test(link)).toBe(true);
  });
});
