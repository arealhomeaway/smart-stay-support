import { expect, it } from "bun:test";
import { localEmailBlock, verifyEmailSafety } from "../email-safety.server";

it("blocks .invalid recipients in every recipient field, case-insensitively", async () => {
  for (const field of ["to", "toAdditional", "cc", "bcc"]) {
    const input = field === "to" ? { to: "qa@Resolve-Test.INVALID " } :
      { to: "staff@arealhomeaway.com", [field]: ["qa@anything.invalid"] };
    expect(await verifyEmailSafety(input)).toContain("blocked");
  }
});
it("blocks explicit demo records even when addressed to real staff", () => {
  expect(localEmailBlock({ to: "staff@arealhomeaway.com", isDemo: true })).toContain("blocked");
});
it("blocks demo/test accounts and unresolved record checks at the shared boundary", async () => {
  for (const answer of [{ data: false, error: null }, { data: null, error: "missing" }]) {
    const db = { rpc: async () => answer };
    expect(await verifyEmailSafety({ to: "staff@arealhomeaway.com" }, db as never)).toContain("blocked");
  }
});
it("permits a verified real recipient and real record", async () => {
  const db = { rpc: async () => ({ data: true, error: null }) };
  expect(await verifyEmailSafety({ to: "staff@arealhomeaway.com", entity: { type: "ticket", id: "real" } }, db as never)).toBeNull();
});