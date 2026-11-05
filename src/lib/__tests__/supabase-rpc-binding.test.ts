import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Regression guard for Help Ticket #62: supabase-js `rpc` reads `this.rest`,
 * so storing `client.rpc` in a variable and calling it detached crashes with
 * "Cannot read properties of undefined (reading 'rest')". Every RPC helper
 * must bind the client first.
 */
describe("supabase rpc binding", () => {
  const client = createClient("https://example.supabase.co", "sb_publishable_test");

  it("a detached rpc reference crashes with the reported error", () => {
    const detached = client.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
    expect(() => detached("any_function", {})).toThrow(
      "Cannot read properties of undefined (reading 'rest')",
    );
  });

  it("a bound rpc reference gets past the client and only fails on the network", async () => {
    const bound = client.rpc.bind(client) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
    const result = await bound("any_function", {});
    // The unreachable test host fails the fetch; the point is the call itself
    // no longer crashes on `this.rest` before any network work happens.
    expect(result.error?.message ?? "").not.toContain("reading 'rest'");
    expect(result.error).not.toBeNull();
  });
});
