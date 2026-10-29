import { describe, expect, it } from "bun:test";
import { canAcceptHandoff } from "../home-context";

describe("handoff acceptance visibility from current database seat overrides", () => {
  it("seat holder can accept", () => {
    expect(canAcceptHandoff("holder", "holder", false, [])).toBe(true);
  });
  it("active director_ops cover can accept", () => {
    expect(canAcceptHandoff("cover", "holder", false, [{ kind: "cover", user_id: "cover" }])).toBe(true);
  });
  it("expired cover excluded by seat_override_at cannot accept", () => {
    expect(canAcceptHandoff("cover", "holder", false, [])).toBe(false);
  });
  it("PC cannot accept", () => {
    expect(canAcceptHandoff("pc", "holder", false, [{ kind: "cover", user_id: "cover" }])).toBe(false);
  });
  it("Admin can still accept", () => {
    expect(canAcceptHandoff("admin", "holder", true, [])).toBe(true);
  });
  it("an away override does not grant acceptance", () => {
    expect(canAcceptHandoff("cover", "holder", false, [{ kind: "away", user_id: "cover" }])).toBe(false);
  });
});