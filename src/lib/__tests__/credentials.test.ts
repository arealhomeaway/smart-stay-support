import { describe, expect, it } from "bun:test";
import {
  canManageCredentials,
  decryptSecret,
  encryptSecret,
  isInternalStaff,
} from "@/lib/credentials.server";

process.env["CREDENTIAL_ENCRYPTION_KEY"] = "test-key-not-a-real-secret";

const v = (...roles: string[]) => ({ userId: "u", roles });

describe("credential access", () => {
  it("lets every internal ARHA staff account read", () => {
    for (const role of ["admin", "manager", "tech", "onboarding"]) {
      expect(isInternalStaff(v(role))).toBe(true);
    }
  });

  it("keeps owners and vendors out", () => {
    expect(isInternalStaff(v("owner"))).toBe(false);
    expect(isInternalStaff(v("vendor"))).toBe(false);
    expect(canManageCredentials(v("owner"))).toBe(false);
    expect(canManageCredentials(v("vendor"))).toBe(false);
  });

  it("lets onboarding, supervisors and admins maintain credentials", () => {
    expect(canManageCredentials(v("onboarding"))).toBe(true);
    expect(canManageCredentials(v("manager"))).toBe(true);
    expect(canManageCredentials(v("admin"))).toBe(true);
  });

  it("does not let front-line staff edit", () => {
    expect(canManageCredentials(v("tech"))).toBe(false);
  });
});

describe("credential encryption", () => {
  it("round-trips a value and never stores it in the clear", async () => {
    const plain = "sample-value-1234";
    const { ciphertext, nonce } = await encryptSecret(plain);
    expect(ciphertext).not.toContain(plain);
    expect(await decryptSecret(ciphertext, nonce)).toBe(plain);
  });

  it("uses a fresh nonce per write", async () => {
    const a = await encryptSecret("same");
    const b = await encryptSecret("same");
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});
