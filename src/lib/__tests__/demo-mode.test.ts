import { describe, expect, it } from "bun:test";
import {
  canOperateDemo,
  previewIdentityLabel,
  resolveDemoMode,
  ticketDemoMismatch,
} from "../demo-mode";

describe("ticketDemoMismatch — a loaded ticket that no longer belongs under the current lens", () => {
  it("is not a mismatch while nothing has loaded yet", () => {
    expect(ticketDemoMismatch(null, true)).toBe(false);
    expect(ticketDemoMismatch(null, false)).toBe(false);
  });

  it("is not a mismatch when the loaded ticket's flag agrees with the current lens", () => {
    expect(ticketDemoMismatch(true, true)).toBe(false);
    expect(ticketDemoMismatch(false, false)).toBe(false);
  });

  it("is a mismatch once demo mode is exited while a demo ticket is still open", () => {
    expect(ticketDemoMismatch(true, false)).toBe(true);
  });

  it("is a mismatch when demo mode is entered while a live ticket is still open", () => {
    expect(ticketDemoMismatch(false, true)).toBe(true);
  });
});

describe("canOperateDemo — who may operate the demo environment", () => {
  it("is true for an admin's real roles", () => {
    expect(canOperateDemo(["admin"])).toBe(true);
    expect(canOperateDemo(["manager", "admin"])).toBe(true);
  });

  it("is false for anyone without the admin role — no other role can operate demo mode", () => {
    expect(canOperateDemo([])).toBe(false);
    expect(canOperateDemo(["manager"])).toBe(false);
    expect(canOperateDemo(["tech", "vendor"])).toBe(false);
  });
});

describe("resolveDemoMode — entering, opening records in, and exiting the demo lens", () => {
  it("1. entering Demo Mode requires only role + flag + a preview persona — never a seed status", () => {
    // Mirrors DemoProvider.enterDemo(): it calls setViewAs, writePreviewSeat and
    // writeDemoFlag(true) only — no seed RPC. resolveDemoMode's own input type
    // has no seeded/scenario-count field, so there is nothing for it to read:
    // demo mode can turn on with zero demo data ever having been seeded.
    const afterEnterDemo = resolveDemoMode({ canDemo: true, flag: true, hasPreviewIdentity: true });
    expect(afterEnterDemo).toBe(true);
  });

  it("2. once on, an existing demo record is not blocked — opening ticket #555 succeeds", () => {
    const demoMode = resolveDemoMode({ canDemo: true, flag: true, hasPreviewIdentity: true });
    // The QA fixture ticket is a real is_demo=true row; with the lens on, the
    // ticket route's mismatch guard must let it render.
    expect(ticketDemoMismatch(/* loadedTicketIsDemo */ true, demoMode)).toBe(false);
  });

  it("3. exiting Demo Mode turns the lens back off, and a still-open demo record now mismatches", () => {
    // Mirrors DemoProvider.exitDemo(): writePreviewSeat(null), writeDemoFlag(false),
    // clearViewAs() — flag and preview identity both go false.
    const afterExitDemo = resolveDemoMode({
      canDemo: true,
      flag: false,
      hasPreviewIdentity: false,
    });
    expect(afterExitDemo).toBe(false);
    // A demo ticket left open across the exit must be treated as mismatched,
    // not silently kept on screen.
    expect(ticketDemoMismatch(true, afterExitDemo)).toBe(true);
  });

  it("4. a non-demo (non-admin) user can never force the lens on — isolation holds regardless of flag/persona state", () => {
    const cannotOperate = canOperateDemo(["manager"]);
    expect(cannotOperate).toBe(false);
    // Even if the session flag and a preview persona were somehow set (e.g. a
    // stale sessionStorage value), the missing admin role keeps demo mode off.
    expect(resolveDemoMode({ canDemo: cannotOperate, flag: true, hasPreviewIdentity: true })).toBe(
      false,
    );
    // And for a genuine admin who simply hasn't opted in, the lens defaults off.
    expect(resolveDemoMode({ canDemo: true, flag: false, hasPreviewIdentity: false })).toBe(false);
  });
});

describe("previewIdentityLabel — a Admin previewing a seat reads as that seat", () => {
  it("shows the real identity when not previewing", () => {
    expect(
      previewIdentityLabel({
        previewing: false,
        previewSeat: "director_ops",
        previewRoleLabel: "Manager",
        actualLabel: "Admin",
      }),
    ).toBe("Admin");
  });

  it("shows the seat label over the shared permission role — Director never reads as Supervisor", () => {
    expect(
      previewIdentityLabel({
        previewing: true,
        previewSeat: "director_ops",
        previewRoleLabel: "Manager",
        actualLabel: "Admin",
      }),
    ).toBe("Director of Operations");
  });

  it("shows the Operations Supervisor seat label distinctly from Director", () => {
    expect(
      previewIdentityLabel({
        previewing: true,
        previewSeat: "ops_supervisor",
        previewRoleLabel: "Manager",
        actualLabel: "Admin",
      }),
    ).toBe("Operations Supervisor");
  });

  it("falls back to the plain role label when no seat was chosen", () => {
    expect(
      previewIdentityLabel({
        previewing: true,
        previewSeat: null,
        previewRoleLabel: "Technician",
        actualLabel: "Admin",
      }),
    ).toBe("Technician");
  });

  it("falls back to the actual label as a last resort", () => {
    expect(
      previewIdentityLabel({
        previewing: true,
        previewSeat: null,
        previewRoleLabel: null,
        actualLabel: "Admin",
      }),
    ).toBe("Admin");
  });
});
