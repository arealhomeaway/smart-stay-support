import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Root cause of "Create Work Order still does not automatically open on
 * this Ticket path": tickets.$ticketId.tsx renders a *different*
 * TicketWorkOrderPanel instance per ticket stage (repair / repair_active /
 * verify / reference-only) — only one is ever mounted at a time, but never
 * the same one across a transition. Creating a Work Order immediately
 * flips the ticket's derived stage (repairExists becomes true), which
 * unmounts the "repair" stage's panel — the one whose onSuccess had just
 * set `openWorkOrderId` — and mounts a fresh "repair_active" stage panel
 * with that state back at null. The drawer-opening fix from the previous
 * round was real and correct; it just lived in a component instance that
 * got torn down in the same tick it fired.
 *
 * Fix: the id of the Work Order to show is owned by the Ticket page, not
 * by whichever TicketWorkOrderPanel instance happens to be mounted, so a
 * stage-driven remount can no longer discard it.
 */
describe("TicketWorkOrderPanel's open Work Order id survives a ticket stage change", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const panelSrc = readFileSync(
    join(here, "../../components/workorders/TicketWorkOrderPanel.tsx"),
    "utf8",
  );
  const ticketPageSrc = readFileSync(
    join(here, "../../routes/_authenticated/tickets.$ticketId.tsx"),
    "utf8",
  );

  it("TicketWorkOrderPanel no longer owns openWorkOrderId as local state", () => {
    expect(panelSrc).not.toContain(
      "const [openWorkOrderId, setOpenWorkOrderId] = useState<string | null>(null);",
    );
    expect(panelSrc).toContain("openWorkOrderId: string | null;");
    expect(panelSrc).toContain("onOpenWorkOrderIdChange: (id: string | null) => void;");
  });

  it("the create mutation reports the new id through the prop callback, not local state", () => {
    expect(panelSrc).toContain("onOpenWorkOrderIdChange(newWorkOrderId);");
  });

  it("the Ticket page owns the state once, above every per-stage panel instance", () => {
    expect(ticketPageSrc).toContain(
      "const [openWorkOrderId, setOpenWorkOrderIdRaw] = useState<string | null>(null);",
    );
  });

  it("every TicketWorkOrderPanel instance on the ticket page is wired to that single, page-level state", () => {
    const instances = ticketPageSrc.match(/<TicketWorkOrderPanel\b[\s\S]*?\/>/g) ?? [];
    // Four stage branches (repair, repair_active, verify, reference-only)
    // each render the panel — every one must share the lifted state.
    expect(instances.length).toBe(4);
    for (const instance of instances) {
      expect(instance).toContain("openWorkOrderId={openWorkOrderId}");
      expect(instance).toContain("onOpenWorkOrderIdChange={setOpenWorkOrderId}");
    }
  });
});
