import { describe, expect, it } from "bun:test";
import { CONNECTION_LABEL, connectionState } from "@/lib/load-state";
import { loadViewer } from "@/lib/credentials.server";

describe("a failed check never looks like a real answer", () => {
  it("a failed connection check reads Could not check, not Not connected", () => {
    expect(CONNECTION_LABEL[connectionState({ isLoading: false, isError: true, connected: undefined })]).toBe("Could not check");
  });
  it("a finished check that says no reads Not connected", () => {
    expect(CONNECTION_LABEL[connectionState({ isLoading: false, isError: false, connected: false })]).toBe("Not connected");
  });
  it("a check still running reads Checking", () => {
    expect(CONNECTION_LABEL[connectionState({ isLoading: true, isError: false, connected: undefined })]).toBe("Checking");
  });
  it("code Show refuses with an access-check message when the role read fails, not as no roles", async () => {
    const db = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: "timeout" } }) }) }) };
    await expect(loadViewer(db as never, "u1")).rejects.toThrow("Your access could not be checked");
  });
  it("code Show still reads the roles when the read works", async () => {
    const db = { from: () => ({ select: () => ({ eq: async () => ({ data: [{ role: "admin" }], error: null }) }) }) };
    expect((await loadViewer(db as never, "u1")).roles).toEqual(["admin"]);
  });
});
