import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Root cause of the reported defect: "clicking Vendor says complete
 * dismisses/closes the Work Order drawer/window" on the Work Orders page.
 *
 * That page (work-orders.index.tsx) groups work orders into bucket
 * sections (needs_action, waiting_vendor, evidence_missing, ...) and only
 * renders a bucket's <SectionCard> when it has rows. Recording "Vendor
 * says complete" moves a work order from e.g. "waiting_vendor" into
 * "evidence_missing" — a real, correct bucket transition. If that work
 * order was the only one left in its old bucket, the old bucket's row
 * count drops to zero and its section stops rendering.
 *
 * The bug: the previous code rendered a <WorkOrderListSection> per
 * bucket, and that component owned its own "which id is open" state and
 * its own <WorkOrderDrawer>. When its housing section stopped rendering,
 * the drawer unmounted with it — with no onOpenChange(false), no
 * animation, just gone. That is exactly "the drawer dismissed" the
 * acceptance round reported, even though the Work Order itself stayed
 * open in the database (confirmed separately: vendor completion never
 * touches closed_at).
 *
 * This repo has no DOM rendering harness (see the other __tests__ files
 * — every one tests a plain function or, like this one, guards the
 * wiring at the source level), so this is a regression guard against the
 * fix reverting: the "open work order id" must live at the page, resolved
 * against the full, bucket-independent list, not inside a per-bucket
 * component that the page can stop rendering.
 */
describe("work-orders.index.tsx — the drawer survives a bucket transition", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../../routes/_authenticated/work-orders.index.tsx"), "utf8");

  it("owns its own openId state at the page, not via a per-bucket WorkOrderListSection", () => {
    expect(src).toContain("const [openId, setOpenId] = useState<string | null>(null);");
    expect(src).not.toContain("WorkOrderListSection");
  });

  it("resolves the open Work Order from the full, unfiltered list — not from a bucket's filtered rows", () => {
    expect(src).toContain(
      "const fromAll = (workOrders.data ?? []).find((w) => w.id === openId) ?? null;",
    );
  });

  it("renders exactly one WorkOrderDrawer, outside the per-bucket map, so no bucket can unmount it", () => {
    const drawerCount = (src.match(/<WorkOrderDrawer/g) ?? []).length;
    expect(drawerCount).toBe(1);
    // The single drawer must appear after the bucket loop closes, not
    // nested inside SectionCard/the per-bucket rows.
    const bucketLoopEnd = src.indexOf("})\n      )}");
    const drawerIndex = src.indexOf("<WorkOrderDrawer");
    expect(bucketLoopEnd).toBeGreaterThan(-1);
    expect(drawerIndex).toBeGreaterThan(bucketLoopEnd);
  });

  it("falls back to the last-known Work Order while it briefly refetches, so a bucket move never flashes it closed", () => {
    expect(src).toContain("const lastOpen = useRef<WorkOrderRow | null>(null);");
    expect(src).toContain("const openWorkOrder = openId ? (fromAll ?? lastOpen.current) : null;");
  });
});
