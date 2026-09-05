import { describe, expect, it } from "bun:test";
import { previewIdentityLabel } from "../demo-mode";

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
