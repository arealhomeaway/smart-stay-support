import { expect, it } from "bun:test";
import { businessToday, ownerHoursEligibility } from "../owner-hours-eligibility";

const draft = { status: "draft" };
const home = (closingDate: string | null, closingConfirmed = true) => ({ inclusionStatus: "included", closingDate, closingConfirmed });

it("refuses with a reason when no actual closing is confirmed", () => {
  expect(ownerHoursEligibility(draft, [home("2026-10-01", false)], "2026-10-08")).toEqual({ eligible: false, reason: "no_confirmed_closing" });
});
it("refuses a confirmed closing in the future", () => {
  expect(ownerHoursEligibility(draft, [home("2026-10-09")], "2026-10-08")).toEqual({ eligible: false, reason: "closing_future", closingOn: "2026-10-09" });
});
it("opens on the closing day itself with no activation step", () => {
  expect(ownerHoursEligibility(draft, [home("2026-10-08")], "2026-10-08").eligible).toBe(true);
});
it("a future second home never locks out an owner already eligible", () => {
  expect(ownerHoursEligibility({ status: "active" }, [home("2026-09-22"), home("2026-12-01")], "2026-10-08")).toEqual({ eligible: true, openedOn: "2026-09-22" });
});
it("uses the Chicago day, not UTC: 11 pm Central on Oct 7 is still Oct 7", () => {
  expect(businessToday(new Date("2026-10-08T04:00:00Z"))).toBe("2026-10-07");
});
