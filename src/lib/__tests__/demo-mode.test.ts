import { describe, expect, it } from "bun:test";
import { previewIdentityLabel, ticketDemoMismatch } from "../demo-mode";

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

describe("previewIdentityLabel — a Platform Owner previewing a seat reads as that seat", () => {
  it("shows the real identity when not previewing", () => {
    expect(
      previewIdentityLabel({
        previewing: false,
        previewSeat: "director_ops",
        previewRoleLabel: "Manager",
        actualLabel: "Platform Owner",
      }),
    ).toBe("Platform Owner");
  });

  it("shows the seat label over the shared permission role — Director never reads as Supervisor", () => {
    expect(
      previewIdentityLabel({
        previewing: true,
        previewSeat: "director_ops",
        previewRoleLabel: "Manager",
        actualLabel: "Platform Owner",
      }),
    ).toBe("Director of Operations");
  });

  it("shows the Operations Supervisor seat label distinctly from Director", () => {
    expect(
      previewIdentityLabel({
        previewing: true,
        previewSeat: "ops_supervisor",
        previewRoleLabel: "Manager",
        actualLabel: "Platform Owner",
      }),
    ).toBe("Operations Supervisor");
  });

  it("falls back to the plain role label when no seat was chosen", () => {
    expect(
      previewIdentityLabel({
        previewing: true,
        previewSeat: null,
        previewRoleLabel: "Technician",
        actualLabel: "Platform Owner",
      }),
    ).toBe("Technician");
  });

  it("falls back to the actual label as a last resort", () => {
    expect(
      previewIdentityLabel({
        previewing: true,
        previewSeat: null,
        previewRoleLabel: null,
        actualLabel: "Platform Owner",
      }),
    ).toBe("Platform Owner");
  });
});
