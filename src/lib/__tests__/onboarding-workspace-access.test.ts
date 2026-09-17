import { expect, it } from "bun:test";
import { loadOnboardingWorkspace } from "../onboarding.server";

it("rejects non-onboarding callers before loading staff workspace records", async () => {
  let reads = 0;
  const db = {
    rpc: async (name: string, args: { _user_id: string }) => {
      expect(name).toBe("is_onboarding_staff");
      expect(args._user_id).toBe("owner-user");
      return { data: false, error: null };
    },
    from: () => {
      reads++;
      throw new Error("unexpected workspace read");
    },
  };
  const message = await loadOnboardingWorkspace(db as never, "owner-user").then(
    () => "unexpected success",
    (error: Error) => error.message,
  );
  expect(message).toContain("do not have access");
  expect(reads).toBe(0);
});

it("fails closed when the workspace capability cannot be verified", async () => {
  const db = {
    rpc: async () => ({ data: true, error: new Error("role lookup unavailable") }),
    from: () => {
      throw new Error("unexpected workspace read");
    },
  };
  const message = await loadOnboardingWorkspace(db as never, "staff-user").then(
    () => "unexpected success",
    (error: Error) => error.message,
  );
  expect(message).toContain("Could not verify your access level");
});
