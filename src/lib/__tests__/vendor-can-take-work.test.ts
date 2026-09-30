import { describe, expect, it } from "bun:test";
import { canTakeWork } from "@/components/vendors/useVendorWorkspace";

const g = (clear: boolean) => new Map([["v", { blockingClear: clear }]]);
const c = (state: string) => new Map([["v", { state }]]);
const v = (status: string, is_active = true) => ({ id: "v", status, is_active, critical_failure: false });

describe("canTakeWork", () => {
  it("allows qualified active vendors before expiry", () => {
    expect(canTakeWork(v("approved"), g(true), c("expires_7"))).toBe(true);
    expect(canTakeWork(v("pilot"), g(false), c("current"))).toBe(true);
  });
  it("blocks inactive, unqualified, held or expired vendors", () => {
    expect(canTakeWork(v("approved", false), g(true), c("current"))).toBe(false);
    expect(canTakeWork(v("candidate"), g(true), c("current"))).toBe(false);
    expect(canTakeWork(v("suspended"), g(true), c("current"))).toBe(false);
    expect(canTakeWork(v("gold"), g(false), c("current"))).toBe(false);
    expect(canTakeWork(v("pilot"), g(true), c("expired"))).toBe(false);
  });
});
