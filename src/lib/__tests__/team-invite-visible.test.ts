import { describe, expect, it } from "bun:test";
import { visibleInvites } from "@/components/TeamInvitePanel";

const now = new Date("2026-11-04T12:00:00Z");
const list = [
  { id: "old", created_at: "2026-10-01", expires_at: "2026-12-01", redeemed_at: null, revoked_at: null },
  { id: "new", created_at: "2026-11-03", expires_at: "2026-12-03", redeemed_at: null, revoked_at: null },
  { id: "used", created_at: "2026-11-02", expires_at: "2026-12-02", redeemed_at: "2026-11-03", revoked_at: null },
  { id: "expired", created_at: "2026-09-01", expires_at: "2026-10-01", redeemed_at: null, revoked_at: null },
  { id: "revoked", created_at: "2026-11-01", expires_at: "2026-12-01", redeemed_at: null, revoked_at: "2026-11-02" },
];
describe("Past invites", () => {
  it("shows only active, unredeemed codes by default, newest first", () => {
    expect(visibleInvites(list, false, now).map((i) => i.id)).toEqual(["new", "old"]);
  });
  it("Show used and expired reveals the rest", () => {
    expect(visibleInvites(list, true, now).map((i) => i.id)).toEqual(["new", "used", "revoked", "old", "expired"]);
  });
});
