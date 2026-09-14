import { expect, it } from "bun:test";
import { guardedDelivery } from "../onboarding-delivery.server";

it("sends once when two requests compete for the saved claim", async () => {
  let claimed = false;
  let sends = 0;
  const input = {
    claim: async () => {
      if (claimed) throw new Error("Already claimed");
      claimed = true;
    },
    send: async () => {
      sends++;
      return { status: "sent" as const, error: null };
    },
    releaseSkipped: async () => {
      claimed = false;
    },
    recordSent: async () => {},
  };
  const results = await Promise.allSettled([guardedDelivery(input), guardedDelivery(input)]);
  expect(sends).toBe(1);
  expect(results.filter((r) => r.status === "rejected").length).toBe(1);
});

it("retains the claim after uncertain delivery or a failed local receipt write", async () => {
  for (const outcome of ["failed", "throws", "receipt"] as const) {
    let releases = 0;
    let message = "";
    try {
      await guardedDelivery({
        claim: async () => {},
        send: async () => {
          if (outcome === "throws") throw new Error("Timeout");
          return outcome === "failed"
            ? { status: "failed", error: "Timeout" }
            : { status: "sent", error: null };
        },
        recordSent: async () => {
          throw new Error("Database unavailable");
        },
        releaseSkipped: async () => {
          releases++;
        },
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("Verify");
    expect(releases).toBe(0);
  }
});

it("releases a claim only when the mail helper skipped the send", async () => {
  let released = false;
  let recorded = false;
  try {
    await guardedDelivery({
      claim: async () => {},
      send: async () => ({ status: "skipped", error: "Mailbox not configured" }),
      releaseSkipped: async () => {
        released = true;
      },
      recordSent: async () => {
        recorded = true;
      },
    });
  } catch {
    /* A skipped attempt remains an actionable error for the caller. */
  }
  expect(released).toBe(true);
  expect(recorded).toBe(false);
});
