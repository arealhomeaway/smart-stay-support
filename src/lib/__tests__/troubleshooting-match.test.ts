import { describe, expect, it } from "bun:test";
import { guideKeyFor } from "../troubleshooting-match";
describe("guideKeyFor", () => {
  it("finds a fridge guide", () => expect(guideKeyFor("Fridge not cooling")).toBe("refrigerator"));
  it("finds wifi", () => expect(guideKeyFor("Guest says the WiFi is down")).toBe("wifi"));
  it("returns null when nothing matches", () => expect(guideKeyFor("Broken porch railing")).toBeNull());
});
